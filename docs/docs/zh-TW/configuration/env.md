# 環境變數設定指南

Rin 部署需要設定兩類環境變數：**Variables（明文變數）** 與 **Secrets（加密變數）**。

## 快速區分

| 類型 | 儲存方式 | 用途 | 範例 |
|------|---------|------|------|
| **Variables** | 以明文儲存在 `wrangler.toml` | 設定參數、功能開關 | 儲存桶名稱、快取模式 |
| **Secrets** | 加密儲存在 Cloudflare | 敏感憑證、金鑰 | API 金鑰、密碼、Token |

---

## Variables（明文變數）

這些變數以明文儲存在 `wrangler.toml` 或 GitHub Actions 中，用於設定功能開關與基本參數。

### 站台設定

| 變數名稱 | 必填 | 描述 | 預設值 |
|--------|------|------|--------|
| `NAME` | 否 | 網站名稱 | Rin |
| `DESCRIPTION` | 否 | 網站描述 | A lightweight personal blogging system |
| `AVATAR` | 否 | 網站頭像 URL | - |
| `PAGE_SIZE` | 否 | 預設分頁大小 | 5 |
| `RSS_ENABLE` | 否 | 啟用 RSS 連結 | false |
| `FRONTEND_URL` | 否 | 站台根位址（sitemap.xml 與 robots.txt 產生基準，多網域部署時建議設定） | 請求 origin |

:::tip
站台設定可在部署後透過**設定頁面**修改，環境變數僅作為初始值。
:::

### 儲存設定

| 變數名稱 | 必填 | 描述 | 預設值 | 範例 |
|--------|------|------|--------|------|
| `S3_FOLDER` | 是 | 圖片儲存路徑 | images/ | `images/` |
| `S3_CACHE_FOLDER` | 否 | 快取檔案路徑 | cache/ | `cache/` |
| `S3_BUCKET` | 是 | S3 儲存桶名稱 | - | `my-bucket` |
| `S3_REGION` | 是 | S3 區域（R2 填 auto） | - | `auto` |
| `S3_ENDPOINT` | 是 | S3 接入點位址 | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | 否 | 對外存取位址 | 同 S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | 否 | 強制路徑樣式 | false | `false` |

### 功能開關

| 變數名稱 | 必填 | 描述 | 預設值 | 建議值 |
|--------|------|------|--------|--------|
| `CACHE_STORAGE_MODE` | 否 | 快取模式：s3/database | s3 | **database** |
| `WEBHOOK_URL` | 否 | 留言通知 Webhook | - | - |
| `RSS_TITLE` | 否 | RSS 標題 | Rin Development | - |
| `RSS_DESCRIPTION` | 否 | RSS 描述 | Development Environment | - |
| `MCP_ALLOWED_HOSTS` | 否 | MCP 服務端允許的額外網域，以英文逗號分隔（預設允許 `FRONTEND_URL`、本機位址與 `*.workers.dev`）。支援含協定或連接埠的寫法（`https://blog.example.com:443`）、萬用網域（`*.example.com`）與 `*`（關閉網域白名單，僅限可信環境） | - | `blog.example.com,www.example.com` |

:::tip 新使用者建議
建議將 `CACHE_STORAGE_MODE` 設為 `database`，無需額外設定 S3 快取即可使用，降低部署複雜度。
:::

---

## Secrets（加密變數）

這些敏感資訊必須設定為 **Cloudflare Workers Secrets**，部署時透過命令列輸入或事先設定。

### 驗證相關

| 變數名稱 | 必填 | 描述 | 取得方式 |
|--------|------|------|----------|
| `ADMIN_USERNAME` | 條件 | 帳號密碼登入的使用者名稱 | 自行設定 |
| `ADMIN_PASSWORD` | 條件 | 帳號密碼登入的密碼 | 自行設定 |
| `RIN_GITHUB_CLIENT_ID` | 條件 | GitHub OAuth 用戶端 ID | GitHub OAuth App 設定 |
| `RIN_GITHUB_CLIENT_SECRET` | 條件 | GitHub OAuth 用戶端金鑰 | GitHub OAuth App 設定 |
| `RIN_GITEE_CLIENT_ID` | 條件 | Gitee OAuth 用戶端 ID | Gitee OAuth App 設定 |
| `RIN_GITEE_CLIENT_SECRET` | 條件 | Gitee OAuth 用戶端金鑰 | Gitee OAuth App 設定 |
| `RIN_QQ_TOKEN` | 條件 | 心月互聯 QQ 登入 Token | 心月互聯 https://qq.wch666.com/ 申請 |
| `RIN_WECHAT_APPID` | 條件 | 聚合登入 WeChat 應用程式 ID | 聚合登入 https://login.mapay.cn/ 申請 |
| `RIN_WECHAT_APPKEY` | 條件 | 聚合登入 WeChat 應用程式金鑰 | 聚合登入 https://login.mapay.cn/ 申請 |
| `EMAIL_SEND_URLS` | 條件 | MailPort 寄件位址（JSON 陣列，可填多個；僅一個寄件端點時可省略陣列括號，詳見下方「填寫格式」） | 部署 [MailPort](https://github.com/wool-hmq/mailport) 後於寄件端點頁面取得 |
| `EMAIL_SEND_KEYS` | 條件 | MailPort API 金鑰（JSON 陣列或單一字串，與 `EMAIL_SEND_URLS` 依序一一對應） | MailPort 寄件端點頁面產生 |
| `EMAIL_RESEND_URL` | 條件 | 舊版郵件轉發服務 URL（部署於 Vercel 的 Rin-Email 專案位址），未設定 `EMAIL_SEND_URLS` 時回退使用 | 自行部署 Rin-Email 到 Vercel 取得 |
| `EMAIL_RESEND_PASS` | 條件 | 舊版郵件轉發服務驗證密碼（與 Vercel 專案中的 EMAIL_PASS 相同） | 自行設定 |
| `JWT_SECRET` | **是** | JWT 簽章金鑰（任意隨機字串） | 自行產生 |

:::warning 驗證要求
至少設定以下驗證方式中的 **一種**：
- GitHub OAuth（`RIN_GITHUB_CLIENT_ID` + `RIN_GITHUB_CLIENT_SECRET`）
- Gitee OAuth（`RIN_GITEE_CLIENT_ID` + `RIN_GITEE_CLIENT_SECRET`）
- QQ 登入（`RIN_QQ_TOKEN`）
- 微信登入（`RIN_WECHAT_APPID` + `RIN_WECHAT_APPKEY`）
- 電子郵件驗證碼登入（`EMAIL_SEND_URLS` + `EMAIL_SEND_KEYS`，或舊的 `EMAIL_RESEND_URL` + `EMAIL_RESEND_PASS`）
- 帳號密碼登入（`ADMIN_USERNAME` + `ADMIN_PASSWORD`）

否則無法登入後台。
:::

:::note 電子郵件驗證碼架構
Rin 部落格執行於 Cloudflare Workers 上，不支援原始 TCP SMTP。電子郵件驗證碼功能透過 [MailPort](https://github.com/wool-hmq/mailport) 寄件服務實作：

1. 部署 MailPort 專案，建立寄件端點並設定寄件方式（SMTP / HTTP API / Outlook 或 Gmail OAuth）
2. Rin 部落格收到傳送驗證碼請求後，呼叫 `EMAIL_SEND_URLS` 中的寄件介面，以 `Authorization: Bearer <EMAIL_SEND_KEYS>` 驗證
3. 允許的收件網域在 MailPort 寄件端點設定中管理

`EMAIL_SEND_URLS` 與 `EMAIL_SEND_KEYS` 依序一一對應、輪詢使用：第一個失敗會自動嘗試下一個，全部失敗才回報錯誤。

未設定 `EMAIL_SEND_URLS` 時，回退到舊的 `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email 專案）。

**填寫格式**

`EMAIL_SEND_URLS` 是寄件位址的 JSON 陣列，每個元素是 MailPort 寄件端點的完整寄件位址，形如 `https://<你的網域>/api/<寄件端點ID>/send`；`EMAIL_SEND_KEYS` 是與之對應的 API 金鑰，同樣可以是 JSON 陣列。

只用一個寄件端點時，`EMAIL_SEND_KEYS` 可以直接寫成一般字串，無需陣列括號：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

使用多個寄件端點，且每個寄件端點的金鑰各不相同時，兩個陣列依索引一一對應：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

使用多個寄件端點，但共用同一組金鑰時，`EMAIL_SEND_KEYS` 只寫一個即可，會自動套用到所有位址：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

當 `EMAIL_SEND_KEYS` 提供多個值時，其數量必須與 `EMAIL_SEND_URLS` 一致（或只提供一個金鑰供所有位址共用），數量不符會在傳送時直接回報錯誤。
:::

:::note 郵件驗證碼圖片（人機驗證）
郵件自助友連（申請／修改／刪除）在使用者寄出第一封郵件時，會先要求辨識一封含驗證碼圖片的郵件，防止自動化濫用：

1. 使用者向收件位址寄出「友链申请／友链修改／友链删除」
2. Rin 產生一張帶干擾線／干擾點的驗證碼圖片（4 位字元），以**內嵌圖片**形式傳送到使用者信箱
3. 使用者辨識圖片中的字元，在新郵件本文中只回覆這 4 位字元
4. 驗證通過後進入一般的 JSON 範本流程

此功能依賴 MailPort 的內嵌圖片能力，**無需新增任何環境變數**，直接沿用 `EMAIL_SEND_URLS` + `EMAIL_SEND_KEYS`。舊版 Rin-Email 中繼不支援內嵌圖片，若仍在使用舊中繼，驗證碼步驟會自動略過。
:::

### S3 儲存憑證

| 變數名稱 | 必填 | 描述 | 取得方式 |
|--------|------|------|----------|
| `S3_ACCESS_KEY_ID` | 條件 | S3 存取金鑰 ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | 條件 | S3 存取金鑰 | R2 API Token |

:::tip
當 `CACHE_STORAGE_MODE=database` 時，S3 儲存憑證為選用設定，僅圖片上傳功能需要。
:::

### Cloudflare 繫結（非環境變數）

以下為 Cloudflare Worker 繫結，透過 `wrangler.toml` 設定，不屬於環境變數：

| 繫結名稱 | 類型 | 描述 |
|--------|------|------|
| `DB` | D1 Database | 資料庫繫結 |
| `ASSETS` | R2 / Static Assets | 靜態資源繫結（選用） |
| `AI` | AI | Cloudflare AI 模型繫結 |

---

## GitHub Actions 變數設定

使用 GitHub Actions 自動部署時，需在 Repository 設定中配置以下變數：

### Repository Variables（Settings → Secrets and variables → Variables）

| 變數名稱 | 必填 | 描述 | 預設值 |
|--------|------|------|--------|
| `NAME` | 否 | 網站名稱 | Rin |
| `DESCRIPTION` | 否 | 網站描述 | A lightweight personal blogging system |
| `AVATAR` | 否 | 網站頭像 URL | - |
| `PAGE_SIZE` | 否 | 分頁大小 | 5 |
| `RSS_ENABLE` | 否 | 是否啟用 RSS | false |
| `CACHE_STORAGE_MODE` | 否 | 快取模式 | s3 |
| `S3_CACHE_FOLDER` | 否 | 快取檔案路徑 | cache/ |
| `S3_FOLDER` | 否 | 圖片儲存路徑 | images/ |
| `S3_REGION` | 否 | S3 區域 | auto |
| `S3_FORCE_PATH_STYLE` | 否 | 強制路徑樣式 | false |
| `RSS_TITLE` | 否 | RSS 標題 | Rin Development |
| `RSS_DESCRIPTION` | 否 | RSS 描述 | Development Environment |
| `WEBHOOK_URL` | 否 | 留言通知 Webhook | - |
| `REPO_WORKER_NAME` | 否 | Worker 名稱 | rin-server |
| `REPO_DB_NAME` | 否 | D1 資料庫名稱 | rin |
| `R2_BUCKET_NAME` | 否 | R2 儲存桶名稱 | - |
| `EMAIL_SEND_URLS` | 條件 | MailPort 寄件位址（JSON 陣列） | - |

### Repository Secrets（Settings → Secrets and variables → Secrets）

| 變數名稱 | 必填 | 描述 |
|--------|------|------|
| `CLOUDFLARE_API_TOKEN` | 是 | Cloudflare API 權杖 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Cloudflare 帳戶 ID |
| `S3_ENDPOINT` | 條件 | S3/R2 接入點 |
| `S3_ACCESS_HOST` | 條件 | S3/R2 存取網域 |
| `S3_BUCKET` | 條件 | S3 儲存桶名稱 |
| `S3_ACCESS_KEY_ID` | 條件 | S3 存取金鑰 ID |
| `S3_SECRET_ACCESS_KEY` | 條件 | S3 存取金鑰 |
| `JWT_SECRET` | **是** | JWT 簽章金鑰 |
| `RIN_GITHUB_CLIENT_ID` | 條件 | GitHub OAuth ID |
| `RIN_GITHUB_CLIENT_SECRET` | 條件 | GitHub OAuth Secret |
| `RIN_GITEE_CLIENT_ID` | 條件 | Gitee OAuth ID |
| `RIN_GITEE_CLIENT_SECRET` | 條件 | Gitee OAuth Secret |
| `RIN_QQ_TOKEN` | 條件 | 心月互聯 QQ 登入 Token |
| `ADMIN_USERNAME` | 條件 | 管理員使用者名稱 |
| `ADMIN_PASSWORD` | 條件 | 管理員密碼 |
| `EMAIL_SEND_KEYS` | 條件 | MailPort API 金鑰（與 `EMAIL_SEND_URLS` 依序對應） |

---

## 本地開發環境變數

本地開發使用 `.env` 檔案，參考 `.env.example`：

```bash
# 站台設定
NAME="My Blog"
DESCRIPTION="A personal blog"
AVATAR=https://example.com/avatar.png
PAGE_SIZE=5
RSS_ENABLE=false

# S3 儲存（使用 R2 或 MinIO）
S3_FOLDER=images/
S3_CACHE_FOLDER=cache/
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_HOST=https://cdn.example.com
S3_FORCE_PATH_STYLE=false

# 快取模式
CACHE_STORAGE_MODE=database

# Webhook
WEBHOOK_URL=

# RSS
RSS_TITLE=My Blog
RSS_DESCRIPTION=My Personal Blog

# 驗證方式（至少設定一種）

# 方式一：GitHub OAuth
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx

# 方式二：Gitee OAuth
RIN_GITEE_CLIENT_ID=xxx
RIN_GITEE_CLIENT_SECRET=xxx

# 方式三：心月互聯 QQ 登入
RIN_QQ_TOKEN=xxx

# 方式四：聚合登入 WeChat
RIN_WECHAT_APPID=xxx
RIN_WECHAT_APPKEY=xxx

# 方式五：電子郵件驗證碼登入
# 部署 MailPort（https://github.com/wool-hmq/mailport）後，設定以下環境變數：
# - MailPort 專案：建立寄件端點，設定寄件方式與收件網域白名單，產生 API 金鑰
# - Rin 部落格環境變數：EMAIL_SEND_URLS 是寄件位址的 JSON 陣列，EMAIL_SEND_KEYS 是對應金鑰
#   單一寄件端點（金鑰可直接寫一般字串）：
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-mailport-api-key
#   多個寄件端點（金鑰與位址依索引一一對應，或共用一個金鑰）：
# EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
# EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
# 舊方案（未設定上面兩個變數時回退使用，需部署 Rin-Email 到 Vercel）：
EMAIL_RESEND_URL=https://your-rin-email.vercel.app/api/send
EMAIL_RESEND_PASS=your-email-pass

# 方式六：帳號密碼登入
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# JWT 金鑰（必須）
JWT_SECRET=random_secret_key

# S3 存取金鑰（使用 S3 儲存時需要）
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

---

## 最小部署清單

### 僅使用帳號密碼登入（最小設定）

| 變數 | 類型 | 必填 |
|------|------|------|
| `JWT_SECRET` | Secret | 是 |
| `ADMIN_USERNAME` | Secret | 是 |
| `ADMIN_PASSWORD` | Secret | 是 |
| `S3_FOLDER` | Variable | 是 |
| `S3_BUCKET` | Variable | 是 |
| `S3_REGION` | Variable | 是 |
| `S3_ENDPOINT` | Variable | 是 |
| `S3_ACCESS_KEY_ID` | Secret | 條件 |
| `S3_SECRET_ACCESS_KEY` | Secret | 條件 |

### 完整設定（所有功能）

包含站台設定、所有 OAuth、電子郵件登入、S3 儲存、Webhook、RSS。

---

## 常見問題

### Q: `CACHE_STORAGE_MODE=database` 還需要設定 S3 嗎？

不需要。`database` 模式會把快取儲存在 D1 資料庫中，無需 S3/R2 設定。但如果需要上傳圖片，仍需設定 S3 儲存變數。

### Q: 可以同時啟用多種登入方式嗎？

可以。同時設定多種登入方式的憑證即可，前端會自動顯示對應的登入按鈕。

### Q: 如何設定電子郵件驗證碼登入？

電子郵件驗證碼功能透過 [MailPort](https://github.com/wool-hmq/mailport) 寄件服務實作：

1. 部署 MailPort 專案，建立寄件端點並設定寄件方式（SMTP / HTTP API / Outlook 或 Gmail OAuth）
2. 在 MailPort 寄件端點頁面產生 API 金鑰，並依需求設定收件網域白名單
3. 在 Cloudflare Worker 中設定：
   - `EMAIL_SEND_URLS` = MailPort 寄件端點的完整寄件位址（JSON 陣列，可填多個）
   - `EMAIL_SEND_KEYS` = 對應的 API 金鑰（與位址依序一一對應）

`EMAIL_SEND_URLS` 與 `EMAIL_SEND_KEYS` 依序輪詢：第一個失敗會自動嘗試下一個，全部失敗才回報錯誤。
未設定這兩個變數時，回退到舊的 `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email）。

### Q: `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS` 的 JSON 格式怎麼填？

`EMAIL_SEND_URLS` 是寄件位址的 JSON 陣列，每個元素形如 `https://<你的網域>/api/<寄件端點ID>/send`；`EMAIL_SEND_KEYS` 是與之一一對應的金鑰陣列。

只用一個寄件端點時，金鑰可直接寫成一般字串：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

使用多個寄件端點，且金鑰各不相同時，兩個陣列依索引對應：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

多個寄件端點共用一個金鑰時，金鑰只寫一個：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

多個金鑰的數量必須與位址數量一致，或只提供一個金鑰共用；數量不符會在傳送時回報錯誤。

### Q: 如何限制允許的信箱網域？

在 MailPort 寄件端點設定的「收件網域白名單」中加入允許的網域（例如 `qq.com`、`example.com`），只有白名單內的收件位址才會寄送。

白名單留空則不限制網域。

### Q: MailPort 支援哪些寄件方式？

MailPort 支援以下寄件方式：
- SMTP：任意 SMTP 服務供應商（163 信箱、QQ 信箱、Gmail 等）
- HTTP API：轉發到自訂的 HTTP 介面
- Outlook OAuth2 / Gmail OAuth2：免應用程式密碼，授權後直接寄件

詳見 [MailPort 專案文件](https://mailport.lab.j3.ink)。
