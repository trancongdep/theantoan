# LĐCT-OPMS v1.1 — Hệ thống Quản lý Vận hành Lưới điện 110–220kV

Hệ thống quản lý kiểm tra định kỳ, chẩn đoán CBM (CHI) và khảo sát hiện trường lưới điện cao thế 110–220kV (Đội QLLĐ 2 — Công ty Lưới điện Cao thế TP.HCM) tuân thủ **4086/QĐ-EVNHCMC**, **QT 278/QĐ-EVN**, **QCVN 25:2025/BCT** và **3255/QĐ-EVNHCMC**.

## Tính năng chính
- **Quản lý danh mục Đường dây & Trụ điện (`assets-config.html`)**: Tải về danh mục mẫu (`.xlsx`), xuất danh mục hiện có để cập nhật và tải lên hàng loạt (có xem trước, kiểm tra lỗi và đồng bộ song song Firebase + Google Sheets `DM_Tuyen_Tru`).
- **Quản lý Người dùng & Phân quyền RBAC (`users-rbac.html`)**: 4 vai trò (`CAPTAIN`, `TEAM_LEAD`, `INSPECTOR`, `VIEWER`), hỗ trợ tải mẫu Excel, nhập hàng loạt và phân quyền trước theo Email (`pending_users`) khi nhân sự chưa đăng nhập lần đầu.
- **Giao việc & Thực địa (`task-assign.html`, `patrol-field.html`, `tech-cbm.html`, `survey-report.html`)**: Gợi ý tuyến & trụ từ danh mục, check-in GPS, nén ảnh kèm watermark GPS/giờ, lưu hàng đợi Offline IndexedDB và xuất biên bản PDF lên Google Drive.
- **Tồn tại & Xuất PMIS (`defects-pmis.html`)**: Duyệt biên bản 2 cấp, đóng tồn tại và xuất CSV chuẩn PMIS trong hạn SLA 24–48 giờ.

## Triển khai
1. Đẩy toàn bộ thư mục này lên GitHub Repository và bật **GitHub Pages** (`main` / root).
2. Dán `backend_gas/Code.gs` vào Apps Script của Google Sheet `LDCT_OPMS_Database_v1`, chạy `setupDatabase()` 1 lần và triển khai lại Web App.
3. Dán `backend_gas/firebase.rules.json` vào **Firebase Realtime Database -> Rules** và nhấn **Publish**.
