# 提交規範

本文件描述了 Rin 專案的提交訊息規範。遵循這些規範可以讓我們自動產生變更日誌與發布說明。

## 格式

每則提交訊息應遵循以下格式：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## 類型

| 類型 | 描述 | 範例 |
|------|------|------|
| `feat` | 新功能 | `feat(auth): 新增 GitHub OAuth 登入` |
| `fix` | Bug 修正 | `fix(api): 解決 CORS 問題` |
| `docs` | 文件變更 | `docs(readme): 更新部署指南` |
| `style` | 程式碼格式變更（格式化、分號等） | `style: 使用 prettier 格式化` |
| `refactor` | 程式碼重構 | `refactor(db): 最佳化查詢效能` |
| `perf` | 效能最佳化 | `perf(cache): 實作 Redis 快取` |
| `test` | 新增或更新測試 | `test(api): 新增使用者認證測試` |
| `chore` | 建置流程或輔助工具變更 | `chore(deps): 更新相依套件` |
| `ci` | CI/CD 變更 | `ci: 新增發布工作流程` |
| `revert` | 回退變更 | `revert: 復原破壞性變更` |

## 作用範圍

作用範圍是選用的，應指出受影響的程式碼區域：

- `api` - 後端 API 變更
- `client` - 前端／用戶端變更
- `db` - 資料庫變更
- `auth` - 認證相關
- `ui` - UI 元件
- `deps` - 相依套件
- `config` - 設定檔
- `docs` - 文件
- `release` - 發布相關

## 主旨

- 使用祈使語氣（「新增」而非「新增了」或「新增」）
- 首字母不大寫
- 結尾不加句號
- 最多 50 個字元

**好的範例：**
- `feat(auth): 新增密碼重設功能`
- `fix(api): 處理資料庫空回應`
- `docs(readme): 更新安裝說明`

**不好的範例：**
- `feat: Added new feature`（過去式，首字母大寫）
- `fix: fixed the bug.`（過去式，結尾有句號）
- `update stuff`（無類型，描述模糊）

## 內文

- 使用祈使語氣
- 每行 72 個字元處斷行
- 解釋**做了什麼**與**為什麼**，而非**怎麼做**
- 與主旨之間以空行分隔

範例：
```
feat(auth): 實作 JWT 權杖更新

新增自動更新權杖的機制，以防止使用者意外登出。
權杖會在到期前 5 分鐘更新。

這能無縫維持工作階段，改善使用體驗。
```

## 頁尾

- 引用 Issue 與 PR：`Closes #123`、`Fixes #456`
- 破壞性變更：`BREAKING CHANGE: 描述`

範例：
```
feat(api): 變更使用者端點的回應格式

BREAKING CHANGE: 使用者端點現在會將使用者資料包裝在
`data` 欄位中回傳，而非直接回傳。請相應更新
您的用戶端程式碼。

Closes #789
```

## 範例

### 功能
```
feat(articles): 新增具備預覽的 Markdown 編輯器

使用 Monaco Editor 實作分割畫面的 Markdown 編輯器，支援
即時預覽。支援語法高亮與圖片上傳。

Closes #234
```

### Bug 修正
```
fix(ui): 解決行動版導覽選單重疊問題

導覽選單在小於 768px 的螢幕上與內容重疊。
調整 z-index 與定位以解決此問題。

Fixes #567
```

### 文件
```
docs(deploy): 新增 Cloudflare 設定指南

為新的部署新增 Cloudflare Workers、D1
資料庫與 R2 儲存的綜合指南。
```

### 破壞性變更
```
feat(auth): 遷移到新的 OAuth 供應商

BREAKING CHANGE: GitHub OAuth 實作已更換為
通用 OAuth2 供應商。環境變數已變更：
- GITHUB_CLIENT_ID → OAUTH_CLIENT_ID
- GITHUB_CLIENT_SECRET → OAUTH_CLIENT_SECRET

遷移指南：https://docs.example.com/migration/v2
```

## 提交訊息檢查

我們建議使用 commitlint 來強制執行這些規範：

```bash
# 安裝 commitlint
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# 建立 commitlint.config.js
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## 為什麼？

- **自動產生變更日誌**：可以自動產生發布說明
- **清楚的歷史記錄**：容易理解發生了哪些變更以及原因
- **語意化版本控制**：協助判定版本升級（feat=minor，fix=patch，breaking=major）
- **更好的協作**：一致的格式讓程式碼審查更容易

## 工具

- **Commitizen**：互動式提交訊息建構器
  ```bash
  npm install -g commitizen
  git cz  # 取代 git commit
  ```

- **VS Code 擴充套件**：「Conventional Commits」用於自動完成

## 有問題？

如果您不確定提交類型或格式，請在您的 PR 中詢問，或參考倉庫中既有的提交。
