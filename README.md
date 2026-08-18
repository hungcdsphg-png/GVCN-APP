# GVCN - Quét QR qua link Vercel, không dùng Firebase để kết nối

## Luồng sử dụng

1. Đẩy **toàn bộ thư mục này** lên repository GitHub đang nối với Vercel.
2. Vercel deploy `index.html` và Function WebSocket tại `/api/qr-ws`.
3. Trên máy tính, mở đúng link HTTPS Vercel của app.
4. Vào **Góc Trò Chơi → Quét Thẻ QR → Bắt đầu**.
5. Máy tính tự tạo mã QR chứa chính URL Vercel + mã phiên chơi.
6. Dùng điện thoại quét mã QR đó. Điện thoại mở cùng app ở chế độ máy quét và xin quyền camera.
7. Khi camera điện thoại sẵn sàng, máy tính tự vào màn chơi. Giáo viên quét thẻ QR của từng học sinh.
8. Đáp án được chuyển giữa điện thoại và máy tính qua WebSocket `/api/qr-ws`.

## Không dùng Firebase cho kết nối QR

- Không tạo Firestore document cho phiên QR.
- Không cần Firebase Rules cho phiên QR.
- Không cần nhập link Vercel thủ công khi app đã mở từ Vercel; app tự dùng URL hiện tại.
- Firebase trong phần cũ của app (nếu bạn vẫn cấu hình) chỉ liên quan đồng bộ dữ liệu lớp, không tham gia ghép điện thoại của trò QR.

## Vercel

WebSocket trên Vercel cần Fluid Compute. Hãy kiểm tra **Project → Settings → Functions → Fluid Compute** và bật nếu project cũ chưa bật.

Lưu ý: relay trong bản này chỉ giữ phòng trong RAM của Vercel Function và không dùng database. Ở tải thấp thường rất thuận tiện, nhưng Vercel có thể chạy nhiều Function instance. Nếu cần độ tin cậy tuyệt đối khi có nhiều instance/traffic, phải dùng một lớp chia sẻ trạng thái/pub-sub (ví dụ Redis) hoặc một dịch vụ realtime riêng.


## Tạo câu hỏi nhanh bằng Google Gemini AI

1. Mở app bằng link Vercel trên máy giáo viên.
2. Vào **Góc Trò Chơi**. Lần đầu, app yêu cầu nhập **Google Gemini API Key**.
3. Nếu chưa có key, bấm **MỞ GOOGLE AI STUDIO LẤY API** → tạo API key → sao chép và dán vào app.
4. Bấm **KIỂM TRA & LƯU API**. App sẽ kiểm tra key và tự chọn model Gemini Flash phù hợp.
5. Trong **Kéo Co Kiến / Quizz Nghiêng Đầu / Quét Thẻ QR / Ngón Tay Thần Kỳ**, bấm **AI tạo nhanh** (hoặc **Tạo bằng AI**), nhập chủ đề, lớp, số câu và mức độ.
6. Chọn **Thay bộ câu hỏi hiện tại** hoặc **Thêm vào cuối**, sau đó bấm **TẠO CÂU HỎI NGAY**.

### Cách API Key được dùng

- API Key **không được ghi vào GitHub/Vercel source**.
- Key chỉ được lưu bằng `localStorage` trên trình duyệt của máy giáo viên.
- Frontend gửi key tới Vercel Function `/api/gemini` trong header `x-gemini-api-key` cho từng lần kiểm tra/tạo câu hỏi.
- Function chỉ dùng key để gọi Google Gemini API rồi trả bộ câu hỏi về; code không lưu key vào database.
- Model ưu tiên là `gemini-3.7-flash`; nếu project/key chưa dùng được model đó, Function thử lần lượt `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash`.

> Nếu đổi máy hoặc xóa dữ liệu trình duyệt, bạn cần nhập API Key lại.
