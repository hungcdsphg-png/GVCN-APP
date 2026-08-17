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
