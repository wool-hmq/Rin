# 本地開發指南

本文件說明如何在本地開發與除錯 Rin 專案。

## 快速開始

### 1. 複製專案

```bash
git clone https://github.com/openRin/Rin.git
cd Rin
```

或

```bash
git clone https://github.com/wool-hmq/Rin.git
cd Rin
```

### 2. 安裝相依項目

```bash
bun install
```

### 3. 設定環境變數

```bash
# 複製範例設定檔
cp .env.example .env.local

# 編輯設定檔，填入你的實際設定
vim .env.local  # 或使用其他編輯器
```

### 4. 啟動開發伺服器

```bash
bun run dev
```

這會自動完成以下操作：
- ✅ 產生 `wrangler.toml` 設定檔
- ✅ 產生 `.dev.vars` 敏感資訊檔
- ✅ 執行資料庫遷移
- ✅ 啟動開發伺服器（連接埠 11498 - 前後端同源）

存取 http://localhost:11498 即可開始開發！

## 環境變數設定

所有設定都集中在 `.env.local` 檔案中：

### 站台設定

:::tip
站台設定（名稱、頭像、描述、分頁大小等）現在透過服務端設定下發，可以在部署後於設定頁面修改。環境變數僅作為預設值使用。

你可以選擇性設定以下環境變數：

| 變數名稱 | 必填 | 說明 | 範例 |
|--------|------|------|------|
| `NAME` | 否 | 網站名稱（可後續修改） | `My Blog` |
| `AVATAR` | 否 | 頭像位址（可後續修改） | `https://...` |
| `DESCRIPTION` | 否 | 網站描述（可後續修改） | `A blog` |
| `PAGE_SIZE` | 否 | 分頁大小（可後續修改） | `5` |
| `RSS_ENABLE` | 否 | 啟用 RSS（可後續修改） | `false` |

### 後端設定

| 變數名稱 | 必填 | 說明 | 範例 |
|--------|------|------|------|
| `S3_ENDPOINT` | 是 | S3/R2 端點 | `https://...r2.cloudflarestorage.com` |
| `S3_BUCKET` | 是 | 儲存桶名稱 | `images` |
| `S3_REGION` | 否 | 區域 | `auto` |
| `S3_FOLDER` | 否 | 圖片儲存路徑 | `images/` |
| `WEBHOOK_URL` | 否 | 通知 Webhook | `https://...` |

### 敏感設定（必要）

| 變數名稱 | 說明 |
|--------|------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `RIN_GITEE_CLIENT_ID` | Gitee OAuth Client ID |
| `RIN_GITEE_CLIENT_SECRET` | Gitee OAuth Client Secret |
| `RIN_QQ_TOKEN` | 心月互聯 QQ 登入 Token |
| `RIN_WECHAT_APPID` | 聚合登入 WeChat App ID |
| `RIN_WECHAT_APPKEY` | 聚合登入 WeChat App Secret |
| `JWT_SECRET` | JWT 簽章金鑰 |
| `S3_ACCESS_KEY_ID` | S3 Access Key |
| `S3_SECRET_ACCESS_KEY` | S3 Secret Key |

## 常用命令

```bash
# 啟動完整開發環境（建議）
bun run dev

# 僅啟動前端
bun run dev:client

# 僅啟動後端
bun run dev:server

# 執行資料庫遷移
bun run db:migrate

# 產生資料庫遷移檔
bun run db:generate

# 重新產生設定檔
bun run dev:setup

# 建置專案
bun run build

# 清理產生的檔案
bun run clean

# 執行型別檢查
bun run check

# 格式化程式碼
bun run format:write
bun run format:check

# 執行測試
bun run test              # 執行所有測試
bun run test:server       # 僅執行服務端測試
 bun run test:coverage     # 執行測試並產生覆蓋率報告
```

## 開發工作流程

### 首次設定

1. Fork 專案倉庫
2. 複製到本地
3. 安裝相依項目：`bun install`
4. 設定 `.env.local`
5. 執行 `bun run dev`

### 日常開發

1. 修改程式碼
2. 前端自動熱更新，後端修改後自動重新啟動
3. 測試功能
4. 提交程式碼

### 資料庫變更

1. 修改 `server/src/db/schema.ts`
2. 執行 `bun run db:generate` 產生遷移檔
3. 執行 `bun run db:migrate` 套用遷移

## 測試

專案為用戶端與服務端使用了不同的測試框架：

### 用戶端測試 (Vitest)

用戶端測試使用 Vitest 搭配 jsdom 環境進行 React 元件測試。

```bash
# 執行用戶端測試
cd client && bun run test

# 監視模式
cd client && bun run test:watch

# 產生覆蓋率報告
cd client && bun run test:coverage
```

測試檔案位置：`client/src/**/__tests__/*.test.ts`

### 服務端測試 (Bun)

服務端測試使用 Bun 原生測試執行器與記憶體 SQLite 資料庫。

```bash
# 執行服務端測試
cd server && bun run test

# 產生覆蓋率報告
cd server && bun run test:coverage
```

測試檔案位置：
- 單元測試：`server/src/**/__tests__/*.test.ts`
- 整合測試：`server/tests/integration/`
- 安全測試：`server/tests/security/`

### 新增測試

新增功能時，請一併附上對應的測試：

1. **用戶端**：在 `client/src/**/__tests__/*.test.ts` 新增測試
2. **服務端**：在 `server/src/**/__tests__/*.test.ts` 或 `server/tests/` 新增測試

## API 架構

### 自訂 API 用戶端

專案使用自訂 HTTP 用戶端取代 Eden，實作型別安全的 API 通訊：

- **位置**：`client/src/api/client.ts`
- **特性**：型別安全請求、錯誤處理、驗證權杖管理
- **使用方式**：所有 API 呼叫都透過型別化用戶端進行

### 共用型別 (@rin/api)

`@rin/api` 套件為用戶端與服務端提供共用的 TypeScript 型別：

- **位置**：`packages/api/`
- **用途**：API 契約的端到端型別安全
- **使用方式**：在用戶端與服務端程式碼中從 `@rin/api` 匯入型別

新增 API 端點時：
1. 在 `packages/api/src/types.ts` 中定義型別
2. 在 `server/src/services/` 中實作服務端處理器
3. 用戶端透過共用型別自動獲得型別安全

## 疑難排解

### 連接埠被占用

如果連接埠 5173 或 11498 被占用，可以修改 `.env.local` 中的設定：

```bash
# 修改前端連接埠（需要在 vite.config.ts 中設定）
# 修改後端連接埠
bun run dev:server -- --port 11499
```

### 資料庫遷移失敗

```bash
# 清理本地資料庫並重新遷移
rm -rf .wrangler/state
bun run db:migrate
```

### 設定檔未產生

```bash
# 手動執行設定產生
bun run dev:setup
```

### GitHub OAuth 設定

本地開發時需要設定 GitHub OAuth：

1. 存取 https://github.com/settings/developers
2. 建立新的 OAuth App
3. Authorization callback URL 填寫：`http://localhost:11498/api/user/github/callback`
4. 將 Client ID 與 Client Secret 填入 `.env.local`

## 專案結構

```
.
├── client/                 # 前端程式碼 (React + Vite)
│   ├── src/
│   │   ├── page/          # 頁面元件
│   │   ├── api/           # API 用戶端
│   │   ├── components/    # React 元件
│   │   └── utils/         # 工具函式
│   └── package.json
├── server/                 # 後端程式碼 (Cloudflare Workers)
│   ├── src/
│   │   ├── services/      # 業務服務
│   │   ├── db/            # 資料庫表結構
│   │   ├── core/          # 路由與核心型別
│   │   └── utils/         # 工具函式
│   ├── tests/             # 測試檔案
│   └── package.json
├── packages/               # 共用套件
│   └── api/                # @rin/api - 共用 API 型別
├── cli/                    # Rin CLI 工具
│   ├── bin/               # 薄入口
│   ├── src/               # 命令、任務、共用工具
│   └── templates/         # Git hook 與檔案範本
├── scripts/                # 對 CLI 的相容包裝層
├── docs/                   # 文件
├── .env.example            # 環境變數範例
├── .env.local              # 本地設定（不提交到 Git）
└── package.json
```

## 正式環境部署

請參考 [部署指南](./deploy.mdx) 了解正式環境部署流程。

## 取得協助

- 📖 [羊角快車二創版線上文件](https://rin.lab.j3.ink)
- 🐛 [羊角快車二創版 Issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快車二創版 Discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 [官方原版文件（上游）](https://docs.openrin.org)
- 💬 官方原版 Discord（上游）：https://discord.gg/JWbSTHvAPN
