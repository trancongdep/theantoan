# Zoom Web Meet Pro - Nền tảng Họp Trực tuyến & Đào tạo ATVSLĐ

> Hệ thống hội nghị truyền hình HTML/JS thuần (Single-Page Application) chạy trực tiếp trên **GitHub Pages**, tích hợp quản trị tài khoản **Google Sign-In**, đồng bộ thời gian thực qua **Firebase** và chia sẻ dữ liệu qua **Google Drive**.

---

## 👑 Tài khoản Quản trị viên Tối cao (Super Admin)
- **Email Admin:** `deptc.gvatvsld@gmail.com`
- **Quyền hạn đặc quyền:**
  - Mở khóa **Bảng Quản Trị Tối Cao (Super Admin Dashboard)**.
  - Khóa phòng họp (*Lock Meeting*), kích hoạt phòng chờ (*Waiting Room*).
  - Buộc tắt micro toàn bộ phòng (*Force Mute All*), tắt camera học viên.
  - Kích thành viên ra khỏi phòng (*Kick*), phân quyền Phó phòng (*Co-Host*).
  - Quản lý cấu hình Firebase Realtime Database và thư mục Google Drive.
  - Xem và quản lý **Nhật ký an ninh (Audit Logs)** theo thời gian thực.
  - Quyền kết thúc cuộc họp cho tất cả thành viên (*End Meeting for All*).

---

## 🚀 Tính năng Nổi bật

1. **Giao diện chuẩn Zoom Meeting (Dark Mode):**
   - Lưới video tương tác đa thành viên, tự động nhận diện người đang phát biểu (vòng hào quang xanh lục nhấp nháy).
   - Chuyển đổi linh hoạt giữa **Chế độ Lưới (Gallery View)** và **Chế độ Diễn giả (Speaker View)**.
   - Ghim video diễn giả (*Pin Speaker*), phóng to toàn màn hình.
   - Thanh điều khiển trực quan: Bật/Tắt Mic, Bật/Tắt Camera, Chia sẻ Màn hình, Trò chuyện, Người tham gia, Cài đặt âm thanh/video, Hình nền ảo (*Virtual Background*).

2. **Chia sẻ Màn hình & Bảng trắng tương tác (Whiteboard):**
   - Trình chiếu slide bài giảng an toàn lao động trực tiếp trong cuộc họp.
   - Bảng trắng vẽ tay đa màu sắc, điều chỉnh nét vẽ, tẩy xóa và **lưu bản ghi trực tiếp vào Google Drive của Admin**.

3. **Tương tác & Biểu cảm (Reactions & Raise Hand):**
   - Thả biểu cảm cảm xúc (👏, 👍, ❤️, 😂, 😮, 🎉) với hiệu ứng bay nổi trên ô video.
   - Tính năng **Giơ tay phát biểu (✋)** có âm báo và thông báo danh sách chờ cho Admin.

4. **Đồng bộ thời gian thực qua Firebase:**
   - Sử dụng **Firebase Realtime Database / Firestore** làm kênh phát tín hiệu (*Signaling Channel*) cho WebRTC và lưu trữ trạng thái phòng họp.
   - Hỗ trợ công nghệ `BroadcastChannel` và `localStorage sync` cho phép mở nhiều tab/cửa sổ trên cùng máy tính để thử nghiệm tương tác hai chiều tức thì mà không cần cài đặt thêm server.

5. **Kho lưu trữ Dữ liệu Google Drive:**
   - Kết nối trực tiếp với tài khoản Google Drive của `deptc.gvatvsld@gmail.com`.
   - Danh mục tài liệu có sẵn: Tài liệu quy trình ATVSLĐ (.pdf), Slide bài giảng (.pptx), Bảng kiểm tra hiện trường (.xlsx), Biên bản họp (.docx), Video huấn luyện (.mp4).
   - Cho phép tải tệp mới lên hoặc dán liên kết Google Drive để chia sẻ ngay vào khung chat phòng họp.

---

## 🛠️ Hướng dẫn Triển khai lên GitHub Pages (3 Bước)

### Bước 1: Tạo Repository trên GitHub
1. Đăng nhập vào [GitHub](https://github.com).
2. Tạo một Repository mới (ví dụ: `zoom-web-meet` hoặc `gvatvsld-meeting`). Chọn chế độ **Public**.

### Bước 2: Đẩy mã nguồn lên Repository
Giải nén bộ tệp này và tải lên Repository của bạn:
- Đổi tên tệp `zoom_web_meeting.html` thành `index.html`.
- Commit và Push lên nhánh `main`.

```bash
git init
git add .
git commit -m "Khởi tạo hệ thống Zoom Web Meet ATVSLD"
git branch -M main
git remote add origin https://github.com/<tai-khoan-cua-ban>/zoom-web-meet.git
git push -u origin main
```

### Bước 3: Kích hoạt GitHub Pages
1. Trong Repository trên GitHub, vào mục **Settings** -> **Pages**.
2. Tại mục **Build and deployment** -> **Source**, chọn **Deploy from a branch**.
3. Chọn nhánh **main** và thư mục `/(root)`, sau đó nhấn **Save**.
4. Sau 1 - 2 phút, GitHub sẽ cung cấp đường link truy cập trực tiếp có dạng:
   `https://<tai-khoan-cua-ban>.github.io/zoom-web-meet/`

---

## ⚙️ Hướng dẫn Cấu hình Firebase & Google Cloud Console

### 1. Cấu hình Firebase (Cho dữ liệu thời gian thực):
1. Truy cập [Firebase Console](https://console.firebase.google.com/).
2. Tạo dự án mới (ví dụ: `zoom-gvatvsld-live`).
3. Vào mục **Build** -> **Realtime Database** -> Nhấn **Create Database**.
4. Vào tab **Rules** và dán nội dung từ tệp `firebase-rules.json`.
5. Vào **Project Settings** -> **General** -> Mục **Your apps** -> Chọn biểu tượng Web (`</>`) để lấy `firebaseConfig` (gồm `apiKey`, `projectId`, `databaseURL`).
6. Mở ứng dụng Zoom Web -> Chọn nút **Admin Control** -> Tab **Cấu hình Firebase & Google API** -> Nhập các thông số và bấm **Lưu cấu hình**.

### 2. Cấu hình Google Identity Services & Google Drive API:
1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) bằng tài khoản `deptc.gvatvsld@gmail.com`.
2. Tạo dự án mới: `GVATVSLD-Meeting-Platform`.
3. Bật các API cần thiết tại **APIs & Services** -> **Library**:
   - **Google Drive API**
   - **Google Identity Services (OAuth 2.0)**
4. Vào mục **Credentials** -> Nhấn **Create Credentials** -> Chọn **OAuth Client ID**:
   - Application type: **Web application**.
   - Authorized JavaScript origins: Thêm URL GitHub Pages của bạn (ví dụ: `https://<tai-khoan>.github.io`).
   - Authorized redirect URIs: Thêm URL GitHub Pages của bạn.
5. Sao chép **Client ID** dán vào mục cấu hình Google Drive trong Bảng Quản trị Admin của ứng dụng.

---

## 🔒 Kiểm tra Quyền Super Admin
- Khi mở ứng dụng, nhấn vào góc trên bên phải (Huy hiệu tài khoản Google).
- Chọn tài khoản **deptc.gvatvsld@gmail.com**.
- Biểu tượng vương miện 👑 vàng và nút **Admin Control** sẽ xuất hiện, cho phép toàn quyền kiểm soát phòng họp.

---
*Phát triển phục vụ công tác Quản lý Huấn luyện & Đào tạo An toàn Vệ sinh Lao động.*
