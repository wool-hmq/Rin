# Webhook 指南

Rin 可以在以下情境向自訂 webhook 發送通知：

- 有新評論時
- 有新的友連申請時

你可以用它把 Rin 接到 Discord、Telegram Bot、Slack 閘道、飛書、釘釘、n8n、Zapier，或你自己的 HTTP 服務。

## 在哪裡設定

部署完成後，進入後台 **設定** 頁面，找到 **Webhook** 設定區。

你也可以透過 `WEBHOOK_URL` 環境變數提供一個初始預設值，但更推薦在設定頁中統一管理 webhook 行為。

## 支援的設定項目

Rin 目前支援以下 webhook 設定：

- `Webhook URL`：目標位址。這裡也支援範本變數，特別適合 GET 情境拼接 query string。
- `Webhook Method`：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、`OPTIONS`
- `Webhook Content-Type`：例如 `application/json`、`text/plain`
- `Webhook Headers`：用於自訂請求標頭的 JSON 範本
- `Webhook Body Template`：非 GET 請求使用的請求主體範本
- `發送測試 Webhook`：使用目前頁面上的值發送一次測試請求，尚未儲存的修改也會生效

## 範本變數

你可以在 webhook URL、請求標頭與請求主體範本中使用以下變數：

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## 預設行為

如果你只設定了 `Webhook URL`，Rin 預設會使用：

- Method：`POST`
- Content-Type：`application/json`
- Headers：`{}`
- Body：

```json
{"content":"{{message}}"}
```

## GET 範例

如果你的 webhook 服務希望透過 query 參數接收內容，可以直接在 URL 中寫入範本變數：

```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

建議設定：

- Method：`GET`
- Body Template：保持預設或忽略

Rin 會對 GET 風格 URL 中的查詢參數值進行 URL 編碼。

## JSON POST 範例

如果你的服務接收 JSON，可以這樣設定：

**Webhook URL**

```text
https://example.com/webhook
```

**Webhook Headers**

```json
{
  "X-Rin-Event": "{{event}}"
}
```

**Webhook Body Template**

```json
{
  "event": "{{event}}",
  "message": "{{message}}",
  "title": "{{title}}",
  "url": "{{url}}",
  "username": "{{username}}",
  "content": "{{content}}",
  "description": "{{description}}"
}
```

## 說明

- `GET` 與 `HEAD` 請求不會發送請求主體。
- webhook URL 中的範本變數在替換前會先進行 URL 編碼。
- `Webhook Headers` 在範本算繪後必須仍然是合法 JSON。
- 如果 `Webhook Headers` 或 `Webhook Body Template` 本身是合法 JSON，Rin 會依 JSON 字串規則轉義插入值，避免破壞 JSON 結構。
- 如果請求主體範本不是合法 JSON，Rin 會維持原有的純文字替換行為。
- 在正式儲存前，建議先用「發送測試 Webhook」驗證一次。

## 常見問題

### 測試 webhook 時出現 JSON 錯誤

表示 `Webhook Headers` 在範本算繪後不是合法 JSON。請檢查逗號、引號與括號是否正確。

### 請求已送出，但伺服端拒絕

請著重檢查：

- HTTP Method
- `Content-Type`
- 認證請求標頭
- JSON 欄位名稱是否符合對方要求
- 對方介面是接收 GET query 參數，還是只接收 POST body

### 我只想收到一則簡單訊息

保持預設設定，只填寫 `Webhook URL` 即可。Rin 會發送：

```json
{"content":"<message>"}
```
