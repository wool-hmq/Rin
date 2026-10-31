# 環境変数設定ガイド

Rin は **Variables（平文）** と **Secrets（暗号化）** の 2 種類の環境変数を必要とします。

## クイックリファレンス

| 種類 | 保存場所 | 用途 | 例 |
|------|---------|---------|----------|
| **Variables** | `wrangler.toml` に平文で保存 | 設定パラメータ、機能フラグ | バケット名、キャッシュモード |
| **Secrets** | Cloudflare に暗号化して保存 | 機密認証情報、キー | API キー、パスワード、トークン |

---

## Variables（平文）

これらの変数は `wrangler.toml` または GitHub Actions に平文で保存され、機能フラグと基本パラメータを制御します。

### サイト設定

| 変数 | 必須 | 説明 | デフォルト |
|----------|----------|-------------|---------|
| `NAME` | いいえ | サイト名とタイトル | Rin |
| `DESCRIPTION` | いいえ | サイトの説明 | A lightweight personal blogging system |
| `AVATAR` | いいえ | サイトアバター URL | - |
| `PAGE_SIZE` | いいえ | デフォルトのページネーションサイズ | 5 |
| `RSS_ENABLE` | いいえ | RSS リンクを有効化 | false |
| `FRONTEND_URL` | いいえ | sitemap.xml と robots.txt 生成用の正規サイトオリジン（マルチドメイン展開に推奨） | リクエストオリジン |

:::tip
サイト設定はデプロイ後に **設定ページ** から変更できます。環境変数は初期デフォルト値としてのみ機能します。
:::

### ストレージ設定

| 変数 | 必須 | 説明 | デフォルト | 例 |
|----------|----------|-------------|---------|---------|
| `S3_FOLDER` | はい | 画像ストレージパス | images/ | `images/` |
| `S3_CACHE_FOLDER` | いいえ | キャッシュファイルパス | cache/ | `cache/` |
| `S3_BUCKET` | はい | S3 バケット名 | - | `my-bucket` |
| `S3_REGION` | はい | S3 リージョン（R2 の場合は 'auto' を使用） | - | `auto` |
| `S3_ENDPOINT` | はい | S3 エンドポイント URL | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | いいえ | パブリックアクセス URL | S3_ENDPOINT と同じ | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | いいえ | path-style URL を強制 | false | `false` |

### 機能フラグ

| 変数 | 必須 | 説明 | デフォルト | 推奨 |
|----------|----------|-------------|---------|-------------|
| `CACHE_STORAGE_MODE` | いいえ | キャッシュモード: s3/database | s3 | **database** |
| `WEBHOOK_URL` | いいえ | コメント通知 Webhook | - | - |
| `RSS_TITLE` | いいえ | RSS フィードタイトル | Rin Development | - |
| `RSS_DESCRIPTION` | いいえ | RSS フィードの説明 | Development Environment | - |
| `MCP_ALLOWED_HOSTS` | いいえ | MCP サーバーが許可する追加ホスト名。カンマ区切り（デフォルトは `FRONTEND_URL`、ローカルアドレス、`*.workers.dev`）。エントリにはスキームやポートを含められ（`https://blog.example.com:443`）、ワイルドカードドメイン（`*.example.com`）や `*` を使用してホスト名許可リストを無効化可能（信頼できる環境のみ） | - | `blog.example.com,www.example.com` |

:::tip 新規ユーザー向け
`CACHE_STORAGE_MODE` を `database` に設定することを推奨します。追加の S3 キャッシュ設定なしでデプロイの複雑さを軽減できます。
:::

---

## Secrets（暗号化）

これらの機密値は **Cloudflare Workers Secrets** として設定する必要があり、デプロイ時に CLI で入力するか、事前に設定します。

### 認証

| 変数 | 必須 | 説明 | 取得方法 |
|----------|----------|-------------|---------------|
| `ADMIN_USERNAME` | 条件付き | パスワードログイン用のユーザー名 | 自分で設定 |
| `ADMIN_PASSWORD` | 条件付き | パスワードログイン用のパスワード | 自分で設定 |
| `RIN_GITHUB_CLIENT_ID` | 条件付き | GitHub OAuth クライアント ID | GitHub OAuth App 設定 |
| `RIN_GITHUB_CLIENT_SECRET` | 条件付き | GitHub OAuth クライアントシークレット | GitHub OAuth App 設定 |
| `RIN_GITEE_CLIENT_ID` | 条件付き | Gitee OAuth クライアント ID | Gitee OAuth App 設定 |
| `RIN_GITEE_CLIENT_SECRET` | 条件付き | Gitee OAuth クライアントシークレット | Gitee OAuth App 設定 |
| `RIN_QQ_TOKEN` | 条件付き | 心躍 QQ ログイントークン | https://qq.wch666.com/ で申請 |
| `RIN_WECHAT_APPID` | 条件付き | 聚合登録 WeChat App ID | https://login.mapay.cn/ で申請 |
| `RIN_WECHAT_APPKEY` | 条件付き | 聚合登録 WeChat App Secret | https://login.mapay.cn/ で申請 |
| `EMAIL_SEND_URLS` | 条件付き | MailPort 送信 URL（JSON 配列。単一送信者の場合は配列の角括弧を省略可能 — 下記の形式に関する注記を参照） | [MailPort](https://github.com/wool-hmq/mailport) をデプロイし、送信者ページを確認 |
| `EMAIL_SEND_KEYS` | 条件付き | MailPort API キー（JSON 配列または単一文字列。`EMAIL_SEND_URLS` と順番に対応） | MailPort 送信者ページで生成 |
| `EMAIL_RESEND_URL` | 条件付き | レガシーメールリレーサービス URL（Vercel にデプロイした Rin-Email プロジェクト）。`EMAIL_SEND_URLS` が未設定の場合のフォールバックとして使用 | Rin-Email を Vercel にデプロイして URL を取得 |
| `EMAIL_RESEND_PASS` | 条件付き | レガシーメールリレーサービスの認証パスワード（Vercel プロジェクトの EMAIL_PASS と同じ） | 自分で設定 |
| `JWT_SECRET` | **はい** | JWT 署名キー（任意のランダム文字列） | 自分で生成 |

:::warning メールリレーアーキテクチャ
Cloudflare Workers は生の TCP SMTP をサポートしていません。メール認証は [MailPort](https://github.com/wool-hmq/mailport) 送信サービスによって処理されます：

1. MailPort をデプロイし、送信者を作成して、配信方法（SMTP / HTTP API / Outlook または Gmail OAuth）を設定
2. Rin ブログが認証コードリクエストを受信し、`EMAIL_SEND_URLS` のエンドポイントを呼び出し、`Authorization: Bearer <EMAIL_SEND_KEYS>` で認証
3. 許可される受信者ドメインは MailPort 送信者設定で管理

`EMAIL_SEND_URLS` と `EMAIL_SEND_KEYS` は順番に 1 対 1 で対応し、ポーリングされます：最初のエンドポイントが失敗した場合は次が試され、すべて失敗した場合にのみエラーが発生します。

`EMAIL_SEND_URLS` が未設定の場合、Rin はレガシーの `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email プロジェクト）にフォールバックします。

**形式**

`EMAIL_SEND_URLS` は送信 URL の JSON 配列で、各要素は MailPort 送信者の完全な送信エンドポイントで、`https://<your-domain>/api/<sender-id>/send` のような形式です。`EMAIL_SEND_KEYS` は対応する API キーを保持し、JSON 配列にすることもできます。

単一送信者の場合、`EMAIL_SEND_KEYS` は配列の角括弧が不要なプレーン文字列にできます：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

それぞれ独自のキーを持つ複数の送信者の場合、2 つの配列はインデックスで対応します：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

複数の送信者が 1 つのキーを共有する場合、すべてのエンドポイントに適用される単一のキーを記述します：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

`EMAIL_SEND_KEYS` が複数の値を提供する場合、その数は `EMAIL_SEND_URLS` と一致する必要があります（または単一の共有キーを提供）。不一致の場合、送信時に失敗します。
:::

:::note キャプチャ画像（人間による検証）
セルフサービス友だちリンクフロー（メールによる申請 / 変更 / 削除）では、自動化された悪用を防ぐために申請者の最初のメールでキャプチャ検証が必要です：

1. 申請者が「友链申请 / 友链修改 / 友链删除」（申請 / 変更 / 削除）を受信アドレスに送信
2. Rin がキャプチャ画像（ノイズラインとドット付きの 4 文字）を生成し、**インライン画像**として申請者に送信
3. 申請者がそれらの 4 文字のみを含む新しいメールで返信
4. キャプチャが通過した後、通常の JSON テンプレートフローが続行されます

これは MailPort のインライン画像サポートに依存し、**新しい環境変数は不要**です — `EMAIL_SEND_URLS` + `EMAIL_SEND_KEYS` を再利用します。レガシーの Rin-Email リレーはインライン画像をサポートしていません。まだ使用中の場合は、キャプチャステップが自動的にスキップされます。
:::

:::warning 認証が必要
以下の認証方法のうち少なくとも **1 つ** を設定する必要があります：
- GitHub OAuth（`RIN_GITHUB_CLIENT_ID` + `RIN_GITHUB_CLIENT_SECRET`）
- Gitee OAuth（`RIN_GITEE_CLIENT_ID` + `RIN_GITEE_CLIENT_SECRET`）
- QQ ログイン（`RIN_QQ_TOKEN`）
- WeChat ログイン（`RIN_WECHAT_APPID` + `RIN_WECHAT_APPKEY`）
- メール認証コードログイン（`EMAIL_SEND_URLS` + `EMAIL_SEND_KEYS`、またはレガシーの `EMAIL_RESEND_URL` + `EMAIL_RESEND_PASS`）
- ユーザー名/パスワード（`ADMIN_USERNAME` + `ADMIN_PASSWORD`）

そうしないと管理パネルにアクセスできません。
:::

:::note QQ コールバック URL
QQ ログインのコールバック URL は `https://<your-domain>/api/user/xinyueqq/callback` に固定されています。心躍のトークンに対して同じコールバック URL を設定する必要があります。パスはコード内にハードコードされており、環境変数は不要です。
:::

### S3 ストレージ認証情報

| 変数 | 必須 | 説明 | 取得方法 |
|----------|----------|-------------|---------------|
| `S3_ACCESS_KEY_ID` | 条件付き | S3 アクセスキー ID | R2 API トークン ID |
| `S3_SECRET_ACCESS_KEY` | 条件付き | S3 シークレットアクセスキー | R2 API トークン |

:::tip
`CACHE_STORAGE_MODE=database` の場合、S3 ストレージ認証情報はオプションであり、画像アップロードにのみ必要です。
:::

### Cloudflare バインディング（環境変数ではない）

以下は `wrangler.toml` で設定される Cloudflare Worker バインディングであり、環境変数ではありません：

| バインディング | 型 | 説明 |
|---------|------|-------------|
| `DB` | D1 Database | データベースバインディング |
| `ASSETS` | R2 / 静的アセット | 静的アセットバインディング（オプション） |
| `AI` | AI | Cloudflare AI モデルバインディング |

---

## GitHub Actions 変数

GitHub Actions で自動デプロイを使用する場合、リポジトリ設定で以下を構成します：

### リポジトリ変数（Settings → Secrets and variables → Variables）

| 変数 | 必須 | 説明 | デフォルト |
|----------|----------|-------------|---------|
| `NAME` | いいえ | サイト名 | Rin |
| `DESCRIPTION` | いいえ | サイトの説明 | A lightweight personal blogging system |
| `AVATAR` | いいえ | サイトアバター URL | - |
| `PAGE_SIZE` | いいえ | ページネーションサイズ | 5 |
| `RSS_ENABLE` | いいえ | RSS を有効化 | false |
| `CACHE_STORAGE_MODE` | いいえ | キャッシュモード | s3 |
| `S3_CACHE_FOLDER` | いいえ | キャッシュファイルパス | cache/ |
| `S3_FOLDER` | いいえ | 画像ストレージパス | images/ |
| `S3_REGION` | いいえ | S3 リージョン | auto |
| `S3_FORCE_PATH_STYLE` | いいえ | path-style を強制 | false |
| `RSS_TITLE` | いいえ | RSS タイトル | Rin Development |
| `RSS_DESCRIPTION` | いいえ | RSS の説明 | Development Environment |
| `WEBHOOK_URL` | いいえ | コメント通知 Webhook | - |
| `REPO_WORKER_NAME` | いいえ | Worker 名 | rin-server |
| `REPO_DB_NAME` | いいえ | D1 データベース名 | rin |
| `R2_BUCKET_NAME` | いいえ | R2 バケット名 | - |
| `EMAIL_SEND_URLS` | 条件付き | MailPort 送信 URL（JSON 配列） | - |

### リポジトリシークレット（Settings → Secrets and variables → Secrets）

| 変数 | 必須 | 説明 |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | はい | Cloudflare API トークン |
| `CLOUDFLARE_ACCOUNT_ID` | はい | Cloudflare アカウント ID |
| `S3_ENDPOINT` | 条件付き | S3/R2 エンドポイント URL |
| `S3_ACCESS_HOST` | 条件付き | S3/R2 アクセスドメイン |
| `S3_BUCKET` | 条件付き | S3 バケット名 |
| `S3_ACCESS_KEY_ID` | 条件付き | S3 アクセスキー ID |
| `S3_SECRET_ACCESS_KEY` | 条件付き | S3 シークレットアクセスキー |
| `JWT_SECRET` | **はい** | JWT 署名キー |
| `RIN_GITHUB_CLIENT_ID` | 条件付き | GitHub OAuth ID |
| `RIN_GITHUB_CLIENT_SECRET` | 条件付き | GitHub OAuth Secret |
| `RIN_GITEE_CLIENT_ID` | 条件付き | Gitee OAuth ID |
| `RIN_GITEE_CLIENT_SECRET` | 条件付き | Gitee OAuth Secret |
| `RIN_QQ_TOKEN` | 条件付き | 心躍 QQ ログイントークン |
| `ADMIN_USERNAME` | 条件付き | 管理者ユーザー名 |
| `ADMIN_PASSWORD` | 条件付き | 管理者パスワード |
| `EMAIL_SEND_KEYS` | 条件付き | MailPort API キー（`EMAIL_SEND_URLS` と順番に対応） |

---

## ローカル開発環境

ローカル開発では `.env` ファイルを使用します（`.env.example` を参照）：

```bash
# サイト設定
NAME="My Blog"
DESCRIPTION="A personal blog"
AVATAR=https://example.com/avatar.png
PAGE_SIZE=5
RSS_ENABLE=false

# S3 ストレージ（R2 または MinIO）
S3_FOLDER=images/
S3_CACHE_FOLDER=cache/
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_HOST=https://cdn.example.com
S3_FORCE_PATH_STYLE=false

# キャッシュモード
CACHE_STORAGE_MODE=database

# Webhook
WEBHOOK_URL=

# RSS
RSS_TITLE=My Blog
RSS_DESCRIPTION=My Personal Blog

# 認証（少なくとも 1 つ設定）

# オプション 1: GitHub OAuth
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx

# オプション 2: Gitee OAuth
RIN_GITEE_CLIENT_ID=xxx
RIN_GITEE_CLIENT_SECRET=xxx

# オプション 3: 心躍 QQ ログイン
RIN_QQ_TOKEN=xxx

# オプション 4: 聚合登録 WeChat
RIN_WECHAT_APPID=xxx
RIN_WECHAT_APPKEY=xxx

# オプション 5: メール認証コードログイン
# MailPort（https://github.com/wool-hmq/mailport）をデプロイ後、以下の変数を設定：
# - MailPort プロジェクト：送信者を作成し、配信方法と許可ドメインを設定し、API キーを生成
# - Rin ブログ環境変数：EMAIL_SEND_URLS は送信 URL の JSON 配列、EMAIL_SEND_KEYS は対応するキーを保持
#   単一送信者（キーはプレーン文字列でも可）：
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-mailport-api-key
#   複数送信者（キーはインデックスで対応、または 1 つの共有キー）：
# EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
# EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
# レガシーフォールバック（上記 2 つの変数が未設定の場合のみ使用。Rin-Email を Vercel にデプロイする必要あり）：
EMAIL_RESEND_URL=https://your-rin-email.vercel.app/api/send
EMAIL_RESEND_PASS=your-email-pass

# オプション 6: ユーザー名/パスワードログイン
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# JWT シークレット（必須）
JWT_SECRET=random_secret_key

# S3 認証情報（S3 ストレージを使用する場合は必須）
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

---

## 最小デプロイチェックリスト

### ユーザー名/パスワードログインのみ（最小構成）

| 変数 | 種類 | 必須 |
|----------|------|----------|
| `JWT_SECRET` | Secret | はい |
| `ADMIN_USERNAME` | Secret | はい |
| `ADMIN_PASSWORD` | Secret | はい |
| `S3_FOLDER` | Variable | はい |
| `S3_BUCKET` | Variable | はい |
| `S3_REGION` | Variable | はい |
| `S3_ENDPOINT` | Variable | はい |
| `S3_ACCESS_KEY_ID` | Secret | 条件付き |
| `S3_SECRET_ACCESS_KEY` | Secret | 条件付き |

### フル構成（全機能）

サイト設定、すべての OAuth プロバイダー、メールログイン、S3 ストレージ、Webhook、RSS を含みます。

---

## FAQ

### Q: `CACHE_STORAGE_MODE=database` の場合、S3 設定は必要ですか？

いいえ。`database` モードではキャッシュを D1 データベースに保存し、S3/R2 は不要です。ただし、画像アップロードが必要な場合は S3 設定が依然として必要です。

### Q: 複数のログイン方法を同時に有効にできますか？

はい。複数の方法の認証情報を設定すると、フロントエンドが対応するログインボタンを自動的に表示します。

### Q: メール認証コードログインを設定するには？

メール認証は [MailPort](https://github.com/wool-hmq/mailport) 送信サービスによって処理されます：

1. MailPort をデプロイし、送信者を作成して、配信方法（SMTP / HTTP API / Outlook または Gmail OAuth）を設定
2. MailPort 送信者ページで API キーを生成し、必要に応じて許可する受信者ドメインを設定
3. Cloudflare Worker で設定：
   - `EMAIL_SEND_URLS` = MailPort 送信者の完全な送信エンドポイント（JSON 配列、複数可）
   - `EMAIL_SEND_KEYS` = 対応する API キー（エンドポイントと順番に対応）

`EMAIL_SEND_URLS` と `EMAIL_SEND_KEYS` は順番にポーリングされます：最初のエンドポイントが失敗した場合は次が試され、すべて失敗した場合にのみエラーが発生します。
これらの 2 つの変数が未設定の場合、Rin はレガシーの `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email）にフォールバックします。

### Q: `EMAIL_SEND_URLS` と `EMAIL_SEND_KEYS` はどのような JSON 形式を使用しますか？

`EMAIL_SEND_URLS` は送信 URL の JSON 配列で、それぞれ `https://<your-domain>/api/<sender-id>/send` の形式です。`EMAIL_SEND_KEYS` はそれらと順番に対応するキーを保持します。

単一送信者の場合、キーはプレーン文字列でも可：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

それぞれ独自のキーを持つ複数の送信者の場合、配列はインデックスで対応します：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

複数の送信者が 1 つのキーを共有する場合、単一のキーを記述します：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

キーの数は URL の数と一致する必要があります。または単一の共有キーを提供してください。不一致の場合、送信時に失敗します。

### Q: 許可するメールドメインを制限するには？

MailPort 送信者設定の「許可する受信者ドメイン」リストに許可するドメインを追加します。それらのドメインの受信者にのみ配信されます。

リストを空のままにすると、すべてのドメインが許可されます。

### Q: MailPort はどのような配信方法をサポートしていますか？

MailPort は以下の配信方法をサポートしています：
- SMTP: 任意の SMTP プロバイダー（163 Mail、QQ Mail、Gmail など）
- HTTP API: カスタム HTTP エンドポイントへの転送
- Outlook OAuth2 / Gmail OAuth2: アプリパスワードなしで送信

[MailPort プロジェクトドキュメント](https://mailport.lab.j3.ink/en) を参照してください。