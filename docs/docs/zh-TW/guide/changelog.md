# 更新日誌

> **版本說明**：羊角快車二創版使用標準語意化版本，獨立版本線從 **v1.0.0** 開始，發布標籤為 `vX.Y.Z`，預發布版本使用 `-beta`、`-rc.1` 等後綴（例如 `v1.2.0-beta.1`）。`MAJOR` 用於不相容變更，`MINOR` 用於向後相容的新功能，`PATCH` 用於缺陷修正與小幅改動。每次發布都會寫入本更新日誌；發布公告頁依改動規模與說明需求維護，改動較大或需要重點說明時會新建或更新公告頁，同一版本線的多次發布可合併到同一頁。同一條目同時涉及官方原版 openRin/Rin 的版本與本專案版本時，本專案版本寫作 `yjvX.Y.Z` 以示區別。目前最新版本為 **v1.1.2**。下文 `v0.3.0` / `v0.2.0` 為官方原版（上游）的歷史記錄。

## v1.1.2 2026-10-26

把 REST API 與 MCP 的金鑰管理拆分為兩類。

### 本次更新

- **金鑰類型區分**：`api_keys` 表新增 `key_type` 欄位（1 = API 介面金鑰，2 = MCP 金鑰），設定頁依「API 介面」與「MCP」兩個分頁分別管理
- **端點隔離**：API 介面金鑰只能呼叫 `/api/key/*`，MCP 金鑰只能呼叫 `/mcp`，類型不符時回傳 `403`
- **權限邊界**：`content.read` 僅對 MCP 金鑰開放

### 文件

- API 指南補充金鑰類型說明；遷移 `0021.sql` 自動為歷史金鑰歸類
- 部署指南與 README 統一為單 Worker 架構說明：前端靜態資源隨 Worker 發布，無需建立 Cloudflare Pages 專案

### 升級說明

- 遷移自動執行：含 `content.read` 的舊金鑰轉為 MCP 金鑰，其餘轉為 API 介面金鑰

## v1.1.1 2026-10-26

新增 MCP 服務端，並修正自訂網域存取被拒的問題。

### 本次更新

- **MCP 服務端**：新增 `/mcp` 端點，以 MCP 工具形式提供文章、動態、友連與站台設定的讀寫，API Key 驗證，依 scope 裁剪工具並新增 `content.read`
- **網域白名單**：Host 與 Origin 校驗阻斷 DNS rebinding，自訂網域透過 `MCP_ALLOWED_HOSTS` 放行，支援協定／連接埠寫法、萬用網域與 `*`

### 修正

- 部署命令補齊 `FRONTEND_URL` 與 `MCP_ALLOWED_HOSTS`，網域被拒時回應內容會給出設定提示
- 網域校驗提前到驗證之前，被拒網域回傳 403 與 `Invalid Host`

### 文件

- 新增 [v1.1 發布公告](../blog/v1.1-release)，API 指南補充自訂網域排查（421 / 403 區分）

### 升級說明

- 自訂網域站台需設定 `MCP_ALLOWED_HOSTS` 或 `FRONTEND_URL` 後重新部署；本版本無資料庫遷移

## v1.1.0 2026-10-24

二創版獨立版本線上的首個功能版本，收錄友連驗證雙方式等近期能力，並同步維護中英文文件。

### 本次更新

- **友連驗證支援 DNS TXT 與 HTML 檔案兩種方式**
  - JSON 解析完成後進入 `awaiting_method_choice` 階段，由訪客選擇驗證方式：回覆 `1`（或 `一` / `方案一` / `方法一`）使用 DNS TXT 記錄，回覆 `2`（或 `二` / `方案二` / `方法二`）上傳 HTML 檔案
  - DNS 方式：向訪客下發 `_jiaofriend` 主機記錄、TXT 類型、驗證碼為記錄值的教學；驗證時透過 Cloudflare DNS-over-HTTPS 查詢 `_jiaofriend.訪客網域` 的 TXT 記錄並檢查是否包含驗證碼
  - 檔案方式：保留原有嚴格校驗，GET 必須回傳 200 且剔除標籤／指令碼後的 `<body>` 文字包含驗證碼
  - 狀態機新增 `awaiting_verification` 階段並記錄 `verifyMethod`；修改友連時舊站台與新站台分別重新選擇驗證方式；升級前的 `verifying` 狀態自動回復到檔案驗證
  - DNS 查詢透過可注入相依 `resolveTxt(name) => Promise<string[]>` 實作，便於測試與替換解析器

### 修正

- 修正友連驗證被 SPA 回退、自訂 404 頁面、403/500 與 30x 轉址誤判通過
- 修正 `awaiting_json` 階段把非 JSON 本文誤判為格式錯誤並終止申請
- 修正 `friends-sitemap.xml` 路由被前端 SPA 攔截
- 修正點選檢視金鑰會把加密儲存改成明文儲存
- 修正驗證碼圖片重複初始化導致申請崩潰
- 修正郵件解析在 CJS / ESM 產物下的相容性

### 文件

- 部署指南依目前實作重寫：倉庫選擇順序、站台變數、工作流程清單、遷移指令碼路徑與部署位址說明
- 文件目錄重構：`env.md`、`database.md` 遷入 `configuration/`
- 新增 [v1.0.0 發布公告](../blog/v1.0.0-release)，部落格導覽中二創版項目排在官方原版之前
- 資料庫文件補充 `users.password` 的雜湊規則：SHA-256（無加鹽），手動修改 D1 中的密碼時必須寫入雜湊值
- 文件中同時出現兩個倉庫時，統一先列 **羊角快車二創版（本倉庫）** 並標註 **官方原版 openRin/Rin（上游）**
- 中英文文件同步更新

### 升級說明

- 友連驗證方式的選擇對既有友連無影響：升級前的 `verifying` 狀態自動回復為 HTML 檔案驗證
- 其餘功能無需額外環境變數

## v1.0.0 2026-10-24

羊角快車二創版獨立版本線的起點。本版本承接官方原版 openRin/Rin `v0.3.0` 的能力，並疊加二創版本已落地的功能與基礎架構。

### 新增功能

- **郵件自助友連**：訪客透過郵件完成友連申請／修改／刪除，包含 JSON 範本、人機驗證碼圖片、申請取消指令、回覆攔截與新建郵件引導、依信箱綁定歸屬 UID
- **友連分組與排序**：後台管理友連分組與顯示順序
- **TOTP 雙因素驗證**：全體使用者皆可使用，支援復原碼與登入限流
- **API Key 外部呼叫體系**：管理員在後台設定頁建立、撤銷金鑰並限定權限範圍
- **friends-sitemap.xml**：輸出已通過審核的友連，包含名稱與描述
- **MailPort 多寄件位址**：支援多個寄件端點依序輪詢，並相容舊有設定
- **AI 能力**：AI 摘要、AI 增強搜尋、自訂模型與回退模型佇列排序
- **內容與閱讀體驗**：多套評論系統、Webhook 通知、RSS、Sitemap 與動態 robots.txt、友連可存取狀態定時檢查

### 修正

- 修正無密碼帳號啟用 TOTP 後無法登入
- 修正 API Key 介面 404 文案重複拼接、權限範圍列表為空
- 修正部署時批次上傳 Secret 的 10214 競態失敗

### 架構與部署

- 後端執行環境遷移到面向 Cloudflare Workers 的輕量框架，路由與相依項目按需載入
- 抽出 `@rin/api`、`@rin/ui` 等共用套件，前後端共用型別與元件
- 部署、開發、資料庫任務統一收斂到 Rin CLI，並提供 GitHub Actions 的 Build / Deploy / Preview / Release / 文件站工作流程
- 同步官方原版改進：feed service 的 repository 分層、路由守衛、sitemap 服務、Modal 元件、圖片回退元件與目錄樹穩定化

### 文件

- 文件體系隨倉庫維護，中英文內容保持同步
- 文件中同時出現兩個倉庫時，統一先列 **羊角快車二創版（本倉庫）** 並標註 **官方原版 openRin/Rin（上游）**

### 升級說明

- 從官方原版升級到二創版時，部署指令碼會自動執行 `server/sql/` 下的遷移指令碼，無需手動操作
- 郵件登入、電子郵件驗證碼與郵件自助友連屬於選用功能，需要額外設定 `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS`（見 [環境變數說明](../configuration/env)）
- TOTP、API Key、友連分組等功能無需額外環境變數，在後台頁面依需求啟用即可

## 官方原版歷史版本

### v0.3.0 2025-02-04 更新

#### 架構重構

- **輕量級框架**：將 ElysiaJS 後端框架重構為輕量級自訂框架，專門針對 Cloudflare Workers 最佳化
  - 移除了約 15 個重量級相依項目，核心框架程式碼 < 10KB
  - 實作按需載入架構，每個請求只初始化必要的服務
  - 最佳化的啟動時間與記憶體用量

#### 新增功能

- **快取系統**：實作支援資料庫和 S3 的彈性快取系統
  - 新增 `CACHE_STORAGE_MODE` 環境變數，支援 `database` 或 `s3` 模式
  - 支援快取資料的自動序列化與反序列化
  - 新增快取表用於高頻資料儲存

- **HyperLogLog 統計**：PV/UV 統計遷移到 HyperLogLog 演算法
  - 使用 16384 個暫存器，誤差率約 0.81%
  - 新增 `visit_stats` 表，包含 pv 計數器與 hll_data
  - 文章統計查詢從 O(n) 最佳化到 O(1)
  - 大幅減少高流量文章的查詢時間

- **錯誤處理系統**：實作全面的錯誤處理機制
  - 新增結構化錯誤類別（ValidationError, NotFoundError 等）
  - 實作 `GlobalErrorBoundary` 捕捉 React 算繪錯誤
  - 新增 `useError` hooks 處理非同步操作與 API 呼叫
  - 伺服器端中介軟體記錄錯誤並產生請求 ID

- **Cookie 驗證**：從 Authorization Header 遷移到 Cookie-based 驗證
  - 後端設定 HttpOnly、Secure、SameSite=lax 的 Cookie
  - 前端移除 Authorization Header，改依賴瀏覽器 Cookie
  - 強化 CSRF 防護

#### 改進與最佳化

- **API 用戶端重構**：以自訂 API 用戶端取代 Elysia/Eden
  - 移除 @elysiajs/eden 與 rin-server 相依項目
  - 建立型別安全的 API 用戶端
  - 簡化 API 呼叫方式（從 treaty 模式改為直接方法呼叫）
  - **破壞性變更**：用戶端 API 介面變更，例如 `client.feed.index.get()` → `client.feed.list()`

- **OAuth 自訂實作**：以自訂 OAuth2 實作取代 elysia-oauth2
  - 通用 OAuth2 外掛架構，支援任何 OAuth2 供應商
  - 內建 GitHub OAuth 供應商作為預設
  - 透過 state 參數驗證提供 CSRF 防護
  - TypeScript 全型別支援

- **相依注入重構**：以原生機制取代 typedi
  - 移除 typedi 相依注入容器
  - 使用 Elysia 的 decorate() 與 derive() 進行相依注入
  - 服務透過 store 存取相依項目而非 Container.get()

- **友連系統最佳化**：更新 Friend 介面並調整相關 API 呼叫
  - 改善型別安全性

#### 修正

- 修正 uv 遷移到 hll 失敗的問題
- 修正 GitHub 回呼路由的 schema 驗證問題
- 修正查詢參數整數解析問題
- 修正 CORS 預檢請求處理問題
- 最佳化程式碼並精簡體積

#### 資料庫遷移

- 新增快取表 `cache`（key, type, data, created_at, updated_at）
- 新增造訪統計表 `visit_stats`（feed_id, pv, hll_data）
- 資料庫遷移指令碼：`0006.sql`

#### 環境變數

新增環境變數：
```ini
CACHE_STORAGE_MODE=<快取儲存模式：database 或 s3，預設 database>
```

### v0.2.0 2024-06-07 更新

- 新增 `S3_CACHE_FOLDER` 環境變數
- 環境變數加密清單與變數清單更新，僅保留必須加密的環境變數
- 加密變數現在可以透過 GitHub 直接設定
- GitHub 變數設定更新，新增必須透過 GitHub 設定的加密變數（S3 儲存，用於 SEO 索引保存）
- `GITHUB_CLIENT_ID` 與 `GITHUB_CLIENT_SECRET` 現在加上前綴 `RIN_`（`RIN_GITHUB_CLIENT_ID`、`RIN_GITHUB_CLIENT_SECRET`），以解決 GitHub 變數不能以 `GITHUB_` 開頭的問題，使用 Cloudflare 面板設定的 `GITHUB_CLIENT_ID` 與 `GITHUB_CLIENT_SECRET` 不受影響

## 官方原版遷移指南

無特別說明時，一般的版本更新直接同步 fork 的倉庫即可

### v0.2.0 遷移指南


```ini
SEO_BASE_URL=<SEO 基礎位址，用於 SEO 索引>
SEO_CONTAINS_KEY=<SEO 索引時只索引以 SEO_BASE_URL 開頭或包含 SEO_CONTAINS_KEY 關鍵字的連結，預設為空>
S3_FOLDER=<S3 圖片資源儲存的資料夾，預設為 'images/'>
S3_CACHE_FOLDER=<S3 快取資料夾（用於 SEO、高頻請求快取），預設為 'cache/'>
S3_BUCKET=<S3 儲存桶名稱>
S3_REGION=<S3 儲存桶所在區域，如使用 Cloudflare R2 填寫 auto 即可>
S3_ENDPOINT=<S3 儲存桶接入點位址>
S3_ACCESS_HOST=<S3 儲存桶存取位址，結尾無'/'>
```

同時新增以下加密環境變數（加密，新增到 Secrets）：

```ini
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

以上環境變數在之前的版本中是透過 Cloudflare 面板設定的，現在需要遷移到 GitHub 中設定，新版本的部署 GitHub Action 會自動上傳到 Cloudflare，之後就不再需要在 Cloudflare 面板中設定這些環境變數了
