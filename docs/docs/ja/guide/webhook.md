# Webhook ガイド

Rin は以下の場合にカスタム Webhook へ通知を送信できます：

- 新しいコメントが作成されたとき
- 新しい友だちリンクの申請が送信されたとき

これを使って、Rin を Discord、Telegram ボット、Slack ゲートウェイ、Feishu、DingTalk、n8n、Zapier、または任意のカスタム HTTP エンドポイントに接続できます。

## 設定場所

デプロイ後、管理画面の **設定** ページを開き、**Webhook** セクションを見つけます。

`WEBHOOK_URL` 環境変数で初期デフォルト値を提供することもできますが、Webhook の動作を管理するには設定ページが推奨されます。

## サポートされるフィールド

Rin は現在、以下の Webhook 設定をサポートしています：

- `Webhook URL`：ターゲットエンドポイント。ここでもテンプレート変数がサポートされており、特に GET クエリ文字列に便利です。
- `Webhook Method`：`GET`、`POST`、`PUT`、`PATCH`、`DELETE`、`HEAD`、または `OPTIONS`
- `Webhook Content-Type`：例えば `application/json` や `text/plain`
- `Webhook Headers`：カスタムリクエストヘッダー用の JSON テンプレート
- `Webhook Body Template`：非 GET リクエスト用のリクエスト本文テンプレート
- `Send Test Webhook`：未保存の編集を含む、現在のページの値を使用してテストリクエストを送信します

## テンプレート変数

Webhook URL、ヘッダー、本文テンプレートで以下の変数を使用できます：

- `{{event}}`
- `{{message}}`
- `{{title}}`
- `{{url}}`
- `{{username}}`
- `{{content}}`
- `{{description}}`

## デフォルトの動作

`Webhook URL` のみを設定した場合、Rin は以下を使用します：

- method: `POST`
- content type: `application/json`
- headers: `{}`
- body:

```json
{"content":"{{message}}"}
```

## GET の例

Webhook プロバイダーがクエリパラメータを期待する場合、URL に直接変数を配置できます：

```text
https://example.com/webhook?event={{event}}&message={{message}}&title={{title}}
```

推奨設定：

- Method: `GET`
- Body template: デフォルトのままにするか無視します

Rin は GET スタイルの URL のクエリパラメータ値を URL エンコードします。

## JSON POST の例

エンドポイントが JSON を受け入れる場合は、以下の設定を使用します：

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

## 注意事項

- `GET` および `HEAD` リクエストはリクエスト本文を送信しません。
- Webhook URL 内のテンプレート変数は、置換前に URL エンコードされます。
- `Webhook Headers` はテンプレートレンダリング後に有効な JSON である必要があります。
- `Webhook Headers` または `Webhook Body Template` が有効な JSON の場合、Rin は挿入された値を JSON 文字列としてエスケープし、JSON 構造が壊れないようにします。
- 本文テンプレートが有効な JSON でない場合、Rin はプレーンテキストの置換動作を変更せずに維持します。
- テストボタンは、保存前にエンドポイントを検証する最速の方法です。

## トラブルシューティング

### テスト Webhook が JSON エラーで失敗した

`Webhook Headers` の値がテンプレートレンダリング後に有効な JSON ではありません。カンマ、引用符、波括弧を確認してください。

### リクエストは送信されたが、サービスが拒否した

以下を確認してください：

- HTTP メソッド
- `Content-Type`
- 認証ヘッダー
- 期待される JSON フィールド名
- エンドポイントが GET クエリパラメータを受け入れるか、POST 本文のみを受け入れるか

### シンプルなメッセージだけが欲しい

デフォルトを維持し、`Webhook URL` のみを設定します。Rin は以下を送信します：

```json
{"content":"<message>"}
```