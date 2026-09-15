# D-Office Dashboard - GitHub Pages + Actions

Dashboard xử lý văn bản D-Office chạy trên GitHub Pages, không cần server trên PC.

## Cấu trúc

```
├── index.html              # Dashboard (GitHub Pages)
├── status.json             # Trạng thái (auto-update bởi Actions)
├── data.json               # Dữ liệu persistent (auto-update)
├── package.json            # Dependencies
├── scripts/
│   └── processor.js        # Script xử lý (chạy trong Actions)
├── .github/
│   └── workflows/
│       └── process.yml     # GitHub Actions workflow
└── README.md
```

## Cách hoạt động

```
GitHub Actions (30 phút / manual)
  → Đăng nhập D-Office (Playwright)
  → Lấy danh sách công việc
  → Tải file + upload Google Drive (Service Account)
  → Cập nhật Google Sheet
  → Ghi status.json + commit vào repo

GitHub Pages (index.html)
  ← Đọc status.json qua GitHub API
  ← Đọc danh sách từ Google Sheet CSV
  → Kích hoạt Actions qua workflow_dispatch
  → Polling cập nhật mỗi 10-60 giây
```

## Hướng dẫn cài đặt

### Bước 1: Tạo GitHub Repository

1. Tạo repo mới trên GitHub (public hoặc private)
2. Copy tất cả files trong thư mục `github/` vào repo
3. Push lên GitHub

### Bước 2: Tạo Google Service Account

1. Vào [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới (hoặc chọn project có sẵn)
3. Enable **Google Drive API** và **Google Sheets API**
4. Vào **IAM & Admin > Service Accounts > Create Service Account**
5. Tạo JSON key cho service account
6. Ghi nhớ email của service account (vd: `doffice-bot@project.iam.gserviceaccount.com`)
7. Mở [Google Drive folder](https://drive.google.com/drive/folders/1VkN7uGemD3dm0kZKysFJzBruGPHtXxWI)
8. Share folder với service account email (Editor permission)

### Bước 3: Tạo GitHub Gist (tùy chọn - cho real-time updates)

1. Vào https://gist.github.com/ tạo Gist mới
2. Tên file: `status.json`, nội dung: `{}`
3. Ghi nhớ Gist ID (phần sau `/` trong URL)

### Bước 4: Tạo GitHub Personal Access Token (PAT)

1. Vào GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate new token (classic)
3. Chọn scopes: `repo`, `workflow`, `gist`
4. Copy token

### Bước 5: Thêm GitHub Secrets

Vào repo > Settings > Secrets and variables > Actions > New repository secret:

| Secret Name | Giá trị |
|---|---|
| `DOFFICE_USERNAME` | `hcmpc\deptc` |
| `DOFFICE_PASSWORD` | `Dtc@01102026` |
| `GOOGLE_SERVICE_ACCOUNT` | Nội dung JSON key từ Bước 2 (toàn bộ file JSON) |
| `DRIVE_FOLDER_ID` | `1VkN7uGemD3dm0kZKysFJzBruGPHtXxWI` |
| `GIST_ID` | Gist ID từ Bước 3 (tùy chọn) |
| `PAT_TOKEN` | PAT từ Bước 4 (tùy chọn, cho Gist updates) |

### Bước 6: Enable GitHub Pages

1. Vào repo > Settings > Pages
2. Source: **Deploy from a branch**
3. Branch: `main` / `/ (root)`
4. Save
5. Đợi ~1 phút, GitHub Pages sẽ online tại `https://USERNAME.github.io/REPO_NAME/`

### Bước 7: Cấu hình Dashboard

1. Mở dashboard tại `https://USERNAME.github.io/REPO_NAME/`
2. Bấm nút **⚙️ Cài đặt**
3. Nhập: GitHub Username, Repository Name, PAT token, Gist ID
4. Bấm **Lưu**

## Sử dụng

- **Tự động**: GitHub Actions chạy mỗi 30 phút (7:00-17:00, Thứ 2-Thứ 6)
- **Thủ công**: Bấm nút **⚡ Xử lý** trên dashboard
- **Làm mới**: Bấm **🔄 Làm mới** để cập nhật số liệu
- **Cài đặt**: Bấm **⚙️ Cài đặt** để thay đổi cấu hình

## API Endpoints sử dụng

| Endpoint | Chức năng |
|---|---|
| `GET /repos/USER/REPO/contents/status.json` | Đọc status (bypass cache) |
| `GET /gists/GIST_ID` | Đọc real-time progress |
| `POST /repos/USER/REPO/actions/workflows/process.yml/dispatches` | Kích hoạt xử lý |

## Lưu ý

- GitHub Actions free tier: 2,000 phút/tháng (mỗi lần chạy ~2-3 phút)
- D-Office WAF có thể block GitHub Actions IPs - cần test
- Google Service Account token tự động refresh (không cần OAuth2)
- Dashboard lưu PAT trong localStorage (không gửi lên server nào khác)
