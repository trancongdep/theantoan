# EVNHCMC – Tra cứu Phiếu công tác & Lệnh công tác (GitHub Pages)

Ứng dụng web tĩnh (`index.html`) chạy hoàn toàn trên **GitHub Pages + GitHub Actions**, tự động đăng nhập `https://appct.evnhcmc.vn` và lấy danh sách **Phiếu công tác (PCT)** và **Lệnh công tác (LCT)** trong ngày hôm qua và ngày hôm nay — **không cần chạy Antigravity**, **không bị lỗi CORS**, và **không lộ mật khẩu trong mã nguồn**.

## Vì sao cần GitHub Actions đi kèm `index.html`?
- Máy chủ API `https://appctapi.evnhcmc.vn` chỉ cho phép CORS từ tên miền `https://appct.evnhcmc.vn` (từ chối gọi trực tiếp từ `*.github.io`).
- Dùng **GitHub Actions** chạy script Python `scripts/fetch_appct.py` định kỳ (mỗi 30 phút hoặc bấm chạy tay bất cứ lúc nào), dữ liệu được xuất ra `data/tickets.json` và hiển thị ngay trên `index.html`.
- Tài khoản và mật khẩu được lưu mã hóa trong **GitHub Secrets**, tuyệt đối không lưu trong file HTML.

---

## Hướng dẫn đưa lên GitHub (4 bước)

### Bước 1: Tạo Repository trên GitHub và đẩy mã nguồn lên
Tạo 1 repository mới trên GitHub (khuyến nghị chọn **Private** nếu không muốn người ngoài xem dữ liệu nội bộ, hoặc **Public** nếu dùng GitHub Pages gói Free).

Chạy các lệnh sau trong thư mục dự án:
```bash
git init
git add .
git commit -m "init: EVNHCMC PCT/LCT dashboard"
git branch -M main
git remote add origin https://github.com/<TEN-GITHUB-CUA-BAN>/<TEN-REPO>.git
git push -u origin main
```

### Bước 2: Cấu hình tài khoản đăng nhập (GitHub Secrets)
Vào repo trên GitHub → **Settings** → **Secrets and variables** → **Actions** → bấm **New repository secret** và thêm 2 biến:
1. `APPCT_USERNAME` = `deptc`
2. `APPCT_PASSWORD` = `<mật khẩu của bạn>`

### Bước 3: Bật quyền ghi cho GitHub Actions & chạy đồng bộ lần đầu
1. Vào **Settings** → **Actions** → **General** → mục **Workflow permissions**, chọn **Read and write permissions** → **Save**.
2. Vào tab **Actions** → chọn workflow **Đồng bộ Phiếu & Lệnh công tác EVNHCMC** → bấm **Run workflow**.
3. Sau ~20 giây, file `data/tickets.json` sẽ tự động được cập nhật. Từ đó về sau GitHub sẽ tự chạy mỗi **30 phút**.

### Bước 4: Bật GitHub Pages
1. Vào **Settings** → **Pages**.
2. Ở mục **Build and deployment** → **Source**: chọn **Deploy from a branch**.
3. **Branch**: chọn `main` và thư mục `/ (root)` → bấm **Save**.
4. Chờ ~1 phút, mở đường link `https://<TEN-GITHUB-CUA-BAN>.github.io/<TEN-REPO>/` trên máy tính hoặc điện thoại để sử dụng!

---

## Tùy chọn nâng cao: Truy vấn trực tiếp theo ngày bất kỳ (Cloudflare Worker)
Nếu bạn muốn nút **⚡ Truy vấn trực tiếp** trên `index.html` có thể đăng nhập và chọn bất kỳ khoảng ngày nào theo thời gian thực ngay trên trình duyệt:
1. Tạo tài khoản miễn phí tại [Cloudflare Workers](https://workers.cloudflare.com/).
2. Tạo Worker mới và dán nội dung file `cloudflare-worker/worker.js` vào rồi bấm **Deploy**.
3. Mở trang web GitHub Pages của bạn → bấm **⚡ Truy vấn trực tiếp** → dán URL Worker (VD: `https://appct-proxy.xxx.workers.dev`) → nhập user/pass và chọn ngày để tải trực tiếp.

## Chạy cập nhật nhanh trên máy tính cá nhân (nếu muốn)
```powershell
$env:APPCT_USERNAME="deptc"
$env:APPCT_PASSWORD="your-password"
python scripts/fetch_appct.py
```
Sau đó mở trực tiếp file `index.html` bằng trình duyệt (vẫn xem được ngay cả khi mở qua `file://`).
