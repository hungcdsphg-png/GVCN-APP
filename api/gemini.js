const MODEL_CANDIDATES = [
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-2.5-flash'
];

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

function buildQuizSchema(count) {
  return {
    type: 'array',
    minItems: count,
    maxItems: count,
    items: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        options: {
          type: 'array',
          minItems: 4,
          maxItems: 4,
          items: { type: 'string' }
        },
        correctIndex: { type: 'integer', minimum: 0, maximum: 3 }
      },
      required: ['text', 'options', 'correctIndex'],
      additionalProperties: false
    }
  };
}

function buildQuizPrompt({ topic, count, grade, difficulty }) {
  return `Bạn là giáo viên tiểu học Việt Nam. Hãy tạo đúng ${count} câu hỏi trắc nghiệm cho ${grade}, chủ đề: "${topic}". Mức độ: ${difficulty}.
Mỗi câu phải có đúng 4 phương án A, B, C, D và chỉ có 1 đáp án đúng. Nội dung ngắn gọn, rõ nghĩa, phù hợp học sinh; tránh câu hỏi mơ hồ hoặc có nhiều đáp án đúng. correctIndex là vị trí đáp án đúng từ 0 đến 3. Chỉ trả dữ liệu đúng theo JSON Schema.`;
}

function normalizeQuestions(value, count) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('Gemini chưa tạo được câu hỏi hợp lệ.');
  return value.slice(0, count).map((q, index) => {
    const options = Array.isArray(q?.options) ? q.options.slice(0, 4).map(v => String(v ?? '').trim()) : [];
    while (options.length < 4) options.push(`Lựa chọn ${options.length + 1}`);
    let correctIndex = Number(q?.correctIndex);
    if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3) correctIndex = 0;
    return {
      text: String(q?.text || `Câu hỏi ${index + 1}`).trim(),
      options,
      correctIndex
    };
  });
}

async function googleGenerate({ apiKey, model, body }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data?.error?.message || `Gemini API lỗi ${response.status}`);
      error.status = response.status;
      error.googleStatus = data?.error?.status || '';
      throw error;
    }
    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      const timeoutError = new Error('Gemini phản hồi quá lâu. Hãy thử lại.');
      timeoutError.status = 504;
      throw timeoutError;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function shouldTryNextModel(err) {
  if (!err) return true;
  if ([401, 403, 429].includes(err.status)) return false;
  const msg = String(err.message || '');
  return err.status === 404 || err.status === 400 || /model|not found|unsupported|not available/i.test(msg);
}

async function withModelFallback(apiKey, makeBody) {
  let lastError;
  for (const model of MODEL_CANDIDATES) {
    try {
      const data = await googleGenerate({ apiKey, model, body: makeBody(model) });
      return { data, model };
    } catch (err) {
      lastError = err;
      if (!shouldTryNextModel(err)) break;
    }
  }
  throw lastError || new Error('Không có model Gemini phù hợp.');
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Chỉ hỗ trợ POST.' });

  const apiKey = String(req.headers['x-gemini-api-key'] || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'Thiếu Google Gemini API Key.' });

  const body = parseBody(req);
  const action = body.action || 'generate';

  try {
    if (action === 'validate') {
      const { model } = await withModelFallback(apiKey, () => ({
        contents: [{ parts: [{ text: 'Chỉ trả lời: OK' }] }],
        generationConfig: { maxOutputTokens: 12 }
      }));
      return res.status(200).json({ ok: true, model });
    }

    if (action !== 'generate') return res.status(400).json({ error: 'action không hợp lệ.' });

    const topic = String(body.topic || '').trim();
    if (!topic) return res.status(400).json({ error: 'Vui lòng nhập môn học/chủ đề.' });

    const count = Math.max(1, Math.min(20, Number(body.count) || 5));
    const grade = String(body.grade || 'Tiểu học').trim();
    const difficulty = String(body.difficulty || 'Vừa').trim();
    const prompt = buildQuizPrompt({ topic, count, grade, difficulty });
    const schema = buildQuizSchema(count);

    const { data, model } = await withModelFallback(apiKey, () => ({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
        maxOutputTokens: Math.max(2500, count * 550)
      }
    }));

    const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
    if (!raw) throw new Error('Gemini không trả về nội dung.');

    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json/gi, '').replace(/```/g, '').trim());
    } catch {
      throw new Error('Không đọc được JSON do Gemini trả về. Hãy thử lại.');
    }

    return res.status(200).json({
      ok: true,
      model,
      questions: normalizeQuestions(parsed, count)
    });
  } catch (err) {
    const message = String(err?.message || 'Không gọi được Gemini API.');
    const googleStatus = String(err?.googleStatus || '');
    let status = Number(err?.status) || 500;
    if (status < 400 || status > 599) status = 500;
    return res.status(status).json({ error: message, code: googleStatus || undefined });
  }
}
