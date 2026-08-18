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

## Cập nhật giao diện trò chơi & PDF thẻ QR

- **Quizz Nghiêng Đầu**, **Quét Thẻ QR** và **Ngón Tay Thần Kỳ** tự mở toàn màn hình ngay khi bấm **Bắt đầu**. Riêng Quét Thẻ QR, màn hình hướng dẫn ghép điện thoại xuất hiện bên trong chế độ toàn màn hình và đồng hồ chỉ chạy sau khi camera điện thoại sẵn sàng.
- Nút góc màn chơi đổi biểu tượng theo trạng thái: **mở toàn màn hình / thu màn hình**. Khi thu nhỏ về giao diện app, màn chơi vẫn giữ nguyên phiên, camera, đồng hồ, điểm số và các nút điều khiển; khu vực trò chơi có thể cuộn để mọi chức năng vẫn truy cập được.
- Ở bước ghép điện thoại của **Quét Thẻ QR**, nút **HỦY** trên cửa sổ hướng dẫn chỉ đóng cửa sổ hướng dẫn kết nối, không hủy phiên chơi. Giáo viên có thể bấm **HIỆN MÃ QR KẾT NỐI** để mở lại.
- Nút **IN THẺ PDF** tạo file PDF A4 trực tiếp trên trình duyệt, mỗi học sinh có 1 thẻ QR duy nhất với 4 hướng A/B/C/D. PDF được mở ở tab mới để xem, in hoặc tải về; nếu trình duyệt chặn tab mới thì app tự tải file PDF xuống.


## Cập nhật bản Quét nhanh + AI theo khối + Đua vịt

- Máy quét QR điện thoại ưu tiên camera sau 1080p, continuous focus/zoom khi thiết bị hỗ trợ, BarcodeDetector native và jsQR đa tỉ lệ để tăng tốc và khả năng đọc QR nhỏ ở xa.
- AI tự nhận khối từ tên lớp chủ nhiệm (ví dụ LỚP 3B → Lớp 3), ưu tiên Gemini 3.5 Flash-Lite để phản hồi nhanh; dữ liệu đầu ra được kiểm tra chặt và tự fallback sang model mạnh hơn nếu kết quả không hợp lệ.
- Vòng quay có thêm tab **Đua vịt** để gọi tên học sinh ngẫu nhiên.
- Giao diện được làm tươi sáng hơn bằng CSS, không thay cấu trúc dữ liệu/chức năng hiện có.

## Cập nhật Đua Vịt

- Tất cả học sinh đứng cùng một **vạch XUẤT PHÁT** ở đầu bản đồ.
- Vạch **ĐÍCH** được đưa về gần cuối bản đồ (khoảng 90% chiều rộng sân đua).
- Khi lớp đông, kích thước vịt tự thu gọn để dễ quan sát hơn.
- Vịt thắng sẽ cán qua vạch đích; các vịt còn lại dừng trước vạch để xếp hạng.



## Cập nhật: Thư viện câu hỏi cho 3 trò chơi
- Quizz Nghiêng Đầu, Quét Thẻ QR và Ngón Tay Thần Kỳ có Thư viện câu hỏi riêng.
- Câu hỏi do Gemini AI tạo được đưa vào Thư viện trước; giáo viên tích chọn rồi mới đưa vào bộ câu hỏi thi đấu.
- Mỗi thư viện có Chọn tất cả, Bỏ chọn, Xóa từng câu và Xóa tất cả.
- Quản lí Học sinh có nút Xóa tất cả học sinh với bước xác nhận.

## Cập nhật: Quét nhiều thẻ QR cùng lúc
- Camera điện thoại quét **toàn bộ khung hình**, không bắt buộc đưa từng thẻ vào ô giữa màn hình.
- Bộ nhận diện ưu tiên `BarcodeDetector` native; nếu trình duyệt chưa hỗ trợ, app tự dùng ZXing-WASM ponyfill. Cả hai đường này có thể trả về nhiều mã trong cùng một khung hình.
- Mỗi QR được khoanh vùng rồi phóng riêng để `jsQR` xác định chính xác hướng xoay A/B/C/D của thẻ.
- Mỗi học sinh có bộ xác nhận độc lập qua nhiều frame, vì vậy nhiều thẻ xuất hiện cùng lúc không làm ghi đè kết quả của nhau.
- Khi nhiều học sinh được xác nhận trong cùng lượt quét, điện thoại gửi một gói `scan_batch` về máy tính để cập nhật đồng thời và giảm số lần render.
- Camera ưu tiên độ phân giải 2560×1440, continuous focus khi thiết bị hỗ trợ; có thanh Zoom quét xa. Thẻ PDF cũng tăng kích thước QR để dễ nhận ở khoảng cách xa hơn.
