const TEXT_MODELS = ['gemini-2.5-flash-lite', 'gemini-2.5-flash'];
const IMAGE_MODELS = ['gemini-3.1-flash-lite-image', 'gemini-3.1-flash-image', 'gemini-2.5-flash-image'];

function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-api-key');
  res.setHeader('Cache-Control', 'no-store');
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body); } catch { return {}; }
}

function gradeGuide(grade) {
  const n = Number(String(grade || '').match(/[1-5]/)?.[0]);
  return ({
    1: 'Từ/cụm từ cực kỳ quen thuộc, ngắn, thiên về đồ vật, con vật, gia đình, trường lớp; hình ảnh trực quan, không dùng thành ngữ khó.',
    2: 'Từ/cụm từ quen thuộc trong chương trình và đời sống; có thể ghép 2 ý/hình đơn giản, không đánh đố.',
    3: 'Có thể dùng từ ghép/cụm từ và liên tưởng trực quan vừa phải; vẫn ưu tiên kiến thức, vốn từ phù hợp lớp 3.',
    4: 'Có thể dùng cụm từ, thành ngữ rất quen thuộc hoặc kiến thức học tập cơ bản; tránh mẹo ngôn ngữ quá khó.',
    5: 'Có thể dùng cụm từ, thành ngữ/tục ngữ quen thuộc với học sinh cuối tiểu học, nhưng phải suy luận được từ hình và gợi ý.'
  })[n] || 'Nội dung phù hợp học sinh tiểu học, dễ hiểu, an toàn và có thể suy luận từ hình.';
}

function specsSchema(count, imagesPerQuestion) {
  return {
    type: 'array', minItems: count, maxItems: count,
    items: {
      type: 'object',
      properties: {
        answer: { type: 'string' },
        hint: { type: 'string' },
        imagePrompts: {
          type: 'array', minItems: imagesPerQuestion, maxItems: imagesPerQuestion,
          items: { type: 'string' }
        }
      },
      required: ['answer', 'hint', 'imagePrompts'],
      additionalProperties: false
    }
  };
}

function buildSpecsPrompt({ grade, count, topic, imagesPerQuestion }) {
  return `Bạn là giáo viên tiểu học Việt Nam và nhà thiết kế trò chơi "Đuổi hình bắt chữ".
Tạo đúng ${count} câu cho ${grade}. Chủ đề: "${topic || 'Kiến thức và vốn từ phù hợp lứa tuổi'}".
Mỗi câu cần đúng ${imagesPerQuestion} hình gợi ý riêng biệt.
Mức độ theo khối: ${gradeGuide(grade)}

Yêu cầu bắt buộc:
- answer: đáp án ngắn gọn bằng tiếng Việt, đúng chính tả, phù hợp tuyệt đối với ${grade}; các đáp án không lặp nhau.
- hint: một câu gợi ý ngắn, không chứa nguyên văn đáp án và không làm lộ đáp án trực tiếp.
- imagePrompts: đúng ${imagesPerQuestion} mô tả hình ảnh độc lập để ghép lại gợi ra đáp án. Mỗi mô tả phải cụ thể, dễ minh họa, ưu tiên vật thể/hành động rõ ràng.
- Không yêu cầu chữ, ký tự, số, biển hiệu hay đáp án xuất hiện trong hình. Không dùng nội dung đáng sợ, bạo lực, người nổi tiếng hoặc thương hiệu.
- Trò chơi phải có thể đoán được bằng hình + hint, không dựa vào kiến thức vượt cấp hay chơi chữ mơ hồ.
- Trước khi xuất JSON, tự kiểm tra thầm tính đúng đắn, độ tuổi và khả năng suy luận.
Chỉ trả dữ liệu JSON theo schema, không giải thích.`;
}

async function googleGenerate({ apiKey, model, body, timeoutMs = 30000, apiVersion = 'v1beta' }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const err = new Error(data?.error?.message || `Gemini API lỗi ${response.status}`);
      err.status = response.status;
      throw err;
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') throw Object.assign(new Error('AI phản hồi quá lâu. Hãy thử lại.'), { status: 504 });
    throw err;
  } finally { clearTimeout(timer); }
}

function shouldFallback(err) {
  if (!err) return true;
  if ([401, 403, 429].includes(err.status)) return false;
  return true;
}

function normalizeSpecs(value, count, imagesPerQuestion) {
  if (!Array.isArray(value) || value.length !== count) throw new Error('AI chưa trả đủ số câu.');
  const seen = new Set();
  return value.map((q, idx) => {
    const answer = String(q?.answer || '').trim();
    const hint = String(q?.hint || '').trim();
    const imagePrompts = Array.isArray(q?.imagePrompts) ? q.imagePrompts.map(v => String(v || '').trim()).filter(Boolean) : [];
    if (answer.length < 2) throw new Error(`Câu ${idx + 1} thiếu đáp án.`);
    const key = answer.toLocaleLowerCase('vi-VN').replace(/\s+/g, ' ');
    if (seen.has(key)) throw new Error(`Đáp án "${answer}" bị lặp.`);
    seen.add(key);
    if (!hint || hint.toLocaleLowerCase('vi-VN').includes(key)) throw new Error(`Gợi ý câu ${idx + 1} chưa phù hợp.`);
    if (imagePrompts.length !== imagesPerQuestion) throw new Error(`Câu ${idx + 1} chưa đủ mô tả hình.`);
    return { answer, hint, imagePrompts };
  });
}

async function generateSpecs(apiKey, params) {
  let lastError;
  for (const model of TEXT_MODELS) {
    try {
      const data = await googleGenerate({
        apiKey, model,
        body: {
          contents: [{ parts: [{ text: buildSpecsPrompt(params) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseJsonSchema: specsSchema(params.count, params.imagesPerQuestion),
            maxOutputTokens: Math.max(1200, params.count * 420)
          }
        }
      });
      const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
      const parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
      return { model, questions: normalizeSpecs(parsed, params.count, params.imagesPerQuestion) };
    } catch (err) {
      lastError = err;
      if (!shouldFallback(err)) break;
    }
  }
  throw lastError || new Error('Không tạo được câu hỏi Đuổi hình bắt chữ.');
}

function imagePromptText({ prompt, grade, answer }) {
  return `Tạo MỘT hình minh họa giáo dục cho trò chơi Đuổi hình bắt chữ dành cho ${grade}.
Nội dung cần minh họa: ${prompt}.
Phong cách: minh họa 3D/cartoon tươi sáng, thân thiện học sinh tiểu học, vật thể chính lớn và rõ, nền sạch đơn giản, màu sắc vui tươi, dễ nhận biết khi chiếu trên máy chiếu.
TUYỆT ĐỐI không chèn chữ, ký tự, con số, logo, watermark hoặc viết đáp án "${answer}" trong hình. Không thêm chi tiết gây nhiễu. Chỉ tạo hình ảnh.`;
}

async function generateImage(apiKey, params) {
  let lastError;
  for (const model of IMAGE_MODELS) {
    try {
      const data = await googleGenerate({
        apiKey, model, timeoutMs: 55000, apiVersion: 'v1',
        body: {
          contents: [{ parts: [{ text: imagePromptText(params) }] }],
          generationConfig: {
            responseModalities: ['IMAGE'],
            responseFormat: { image: { aspectRatio: '4:3', imageSize: model.includes('2.5') ? undefined : '512' } }
          }
        }
      });
      const parts = data?.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find(p => p?.inlineData?.data || p?.inline_data?.data);
      const inline = imagePart?.inlineData || imagePart?.inline_data;
      if (!inline?.data) throw new Error('Model chưa trả về hình ảnh.');
      return { model, data: inline.data, mimeType: inline.mimeType || inline.mime_type || 'image/png' };
    } catch (err) {
      lastError = err;
      if (!shouldFallback(err)) break;
    }
  }
  throw lastError || new Error('Không tạo được hình ảnh AI.');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ POST.' });
  const apiKey = String(req.headers['x-gemini-api-key'] || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'Thiếu Google Gemini API Key.' });
  const body = parseBody(req);
  try {
    if (body.action === 'specs') {
      const params = {
        grade: String(body.grade || 'Lớp 3').trim(),
        count: Math.max(1, Math.min(10, Number(body.count) || 3)),
        topic: String(body.topic || '').trim(),
        imagesPerQuestion: Math.max(1, Math.min(3, Number(body.imagesPerQuestion) || 2))
      };
      const result = await generateSpecs(apiKey, params);
      return res.status(200).json({ ok: true, ...result });
    }
    if (body.action === 'image') {
      const prompt = String(body.prompt || '').trim();
      if (!prompt) return res.status(400).json({ error: 'Thiếu mô tả hình ảnh.' });
      const result = await generateImage(apiKey, {
        prompt,
        grade: String(body.grade || 'Tiểu học').trim(),
        answer: String(body.answer || '').trim()
      });
      return res.status(200).json({ ok: true, ...result });
    }
    return res.status(400).json({ error: 'action không hợp lệ.' });
  } catch (err) {
    let status = Number(err?.status) || 500;
    if (status < 400 || status > 599) status = 500;
    return res.status(status).json({ error: String(err?.message || 'Không gọi được Gemini API.') });
  }
}
