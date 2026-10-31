# API ガイド

Rin は、ログインセッションなしでスクリプトや AI エージェントがサイトのコンテンツと設定を管理できる API キーベースのインターフェースを提供します。REST エンドポイントは `/api/key/` 配下にあり、MCP サーバーは `/mcp` にあります。

キーは互換性のない 2 つのタイプがあります：

- **REST API キー**：`/api/key/*` のみを呼び出し、スクリプトによる自動化に使用します。
- **MCP キー**：`/mcp` のみを呼び出し、Claude Code や Cursor などの MCP クライアントに使用します。

## API キーの作成

API キーを作成できるのは管理者のみです。管理者としてサインインし、管理画面の設定ページを開き、下部の API キーセクションまでスクロールします。REST API タブと MCP タブはそれぞれ独自のキーの一覧表示、作成、編集、ローテーション、削除を行います。

各キーは作成した管理者に属し、他のアカウントがそれらのキーを見ることはありません。

キーを作成する際に以下を選択します：

- **キータイプ**：REST API または MCP。タイプは作成時に固定され、変更できません。各タブは独自のキーのみを一覧表示します。
- **名前**：いつでも編集できるラベル。
- **スコープ**：このキーが使用できる機能。各機能領域は個別のスコープです。
- **保存モード**：
  - 暗号化（デフォルト）：キーは作成時に一度だけ表示され、その後はローテーションのみ可能です。
  - 表示可能：キーは暗号化して保存され、いつでも表示・コピーできます。

保存モードは作成時に固定されます。暗号化されたキーを表示可能にすることはできません。表示可能なキーはいつでもその機能をオフにでき、キーは引き続き動作しますが、平文の表示が停止されるだけです。後で表示できるキーが必要な場合は、新しいキーを作成してください。

## リクエストの送信

リクエストヘッダーにキーを送信します。どちらの形式も同等です：

```bash
# X-API-Key ヘッダー
curl -H "X-API-Key: <your-key>" https://your-site/api/key/help
```

```bash
# Authorization ヘッダー
curl -H "Authorization: Bearer <your-key>" https://your-site/api/key/help
```

キーは 32 文字です。キーがないか無効な場合は `401` を返します。必要なスコープがない有効なキーは `403` を返します。他のキータイプに対してキーを使用した場合も `403` を返します。例えば、REST API キーで `/mcp` を呼び出した場合です。

## 現在のキーの確認

```bash
curl -H "X-API-Key: <your-key>" https://your-site/api/key/help
```

レスポンスには、キーのスコープと各スコープで利用可能なエンドポイントが一覧表示されます：

```json
{
  "success": true,
  "key_id": 1,
  "scopes": ["feed.write"],
  "permissions": [
    {
      "scope": "feed.write",
      "title": "記事管理",
      "description": "API を通じて記事を作成、編集、削除します。",
      "endpoints": ["POST /api/key/feed", "POST /api/key/feed/:id", "DELETE /api/key/feed/:id"]
    }
  ],
  "base_path": "/api/key"
}
```

## スコープとエンドポイント

| スコープ | 目的 | エンドポイント |
| --- | --- | --- |
| `content.read` | コンテンツ読み取り（MCP） | `POST /mcp`（`tools/list`、`tools/call`） |
| `feed.write` | 記事 | `POST /api/key/feed`、`POST /api/key/feed/:id`、`DELETE /api/key/feed/:id` |
| `friend.write` | 友だちリンク | `POST /api/key/friend`、`PUT /api/key/friend/:id`、`DELETE /api/key/friend/:id` |
| `moment.write` | モーメント | `POST /api/key/moment`、`POST /api/key/moment/:id`、`DELETE /api/key/moment/:id` |
| `config.site` | サイト情報 | `GET/POST /api/key/config/site` |
| `config.personalization` | パーソナライゼーション | `GET/POST /api/key/config/personalization` |
| `config.other` | その他の設定（favicon を除く） | `GET/POST /api/key/config/other` |
| `config.comment` | コメント管理 | `GET/POST /api/key/config/comment` |
| `config.supportly` | Supportly ウィジェット | `GET/POST /api/key/config/supportly` |
| `config.webhook` | Webhook とテスト Webhook | `GET/POST /api/key/config/webhook`、`POST /api/key/config/webhook/test` |
| `config.friend` | 友だちリンク設定 | `GET/POST /api/key/config/friend` |
| `config.maintenance` | メンテナンス | `GET/POST /api/key/config/maintenance`、`DELETE /api/key/config/cache` |
| `config.ai` | AI 設定 | `GET/POST /api/key/config/ai` |

## MCP サーバー

サイトはルートパス `/mcp` で MCP（Model Context Protocol）サーバーを公開しているため、MCP 対応クライアント（Claude Code、Cursor、MCP Inspector など）は MCP キーでサイトのコンテンツを管理できます。

- トランスポート：Streamable HTTP
- エンドポイント：`https://your-site/mcp`
- 認証：`X-API-Key` または `Authorization: Bearer <your-key>` ヘッダーにキーを送信します。キーは MCP キーである必要があり、REST API キーで `/mcp` を呼び出すと `403` になります
- スコープフィルタリング：サーバーはキーが使用を許可されているツールのみを登録するため、未承認のツールは `tools/list` に表示されず、直接呼び出しても拒否されます
- 利用可能なスコープ：MCP キーは `content.read` に加えて書き込みと設定のスコープを保持できるため、1 つのキーでコンテンツの読み取りと維持の両方が可能です。REST API キーは `content.read` を選択できません

### ツールとスコープ

| ツール | 必要なスコープ | 目的 |
| --- | --- | --- |
| `whoami` | なし | 呼び出し元のキー、そのスコープ、利用可能なツールを返します |
| `list_posts` | `content.read` | `normal`、`draft`、`unlisted`、`all` のフィルタリングで記事を一覧表示します |
| `get_post` | `content.read` | ID またはエイリアスで記事全文を読み取ります |
| `search_posts` | `content.read` | タイトルキーワードで記事を検索します |
| `list_tags` | `content.read` | タグを一覧表示します |
| `list_moments` | `content.read` | モーメントを一覧表示します |
| `list_friends` | `content.read` | 友だちリンクを一覧表示します |
| `create_post`、`update_post`、`delete_post` | `feed.write` | 記事を作成、編集、削除します |
| `create_moment`、`update_moment`、`delete_moment` | `moment.write` | モーメントを作成、編集、削除します |
| `create_friend`、`update_friend`、`delete_friend` | `friend.write` | 友だちリンクを作成、編集、削除します |
| `get_config`、`update_config` | セクションの `config.*` スコープ | `GET/POST /api/key/config/{section}` と同様に設定を読み書きします |

`update_config` はリクエストされたセクションで書き込み可能なキーのみを受け付けます。セクションのスコープがない場合や、セクション外のキーの場合は、不足しているスコープと拒否されたキー名を示すエラー結果を返します。

### クライアント設定

Claude Code、Cursor などのクライアントは、一般的な MCP サーバー設定形式を使用します：

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://your-site/mcp",
      "headers": {
        "X-API-Key": "<your-key>"
      }
    }
  }
}
```

### デバッグ

```bash
# MCP Inspector を起動し、エンドポイントと X-API-Key ヘッダーを入力します
npx @modelcontextprotocol/inspector
```

MCP メソッドは curl で直接呼び出すこともできます：

```bash
curl -X POST https://your-site/mcp \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### アクセス制御

サーバーは `Host` と `Origin` ヘッダーを検証して DNS リバインディング攻撃をブロックします。許可されるホスト名は `FRONTEND_URL` 設定、ローカルアドレス、`*.workers.dev` から取得されます。提供されるドメインがサイトアドレスと異なる場合は、許可するホスト名を `MCP_ALLOWED_HOSTS` 環境変数にカンマ区切りで追加します：

```bash
MCP_ALLOWED_HOSTS=blog.example.com,www.example.com
```

エントリにはスキームやポートを含めることができ（`https://blog.example.com:443`）、ワイルドカードドメイン（`*.example.com`）や `*` を使用してホスト名許可リストを無効化できます（内部ネットワークと信頼できるプロキシのみ）。デプロイコマンドは `MCP_ALLOWED_HOSTS` と `FRONTEND_URL` を worker 変数に書き込むため、再デプロイで変更が適用されます。

### カスタムドメインのトラブルシューティング

クライアントがカスタムドメイン経由で `/mcp` にアクセスすると、2 種類の拒否に遭遇する可能性があります：

| 症状 | 発生元 | 修正方法 |
| --- | --- | --- |
| `HTTP 421 Misdirected Request` | Cloudflare エッジ：リクエストの Host がその worker のドメインまたはルートと一致しない | Cloudflare ダッシュボードでドメイン（例：`jiaoblog.dpdns.org`）を worker に Custom Domain または Route として関連付けます |
| `HTTP 403` で本文に `Invalid Host: <hostname>` が含まれる | サーバー側の DNS リバインディング保護 | ホスト名を `MCP_ALLOWED_HOSTS` に追加するか、`FRONTEND_URL` をサイトのオリジンに設定してから再デプロイします |

検証コマンド：

```bash
curl -i -X POST https://jiaoblog.dpdns.org/mcp \
  -H "X-API-Key: <your key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

## 記事

### 記事の作成

```bash
curl -X POST https://your-site/api/key/feed \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "記事タイトル",
    "content": "# Markdown 本文",
    "summary": "概要",
    "tags": ["Rin"],
    "listed": true,
    "draft": false
  }'
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `title` | string | はい | 記事タイトル |
| `content` | string | はい | Markdown 本文 |
| `summary` | string | いいえ | 概要 |
| `alias` | string | いいえ | カスタム URL エイリアス |
| `tags` | string[] | いいえ | タグリスト |
| `listed` | boolean | いいえ | 一覧に表示するかどうか。デフォルトは `true` |
| `draft` | boolean | いいえ | 下書きフラグ。デフォルトは `true` |
| `createdAt` | string | いいえ | 公開日時、ISO 8601 |

### 記事の編集

```bash
curl -X POST https://your-site/api/key/feed/12 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新しいタイトル",
    "content": "更新された本文",
    "draft": false
  }'
```

変更したいフィールドのみを送信します。省略されたフィールドは現在の値を保持します。

### 記事の削除

```bash
curl -X DELETE https://your-site/api/key/feed/12 \
  -H "X-API-Key: <your-key>"
```

## 友だちリンク

### 友だちリンクの作成

```bash
curl -X POST https://your-site/api/key/friend \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "友だちサイト",
    "desc": "簡単な説明",
    "avatar": "https://example.com/avatar.png",
    "url": "https://example.com",
    "group": "default"
  }'
```

| フィールド | 型 | 必須 | 説明 |
| --- | --- | --- | --- |
| `name` | string | はい | サイト名、最大 20 文字 |
| `desc` | string | はい | 説明、最大 100 文字 |
| `avatar` | string | はい | アバター URL、最大 100 文字 |
| `url` | string | はい | サイト URL、最大 100 文字 |
| `group` | string | いいえ | グループ名、最大 20 文字 |
| `accepted` | boolean | いいえ | 承認済みとしてマーク。デフォルトは `true` |
| `sort_order` | number | いいえ | 並べ替え値。デフォルトは `0` |

### 友だちリンクの編集

```bash
curl -X PUT https://your-site/api/key/friend/3 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "desc": "更新された説明" }'
```

### 友だちリンクの削除

```bash
curl -X DELETE https://your-site/api/key/friend/3 \
  -H "X-API-Key: <your-key>"
```

## モーメント

### モーメントの作成

```bash
curl -X POST https://your-site/api/key/moment \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "今日はいい天気" }'
```

### モーメントの編集

```bash
curl -X POST https://your-site/api/key/moment/5 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "更新された内容" }'
```

### モーメントの削除

```bash
curl -X DELETE https://your-site/api/key/moment/5 \
  -H "X-API-Key: <your-key>"
```

## 設定

設定エンドポイントは `GET /api/key/config/{section}` で読み取り、`POST /api/key/config/{section}` で書き込みます。書き込みにはそのセクションで許可されたキーのみを含めることができます。範囲外のキーがあると、リクエストは `400` で失敗し、拒否されたキー名が返されます。

```bash
curl -X POST https://your-site/api/key/config/site \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "site.name": "新しい名前", "site.description": "新しい説明" }'
```

### セクション別の書き込み可能キー

| セクション | スコープ | 書き込み可能キー |
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

favicon はどのセクションからも書き込みできません。

### Webhook のテスト

```bash
curl -X POST https://your-site/api/key/config/webhook/test \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "test_message": "テストメッセージ" }'
```

本文の `webhook_url` などの値は、この 1 回のテストのみ保存された設定を上書きします。

### キャッシュのクリア

```bash
curl -X DELETE https://your-site/api/key/config/cache \
  -H "X-API-Key: <your-key>"
```

## コンテンツの所有権

API を通じて作成された記事とモーメントは、ユーザー ID `1` に帰属します。別のアカウントを使用するには、`server/src/services/api-key-owner.ts` の `API_KEY_CONTENT_OWNER_UID` を変更して再デプロイします。

## エラーレスポンス

```json
{
  "success": false,
  "error": "This API key is missing the \"feed.write\" scope"
}
```

| ステータス | 意味 |
| --- | --- |
| `400` | 無効なパラメータ、または許可されたセクション外の設定キー |
| `401` | API キーがない、無効、ローテーション済み、または削除済み |
| `403` | 必要なスコープがない有効なキー、またはキータイプがエンドポイントと一致しない |
| `404` | リソースまたは設定セクションが見つからない |

## セキュリティに関する注意

- 用途ごとに 1 つのキーを作成し、必要なスコープのみを付与してください。
- ブラウザコードや公開リポジトリにキーを含めないでください。
- 漏洩が疑われる場合は、直ちにキーをローテーションまたは削除してください。
- 使用しなくなったキーは削除してください。