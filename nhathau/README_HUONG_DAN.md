# HỆ THỐNG QUẢN LÝ AN TOÀN NHÀ THẦU (CSMS PORTAL)

Bộ mã nguồn các phân hệ còn lại (Bước 3 & Bước 4) chạy trên GitHub Pages, kết nối Firebase Realtime Database, Google Drive và Google Sheets.

## Danh sách các file trong gói này:
1. `dashboard.html`: Trang tổng quan KPI (Số nhà thầu, nhân sự, gói việc, giấy phép) và tự động quét cảnh báo hồ sơ/chứng chỉ/thẻ sắp hết hạn trong vòng 30 ngày.
2. `sra-list.html`: Danh sách và khởi tạo Gói công việc (Safety Risk Assessment - SRA), gắn nhà thầu, khu vực, giám sát, người duyệt cấp 1/2, mối nguy và khóa học bắt buộc.
3. `sra-detail.html`: Chi tiết Gói công việc — duyệt SRA, gửi email thông báo 2 chiều, đưa nhân sự/thiết bị vào gói việc, chấm điểm đào tạo an toàn, cấp & in Thẻ QR ra vào cổng, đóng gói việc & đánh giá nhà thầu sau nghiệm thu.
4. `ptw.html`: Quản lý Giấy phép làm việc hàng ngày (Daily PTW) — tạo phép từ mẫu, nhà thầu nộp ảnh/biên bản minh chứng từng tiêu chí lên Google Drive, cán bộ HSE duyệt từng dòng và xuất bản in PDF.
5. `gate-check.html`: Trạm kiểm soát ra vào cổng dành cho Bảo vệ — quét mã QR trực tiếp bằng camera điện thoại/laptop hoặc tra cứu theo CCCD, tự động chặn nếu hồ sơ hoặc thẻ hết hạn và ghi nhật ký đồng bộ Google Sheets.

## Lưu ý triển khai:
- Tải toàn bộ 5 file `.html` này đặt ngang hàng với `index.html`, `config.html`, `users.html`, `contractors.html` trên repository GitHub của anh.
- Trong file `index.html`, anh cập nhật dòng chuyển hướng sau khi đăng nhập thành công từ `config.html` sang `dashboard.html` để người dùng vào thẳng màn hình Tổng quan.
