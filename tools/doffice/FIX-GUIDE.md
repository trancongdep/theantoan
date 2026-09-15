# Hướng dẫn khắc phục - Dashboard GitHub Pages

## Vấn đề đã phát hiện

Khi chạy Diagnostics, thấy:
- ✅ Repo: trancongdep/theantoan — OK
- ✅ PAT scopes: gist, repo, workflow — OK
- ✅ Tìm thấy 1 workflow(s): `pages-build-deployment`
- ⚠️ Không tìm thấy workflow `process.yml`
- ⚠️ status.json chưa có
- ⚠️ Lỗi kiểm tra gist: 403

## Nguyên nhân gốc

**File workflow đang ở sai vị trí:**
```
❌ tools/doffice/.github/workflows/process.yml   <- GitHub KHÔNG nhận diện
✅ .github/workflows/process.yml                <- Đây mới là đúng
```

GitHub Actions chỉ nhận diện workflow trong `.github/workflows/` ở **gốc repo** (root), không phải trong thư mục con. Vì vậy:
- API `GET /actions/workflows` chỉ trả về `pages-build-deployment`
- Khi bấm "Xử lý", dashboard trigger `pages-build-deployment` (3 lần chạy gần nhất success/cancelled đó chính là nó)

## Cách khắc phục

### Bước 1: Tạo workflow ở gốc repo

Trong repo `trancongdep/theantoan` trên GitHub, tạo file mới:
**Đường dẫn**: `.github/workflows/process.yml` (ở root, không phải trong tools/doffice/)

Nội dung file: copy từ `github/workflow-root.yml` trong project.

### Bước 2: Push updated index.html

Copy file `github/index.html` đã cập nhật lên `tools/doffice/index.html` trong repo.

### Bước 3: Xóa workflow cũ (tùy chọn)

Để tránh nhầm lẫn, có thể xóa `tools/doffice/.github/workflows/process.yml`.

### Bước 4: Kiểm tra lại

Mở dashboard → bấm **🔍 Kiểm tra cài đặt**. Bây giờ sẽ thấy:
- ✅ Tìm thấy 2 workflows: `pages-build-deployment` + `D-Office Processing`
- Workflow có path `.github/workflows/process.yml` và state `active`

### Bước 5: Chạy workflow

Bấm **⚡ Xử lý**. Workflow `D-Office Processing` sẽ chạy, xử lý văn bản và commit `status.json` vào `tools/doffice/status.json`.

## Lỗi Gist 403

Nếu không cần real-time updates, **bỏ trống Gist ID** trong ⚙️ Cài đặt.
Dashboard sẽ tự động fallback đọc từ `status.json` trong repo.

Nếu muốn dùng Gist, cần:
1. Tạo Gist public tại https://gist.github.com/
2. File tên: `status.json`, nội dung: `{}`
3. Copy Gist ID (phần sau `/` trong URL)
4. Paste vào dashboard

## Thay đổi trong code mới

### `index.html`
- `settings.statusPath` mặc định: `'tools/doffice/status.json'`
- Đọc `status.json` qua `raw.githubusercontent.com` (cache-busting) → fallback GitHub Contents API
- Gist fetch lỗi → fallback silently

### `workflow-root.yml`
- `defaults.run.working-directory: tools/doffice`
- Tất cả `run:` steps chạy trong `tools/doffice/`
- Workflow ở root `.github/workflows/process.yml`