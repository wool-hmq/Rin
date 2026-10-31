# API 使用指南

Rin 提供了基於 API 金鑰的外部呼叫介面，允許腳本或 AI 智慧代理在不登入的情況下管理站點內容與設定。REST 介面位於 `/api/key/` 路徑下，MCP 伺服器位於 `/mcp`。

金鑰分為兩類，互不通用：

- **API 介面金鑰**：只能呼叫 `/api/key/*`，用於外部腳本自動化。
- **MCP 金鑰**：只能呼叫 `/mcp`，用於 Claude Code、Cursor 等 MCP 用戶端。

## 建立 API 金鑰

API 金鑰只能由管理員建立。以管理員身分登入後，進入後台「設定」頁面，捲動到底部的「API 金鑰」區域，可在「API 介面」與「MCP」兩個頁籤中分別建立、修改、輪換和刪除金鑰。

金鑰歸屬於建立它的管理員帳號，其他帳號不會看到這些金鑰。

建立時可設定：

- **金鑰類型**：API 介面金鑰或 MCP 金鑰。類型在建立時確定，之後不可更改，兩個頁籤的金鑰清單互不可見。
- **名稱**：便於識別的備註，可隨時修改。
- **權限範圍**：勾選該金鑰允許呼叫的能力，每個業務域為一個獨立權限。
- **儲存方式**：
  - 加密儲存（預設）：金鑰只在建立時顯示一次，之後無法再次檢視，只能輪換。
  - 明文可見：金鑰以加密形式儲存在資料庫中，可隨時在設定頁檢視與複製。

儲存方式在建立時確定。加密儲存的金鑰無法改為可檢視；可檢視的金鑰可以隨時關閉檢視能力，金鑰本身仍然有效，只是不再展示明文。需要可隨時檢視的金鑰時，請新建一個。

## 呼叫方式

在請求標頭中攜帶金鑰，兩種寫法等價：

```bash
# 使用 X-API-Key 請求標頭
curl -H "X-API-Key: <你的金鑰>" https://your-site/api/key/help
```

```bash
# 使用 Authorization 請求標頭
curl -H "Authorization: Bearer <你的金鑰>" https://your-site/api/key/help
```

金鑰是 32 位字元。缺少或無效時傳回 `401`，權限不足時傳回 `403`。使用與介面類型不相符的金鑰同樣傳回 `403`，例如用 API 介面金鑰呼叫 `/mcp`。

## 查詢目前金鑰的權限

```bash
curl -H "X-API-Key: <你的金鑰>" https://your-site/api/key/help
```

傳回該金鑰擁有的權限範圍，以及每個權限下可用的介面清單：

```json
{
  "success": true,
  "key_id": 1,
  "scopes": ["feed.write"],
  "permissions": [
    {
      "scope": "feed.write",
      "title": "文章管理",
      "description": "透過 API 發布、編輯、刪除文章。",
      "endpoints": ["POST /api/key/feed", "POST /api/key/feed/:id", "DELETE /api/key/feed/:id"]
    }
  ],
  "base_path": "/api/key"
}
```

## 權限與介面

| 權限 | 說明 | 介面 |
| --- | --- | --- |
| `content.read` | 內容讀取（僅 MCP 金鑰） | `POST /mcp`（`tools/list`、`tools/call`） |
| `feed.write` | 文章管理 | `POST /api/key/feed`、`POST /api/key/feed/:id`、`DELETE /api/key/feed/:id` |
| `friend.write` | 友鏈管理 | `POST /api/key/friend`、`PUT /api/key/friend/:id`、`DELETE /api/key/friend/:id` |
| `moment.write` | 動態管理 | `POST /api/key/moment`、`POST /api/key/moment/:id`、`DELETE /api/key/moment/:id` |
| `config.site` | 站點資訊 | `GET/POST /api/key/config/site` |
| `config.personalization` | 個人化 | `GET/POST /api/key/config/personalization` |
| `config.other` | 其他設定（不含網站圖示） | `GET/POST /api/key/config/other` |
| `config.comment` | 評論管理 | `GET/POST /api/key/config/comment` |
| `config.supportly` | Supportly 客服 | `GET/POST /api/key/config/supportly` |
| `config.webhook` | Webhook 與測試 Webhook | `GET/POST /api/key/config/webhook`、`POST /api/key/config/webhook/test` |
| `config.friend` | 友鏈設定 | `GET/POST /api/key/config/friend` |
| `config.maintenance` | 維護 | `GET/POST /api/key/config/maintenance`、`DELETE /api/key/config/cache` |
| `config.ai` | AI 設定 | `GET/POST /api/key/config/ai` |

## MCP 伺服器

站點在根路徑 `/mcp` 提供 MCP（Model Context Protocol）伺服器，支援 MCP 的用戶端（Claude Code、Cursor、MCP Inspector 等）可以用 MCP 金鑰管理站點內容。

- 傳輸方式：Streamable HTTP
- 服務位址：`https://your-site/mcp`
- 驗證方式：請求標頭攜帶 `X-API-Key` 或 `Authorization: Bearer <你的金鑰>`，必須使用 MCP 金鑰；API 介面金鑰呼叫 `/mcp` 會傳回 `403`
- 權限裁剪：伺服器依金鑰權限篩選工具，未授權的工具不會出現在 `tools/list` 中，直接呼叫同樣會被拒絕
- 可用權限：MCP 金鑰支援 `content.read` 與各類寫入、設定權限，因此同一個金鑰既能讀取也能維護內容；API 介面金鑰不能勾選 `content.read`

### 工具與權限

| 工具 | 所需權限 | 說明 |
| --- | --- | --- |
| `whoami` | 無需權限 | 傳回目前金鑰資訊、權限範圍與可用工具清單 |
| `list_posts` | `content.read` | 分頁列出文章，支援 `normal`、`draft`、`unlisted`、`all` 篩選 |
| `get_post` | `content.read` | 依 ID 或別名讀取文章全文 |
| `search_posts` | `content.read` | 依標題關鍵字搜尋文章 |
| `list_tags` | `content.read` | 列出標籤 |
| `list_moments` | `content.read` | 分頁列出動態 |
| `list_friends` | `content.read` | 分頁列出友鏈 |
| `create_post`、`update_post`、`delete_post` | `feed.write` | 建立、修改、刪除文章 |
| `create_moment`、`update_moment`、`delete_moment` | `moment.write` | 建立、修改、刪除動態 |
| `create_friend`、`update_friend`、`delete_friend` | `friend.write` | 建立、修改、刪除友鏈 |
| `get_config`、`update_config` | 對應分區的 `config.*` | 讀取與寫入設定項，參數與 `GET/POST /api/key/config/{section}` 一致 |

`update_config` 只能寫入目前分區允許的鍵，缺少分區權限或傳入越權鍵時傳回錯誤結果，並指明缺少的權限與被拒絕的鍵名。

### 用戶端設定

Claude Code、Cursor 等用戶端使用通用的 MCP 伺服器設定格式：

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://your-site/mcp",
      "headers": {
        "X-API-Key": "<你的金鑰>"
      }
    }
  }
}
```

### 偵錯

```bash
# 啟動 MCP Inspector，在介面中填入服務位址與 X-API-Key 請求標頭
npx @modelcontextprotocol/inspector
```

也可以直接用 curl 呼叫 MCP 方法：

```bash
curl -X POST https://your-site/mcp \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 存取控制

伺服器會驗證 `Host` 與 `Origin` 請求標頭，防止 DNS rebinding 攻擊。允許的網域來自 `FRONTEND_URL` 設定、本機位址與 `*.workers.dev`。網域與站點位址不一致時，可透過 `MCP_ALLOWED_HOSTS` 環境變數追加允許的網域，多個網域用英文逗號分隔：

```bash
MCP_ALLOWED_HOSTS=blog.example.com,www.example.com
```

網域條目支援帶協定或埠的寫法（`https://blog.example.com:443`）、萬用網域（`*.example.com`）與 `*`（關閉網域白名單，僅限內網或可信任代理環境）。部署指令會把 `MCP_ALLOWED_HOSTS` 與 `FRONTEND_URL` 寫入 Worker 變數，修改後重新執行部署即可生效。

### 自訂網域排查

透過自訂網域存取 `/mcp` 時，用戶端可能遇到兩類拒絕：

| 現象 | 來源 | 處理方式 |
| --- | --- | --- |
| `HTTP 421 Misdirected Request` | Cloudflare 邊緣：請求的 Host 沒有符合到該 Worker 的網域或路由 | 在 Cloudflare 控制台為 Worker 新增自訂網域（Custom Domain）或路由（Route），讓 `jiaoblog.dpdns.org` 指向該 Worker |
| `HTTP 403` 且回應主體包含 `Invalid Host: <網域>` | 伺服器的 DNS rebinding 防護 | 把該網域加入 `MCP_ALLOWED_HOSTS`，或把 `FRONTEND_URL` 設為站點根位址，然後重新部署 |

驗證指令：

```bash
curl -i -X POST https://jiaoblog.dpdns.org/mcp \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

## 文章管理

### 發布文章

```bash
curl -X POST https://your-site/api/key/feed \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "文章標題",
    "content": "# Markdown 正文",
    "summary": "摘要",
    "tags": ["Rin"],
    "listed": true,
    "draft": false
  }'
```

| 欄位 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 文章標題 |
| `content` | string | 是 | Markdown 正文 |
| `summary` | string | 否 | 摘要 |
| `alias` | string | 否 | 自訂存取別名 |
| `tags` | string[] | 否 | 標籤清單 |
| `listed` | boolean | 否 | 是否在清單中顯示，預設 `true` |
| `draft` | boolean | 否 | 是否為草稿，預設 `true` |
| `createdAt` | string | 否 | 發布時間，ISO 8601 格式 |

### 修改文章

```bash
curl -X POST https://your-site/api/key/feed/12 \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新標題",
    "content": "更新後的正文",
    "draft": false
  }'
```

只傳需要修改的欄位即可，未傳的欄位保持原值。

### 刪除文章

```bash
curl -X DELETE https://your-site/api/key/feed/12 \
  -H "X-API-Key: <你的金鑰>"
```

## 友鏈管理

### 建立友鏈

```bash
curl -X POST https://your-site/api/key/friend \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "友站名稱",
    "desc": "友站簡介",
    "avatar": "https://example.com/avatar.png",
    "url": "https://example.com",
    "group": "預設"
  }'
```

| 欄位 | 類型 | 必填 | 說明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 站點名稱，最長 20 字元 |
| `desc` | string | 是 | 站點簡介，最長 100 字元 |
| `avatar` | string | 是 | 頭像位址，最長 100 字元 |
| `url` | string | 是 | 站點位址，最長 100 字元 |
| `group` | string | 否 | 分組名稱，最長 20 字元 |
| `accepted` | boolean | 否 | 是否已通過審核，預設 `true` |
| `sort_order` | number | 否 | 排序值，預設 `0` |

### 修改友鏈

```bash
curl -X PUT https://your-site/api/key/friend/3 \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{ "desc": "更新後的簡介" }'
```

### 刪除友鏈

```bash
curl -X DELETE https://your-site/api/key/friend/3 \
  -H "X-API-Key: <你的金鑰>"
```

## 動態管理

### 發布動態

```bash
curl -X POST https://your-site/api/key/moment \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "今天天氣不錯" }'
```

### 修改動態

```bash
curl -X POST https://your-site/api/key/moment/5 \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "更新後的內容" }'
```

### 刪除動態

```bash
curl -X DELETE https://your-site/api/key/moment/5 \
  -H "X-API-Key: <你的金鑰>"
```

## 設定項

設定類介面統一為 `GET /api/key/config/{section}` 讀取、`POST /api/key/config/{section}` 寫入。寫入時只能包含該 section 允許的鍵，出現範圍外的鍵會傳回 `400` 並列出被拒絕的鍵名。

```bash
curl -X POST https://your-site/api/key/config/site \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{ "site.name": "新站名", "site.description": "新簡介" }'
```

### 各 section 可寫鍵

| section | 權限 | 可寫鍵 |
| --- | --- | --- |
| `site` | `config.site` | `site.name`、`site.description`、`site.avatar`、`site.page_size`、`announcement.content`、`announcement.speed` |
| `personalization` | `config.personalization` | `header.layout`、`header.behavior`、`feed.layout`、`feed.card_variant`、`theme.color` |
| `other` | `config.other` | `login.enabled`、`counter.enabled`、`rss`、`footer`、`cache.enabled` |
| `comment` | `config.comment` | `comment.enabled`、`comment.default`、`comment.systemOrder`、`twikoo.*`、`giscus.*`、`waline.*`、`cwd.*`、`gitalk.*`、`utterances.*`、`discuss.*` |
| `supportly` | `config.supportly` | `supportly.enabled`、`supportly.channelId`、`supportly.title`、`supportly.widgetUrl` |
| `webhook` | `config.webhook` | `webhook_url`、`webhook.method`、`webhook.content_type`、`webhook.headers`、`webhook.body_template` |
| `friend` | `config.friend` | `friend_apply_enable`、`friend_groups`、`friend_group_order`、`friend_crontab`、`friend_ua` |
| `maintenance` | `config.maintenance` | `cache.enabled` |
| `ai` | `config.ai` | `ai_search.enabled`、`ai_summary.enabled`、`ai_summary.provider`、`ai_summary.model`、`ai_summary.api_url`、`ai_summary.retries`、`ai_summary.api_key`、`ai_summary.failover`、`ai_summary.custom_code` |

網站圖示（`favicon`）不在任何 section 的可寫範圍內。

### 測試 Webhook

```bash
curl -X POST https://your-site/api/key/config/webhook/test \
  -H "X-API-Key: <你的金鑰>" \
  -H "Content-Type: application/json" \
  -d '{ "test_message": "測試訊息" }'
```

請求主體中的 `webhook_url` 等欄位可暫時覆寫已儲存的設定，僅對本次測試生效。

### 清除快取

```bash
curl -X DELETE https://your-site/api/key/config/cache \
  -H "X-API-Key: <你的金鑰>"
```

## 內容歸屬

透過 API 發布的文章與動態預設歸屬到使用者 ID `1` 的帳號。如需改為其他帳號，修改 `server/src/services/api-key-owner.ts` 中的 `API_KEY_CONTENT_OWNER_UID` 常數後重新部署。

## 錯誤回應

```json
{
  "success": false,
  "error": "This API key is missing the \"feed.write\" scope"
}
```

| 狀態碼 | 含義 |
| --- | --- |
| `400` | 請求參數不合法，或包含目前權限不可寫的設定鍵 |
| `401` | 缺少 API 金鑰，或金鑰無效、已輪換、已刪除 |
| `403` | 金鑰有效但缺少對應權限，或金鑰類型與介面不相符 |
| `404` | 目標資源或設定 section 不存在 |

## 安全建議

- 為不同用途建立不同的金鑰，依最小必要原則勾選權限。
- 不要在瀏覽器前端或公開儲存庫中暴露金鑰。
- 懷疑洩漏時立即輪換或刪除金鑰。
- 不再使用的金鑰及時刪除。