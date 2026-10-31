# Rin 遷移指南 (v0.3.0)

本指南協助現有 Rin 使用者遷移到最新版本。

## 變更概覽

v0.3.0 版本包含重大的架構變更：

1. **框架遷移**：以自訂輕量級框架取代 ElysiaJS
2. **API 變更**：新的 API 用戶端介面
3. **登入方式**：新增帳號密碼登入支援
4. **OAuth 變更**：GitHub OAuth 變數名稱更新
5. **效能提升**：顯著的效能改進

## 遷移步驟

### 第一步：同步 Fork

1. 進入您在 GitHub 上 fork 的倉庫
2. 點擊 **"Sync fork"** 按鈕
3. 點擊 **"Update branch"** 合併變更

### 第二步：更新環境變數

#### 必要變更

**GitHub OAuth 變數（若使用 GitHub 登入）**

舊的變數名稱已棄用：

```
GITHUB_CLIENT_ID      → RIN_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET  → RIN_GITHUB_CLIENT_SECRET
```

**操作步驟**：
1. 進入 Settings → Secrets and variables → Actions
2. 新增帶有 `RIN_` 前綴的新 Secrets
3. （選用）刪除舊的 Secrets

#### 選用：新增帳號密碼登入

如果您偏好單純的帳號密碼登入而非 GitHub OAuth：

1. 新增以下 Secrets：
   - `ADMIN_USERNAME`: 您想要的使用者名稱
   - `ADMIN_PASSWORD`: 您想要的密碼

### 第三步：移除 Pages（選用但建議）

自 0.3.0 起，Rin 改為使用 Workers 代管靜態資源，不再依賴 Cloudflare Pages。建議依以下步驟遷移：

1. **解除綁定 Pages 網域**
   - 進入 Cloudflare Dashboard → Pages
   - 選擇您的 Pages 專案 → 自訂網域
   - 刪除已綁定的網域

2. **將網域綁定到 Worker**
   - 進入 Cloudflare Dashboard → Workers & Pages
   - 選擇您的 Worker (`rin-server`)
   - 點擊「觸發器」→「新增自訂網域」
   - 輸入您的網域並儲存

3. **清理多餘的網域綁定**
   - 檢查 Worker 的自訂網域列表
   - 刪除不需要的綁定（如 `seo/*`、`sub/*` 等）

4. **更新 GitHub OAuth Callback**
   - 進入 GitHub → Settings → Developer settings → OAuth Apps
   - 找到您的 OAuth App
   - 將 Authorization callback URL 從：
     - `https://<worker-domain>/user/github/callback`
   - 修改為：
     - `https://<your-domain>/api/user/github/callback`

### 第四步：更新 Cloudflare API Key 權限

確保您的 Cloudflare API Token 具有以下權限：
- **D1**:Edit
- **Workers R2 儲存**:Edit (若使用 R2 儲存)
- **Workers 指令碼**:Edit

![1000000663](/cloudflare-api-key-cn.png)


### 第五步：重新命名分支名稱


1. 若先前 fork 倉庫的分支為 `dev`，需手動重新命名為 `main` 或 `master`


### 第六步：部署

1. 進入倉庫的 Actions 分頁
2. 選擇 **"Build"** 工作流程
3. 點擊 **"Run workflow"**
4. 建置成功後會自動觸發 `Deploy` 工作流程自動部署到 workers

### 第七步：驗證部署

1. 存取您的前端 URL
2. 測試登入功能
3. 檢查既有文章是否可存取
4. 驗證圖片是否正確載入

## 破壞性變更彙整

### API 用戶端介面

**舊程式碼**（不再支援）：
```typescript
const feeds = await client.feed.index.get({ query: { page: 1 } });
```

**新程式碼**：
```typescript
const feeds = await client.feed.list({ page: 1 });
```

如果您有使用舊 API 的自訂前端程式碼，請相應更新。

### 認證流程

- **舊**：後端轉址到前端 callback URL
- **新**：獨立的 `/login` 頁面，專用的登入流程

### 環境變數變化

| 舊名稱 | 新名稱 | 必要 |
|--------|--------|------|
| `GITHUB_CLIENT_ID` | `RIN_GITHUB_CLIENT_ID` | 選用* |
| `GITHUB_CLIENT_SECRET` | `RIN_GITHUB_CLIENT_SECRET` | 選用* |
| - | `ADMIN_USERNAME` | 選用* |
| - | `ADMIN_PASSWORD` | 選用* |

*必須設定至少一種登入方式

## 遷移後

### 試用新功能

1. **個人資料管理**：存取 `/profile` 更新頭像與使用者名稱
2. **效能提升**：體驗更快的冷啟動與更低的 CPU 使用率
3. **更好的登入體驗**：新的獨立登入頁面，改進焦點處理

### 清理（選用）

成功遷移後，您可以：

1. 刪除已棄用的環境變數
2. 如不再需要，刪除舊的預覽部署
3. 更新自訂指令碼以使用新的 API 介面

## 疑難排解

### 「版本不匹配」錯誤

**解決方案**：確保 git 標籤與 package.json 版本相符。同步應該會自動處理。

### 「無法登入」

**解決方案**：
1. 驗證至少已設定一種登入方式（GitHub OAuth 或帳號密碼）
2. 檢查 Secrets 是否正確設定
3. 嘗試清除瀏覽器快取

### 「圖片無法載入」

**解決方案**：
1. 檢查 S3/R2 設定
2. 驗證 `S3_ACCESS_HOST` 是否正確設定
3. 檢查 R2 儲存桶權限

## 回復（如需要）

如果遷移失敗需要回復：

1. 切換到上一個穩定版本標籤（發布標籤使用 `v` 前綴，例如 `v1.0.0`）：`git checkout v1.0.0`
2. 強制推送到 main（⚠️ 破壞性）：`git push origin HEAD:main --force`
3. 從 Actions 重新部署

## 需要協助？

- 📖 [羊角快車二創版線上文件](https://rin.lab.j3.ink)
- 🐛 [羊角快車二創版 Issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快車二創版 Discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 [官方原版文件（上游）](https://docs.openrin.org)
- 🐛 [官方原版 Issues（上游）](https://github.com/openRin/Rin/issues)
- 💬 [官方原版 Discussions（上游）](https://github.com/openRin/Rin/discussions)

---

*最後更新：2026-10-24*
