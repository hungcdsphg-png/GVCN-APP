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

## Tối ưu quét QR trên điện thoại (19/08/2026)

- Ưu tiên camera sau độ phân giải cao và lấy nét liên tục khi thiết bị hỗ trợ.
- Không ép zoom để giữ vùng nhìn rộng; máy quét xử lý toàn khung hình.
- Khi có `BarcodeDetector`, app nhận nhiều QR trong cùng một frame; `jsQR` được dùng trên các crop nhỏ/chồng lấn để xác định hướng A/B/C/D của thẻ 1-QR.
- Các vùng quét luân phiên bao phủ trái/phải/trên/dưới/toàn khung, giúp QR nhỏ hoặc nằm sát mép dễ được nhận hơn.
- Cơ chế xác nhận độc lập theo từng học sinh cho phép đưa camera lướt qua nhiều thẻ liên tục mà không phải chờ thẻ trước.
- Thẻ PDF mới in QR lớn hơn và dùng mức sửa lỗi M để tăng kích thước từng ô QR, hỗ trợ đọc xa tốt hơn trong điều kiện lớp học sáng rõ.

## Nâng cấp Quét thẻ QR cả lớp (2026-08-19)

- Camera điện thoại ưu tiên 1080p, fallback 720p và camera sau góc rộng 1x.
- Nếu trình duyệt có `BarcodeDetector`, app nhận nhiều QR trong cùng một khung hình.
- `jsQR` chạy theo lưới 4×3 chồng lấn và có thể tìm nhiều mã trong một ô bằng cách che mã đã đọc rồi quét tiếp.
- App ưu tiên học sinh chưa trả lời, xác nhận đáp án thích ứng 1–3 lần theo độ rõ của QR và xử lý kết quả theo lô để giảm giật.
- Trạng thái trên điện thoại hiển thị số học sinh đã ghi nhận / tổng sĩ số.

Để quét cả lớp tốt nhất: dùng thẻ PDF do app tạo, giữ QR phẳng, đủ sáng, không che góc mã, điện thoại nằm ngang và để toàn bộ học sinh trong khung hình. Khoảng cách tối đa phụ thuộc độ phân giải camera, kích thước QR in và ánh sáng thực tế.


## Quét QR true multi realtime (2026-08-19)

- Engine điện thoại dùng **ZXing-C++ WebAssembly (`zxing-wasm`)** để đọc **nhiều QR trong một frame**, `maxNumberOfSymbols: 64`.
- Mỗi lần decode xử lý **toàn bộ khung hình**; không giới hạn vùng giữa.
- Camera ưu tiên **1080p**, fallback **720p**, camera sau và continuous autofocus nếu thiết bị hỗ trợ.
- Kết quả của mỗi frame được chuẩn hóa thành `[{studentId, answer}, ...]` và lưu tại runtime để xử lý đồng thời nhiều học sinh.
- Kết quả cũ được giữ khi giáo viên lia camera; cùng học sinh không bị ghi trùng, nhưng đáp án mới được cập nhật sau khi xác nhận ổn định.
- Điện thoại gửi các đáp án mới theo **một batch WebSocket** (`scan_response_batch`) để giảm số message và giảm render trên máy tính.
- Khung nhận diện được vẽ trên từng QR đang thấy; bộ đếm vẫn hiển thị **Đã quét x/y học sinh**.
- `BarcodeDetector + jsQR` chỉ là đường fallback nếu WASM multi không tải được.


## Quiz Nghiêng Đầu - khóa khuôn mặt + vùng chết
- Khóa người chơi phía trước camera, không tự nhảy sang khuôn mặt phía sau.
- Lấy NEUTRAL nhiều frame; dùng DEAD_ZONE / ANSWER_THRESHOLD / HOLD_TIME.
- Chỉ nhận hướng khi chuyển động rõ và giữ ổn định 150-300ms.
- Sau mỗi đáp án phải trở lại NEUTRAL mới nhận động tác tiếp theo.
- Mất khuôn mặt ngắn vẫn giữ khóa/tracking.

## Tích điểm - Tổng hợp theo ngày
- Phần **Tích điểm** có thêm cột **Tổng hợp Cộng/Trừ Điểm** bên cạnh công cụ nhập điểm trên màn hình lớn.
- Có thể chọn **Ngày thực hiện** khi cộng/trừ điểm và chọn **Ngày kiểm tra** ở cột tổng hợp.
- Cột tổng hợp hiển thị tổng điểm cộng, tổng điểm trừ, số học sinh đã được cập nhật và từng nội dung thực hiện trong ngày.
- Dữ liệu lịch sử cũ vẫn tương thích; dữ liệu mới có `batchId`, `category`, `note`, `targetType` và `targetLabel` để tổng hợp chính xác hơn.


## Trò chơi Đuổi hình bắt chữ

Bản này bổ sung trò **Đuổi hình bắt chữ** trong Góc Trò Chơi mà không thay đổi các trò chơi hiện có.

- Chọn Khối 1–5, thời gian cho mỗi câu, âm thanh.
- Thư viện riêng: thêm/sửa/xóa/xóa tất cả/chọn câu để chơi.
- Gemini tạo đáp án + gợi ý phù hợp khối lớp, sau đó tạo 1–3 hình minh họa cho mỗi câu.
- Ảnh do AI hoặc giáo viên tải lên được lưu cục bộ trong IndexedDB của trình duyệt; metadata câu hỏi vẫn lưu theo cơ chế dữ liệu hiện tại.
- Khi bắt đầu, trò chơi mở fullscreen; hết thời gian tự hiện đáp án; có Bắt đầu / Câu tiếp theo / Hiện đáp án / Chơi lại / Thoát.
- API mới: `POST /api/duoi-hinh` dùng cùng Google Gemini API Key giáo viên đã nhập trong Góc Trò Chơi. Key chỉ được gửi trong request và không ghi vào GitHub.

Lưu ý: tạo ảnh AI sử dụng quota của model hình ảnh Gemini và có thể chậm hơn tạo câu hỏi văn bản.
