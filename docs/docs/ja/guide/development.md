# ローカル開発ガイド

このドキュメントでは、Rin プロジェクトをローカルで開発およびデバッグする方法を説明します。

## クイックスタート

### 1. プロジェクトをクローン

```bash
git clone https://github.com/openRin/Rin.git
# またはフォークを使用: git clone https://github.com/wool-hmq/Rin.git
cd Rin
```

または

```bash
git clone https://github.com/wool-hmq/Rin.git
cd Rin
```

### 2. 依存関係をインストール

```bash
bun install
```

### 3. 環境変数を設定

```bash
# サンプル設定ファイルをコピー
cp .env.example .env.local

# 実際の設定で設定ファイルを編集
vim .env.local  # またはお好みのエディタを使用
```

### 4. 開発サーバーを起動

```bash
bun run dev
```

これにより自動的に以下が実行されます：
- ✅ `wrangler.toml` 設定ファイルを生成
- ✅ `.dev.vars` 機密情報ファイルを生成
- ✅ データベースマイグレーションを実行
- ✅ 開発サーバーを起動（ポート 11498 - フロントエンドとバックエンドを統合）

http://localhost:11498 にアクセスして開発を開始してください！

## 環境変数の設定

すべての設定は `.env.local` ファイルに集約されています：

### サイト設定

:::tip
サイト設定（名前、アバター、説明、ページネーションサイズなど）は現在バックエンドから動的に提供され、デプロイ後に設定ページから変更できます。環境変数はデフォルト値としてのみ使用されます。

以下の環境変数は任意です：

| 変数 | 必須 | 説明 | 例 |
|----------|----------|-------------|---------|
| `NAME` | いいえ | ウェブサイト名（後で変更可能） | `My Blog` |
| `AVATAR` | いいえ | アバター URL（後で変更可能） | `https://...` |
| `DESCRIPTION` | いいえ | ウェブサイトの説明（後で変更可能） | `A blog` |
| `PAGE_SIZE` | いいえ | ページネーションサイズ（後で変更可能） | `5` |
| `RSS_ENABLE` | いいえ | RSS を有効化（後で変更可能） | `false` |

### バックエンド設定

| 変数 | 必須 | 説明 | 例 |
|----------|----------|-------------|---------|
| `S3_ENDPOINT` | はい | S3/R2 エンドポイント | `https://...r2.cloudflarestorage.com` |
| `S3_BUCKET` | はい | バケット名 | `images` |
| `S3_REGION` | いいえ | リージョン | `auto` |
| `S3_FOLDER` | いいえ | 画像ストレージパス | `images/` |
| `WEBHOOK_URL` | いいえ | 通知 Webhook | `https://...` |

### 機密設定（必須）

| 変数 | 説明 |
|----------|-------------|
| `RIN_GITHUB_CLIENT_ID` | GitHub OAuth クライアント ID |
| `RIN_GITHUB_CLIENT_SECRET` | GitHub OAuth クライアントシークレット |
| `RIN_GITEE_CLIENT_ID` | Gitee OAuth クライアント ID |
| `RIN_GITEE_CLIENT_SECRET` | Gitee OAuth クライアントシークレット |
| `RIN_QQ_TOKEN` | 心躍 QQ ログイントークン |
| `RIN_WECHAT_APPID` | 聚合登録 WeChat App ID |
| `RIN_WECHAT_APPKEY` | 聚合登録 WeChat App Secret |
| `JWT_SECRET` | JWT 署名キー |
| `S3_ACCESS_KEY_ID` | S3 アクセスキー |
| `S3_SECRET_ACCESS_KEY` | S3 シークレットキー |

## よく使うコマンド

```bash
# 完全な開発環境を起動（推奨）
bun run dev

# フロントエンドのみ起動
bun run dev:client

# バックエンドのみ起動
bun run dev:server

# データベースマイグレーションを実行
bun run db:migrate

# データベースマイグレーションファイルを生成
bun run db:generate

# 設定ファイルを再生成
bun run dev:setup

# プロジェクトをビルド
bun run build

# 生成されたファイルをクリーン
bun run clean

# 型チェックを実行
bun run check

# コードをフォーマット
bun run format:write
bun run format:check

# テストを実行
bun run test              # すべてのテストを実行
bun run test:server       # サーバーテストのみ実行
 bun run test:coverage     # カバレッジ付きでテストを実行
```

## 開発ワークフロー

### 初回セットアップ

1. プロジェクトリポジトリをフォーク
2. ローカルにクローン
3. 依存関係をインストール: `bun install`
4. `.env.local` を設定
5. `bun run dev` を実行

### 日常の開発

1. コードを変更
2. フロントエンドは自動ホットリロード、バックエンドは変更時に自動再起動
3. 機能をテスト
4. コードをコミット

### データベースの変更

1. `server/src/db/schema.ts` を変更
2. `bun run db:generate` を実行してマイグレーションファイルを生成
3. `bun run db:migrate` を実行してマイグレーションを適用

## テスト

プロジェクトはクライアントとサーバーで異なるテストフレームワークを使用しています：

### クライアントテスト（Vitest）

クライアントテストは React コンポーネントテスト用に jsdom 環境で Vitest を使用します。

```bash
# クライアントテストを実行
cd client && bun run test

# ウォッチモード
cd client && bun run test:watch

# カバレッジ付き
cd client && bun run test:coverage
```

テストファイルの場所: `client/src/**/__tests__/*.test.ts`

### サーバーテスト（Bun）

サーバーテストはインメモリ SQLite データベースで Bun のネイティブテストランナーを使用します。

```bash
# サーバーテストを実行
cd server && bun run test

# カバレッジ付き
cd server && bun run test:coverage
```

テストファイルの場所:
- ユニットテスト: `server/src/**/__tests__/*.test.ts`
- 統合テスト: `server/tests/integration/`
- セキュリティテスト: `server/tests/security/`

### 新しいテストの追加

新機能を追加する際は、対応するテストを含めてください：

1. **クライアント**: `client/src/**/__tests__/*.test.ts` にテストを追加
2. **サーバー**: `server/src/**/__tests__/*.test.ts` または `server/tests/` にテストを追加

## API アーキテクチャ

### カスタム API クライアント

プロジェクトは型安全な API 通信のために Eden の代わりにカスタム HTTP クライアントを使用します：

- **場所**: `client/src/api/client.ts`
- **機能**: 型安全なリクエスト、エラーハンドリング、認証トークン管理
- **使用方法**: すべての API 呼び出しは型付きクライアントを経由します

### 共有型（@rin/api）

`@rin/api` パッケージはクライアントとサーバーの両方に共有 TypeScript 型を提供します：

- **場所**: `packages/api/`
- **目的**: API 契約のエンドツーエンド型安全性
- **使用方法**: クライアントとサーバーコードの両方で `@rin/api` から型をインポート

新しい API エンドポイントを追加する場合：
1. `packages/api/src/types.ts` に型を定義
2. `server/src/services/` にサーバーハンドラーを実装
3. クライアントは共有型を通じて自動的に型安全性を得る

## トラブルシューティング

### ポートが既に使用中

ポート 5173 または 11498 が使用中の場合、`.env.local` の設定を変更できます：

```bash
# フロントエンドポートを変更（vite.config.ts で設定が必要）
# バックエンドポートを変更
bun run dev:server -- --port 11499
```

### データベースマイグレーションに失敗した

```bash
# ローカルデータベースをクリーンして再マイグレーション
rm -rf .wrangler/state
bun run db:migrate
```

### 設定ファイルが生成されない

```bash
# 設定生成を手動で実行
bun run dev:setup
```

### GitHub OAuth 設定

ローカル開発では GitHub OAuth を設定する必要があります：

1. https://github.com/settings/developers にアクセス
2. 新しい OAuth App を作成
3. Authorization callback URL: `http://localhost:11498/api/user/github/callback`
4. Client ID と Client Secret を `.env.local` に記入

## プロジェクト構造

```
.
├── client/                 # フロントエンドコード (React + Vite)
│   ├── src/
│   │   ├── page/          # ページコンポーネント
│   │   ├── api/           # API クライアント
│   │   ├── components/    # React コンポーネント
│   │   └── utils/         # ユーティリティ関数
│   └── package.json
├── server/                 # バックエンドコード (Cloudflare Workers)
│   ├── src/
│   │   ├── services/      # ビジネスサービス
│   │   ├── db/            # データベーススキーマ
│   │   ├── core/          # ルーターとコア型
│   │   └── utils/         # ユーティリティ関数
│   ├── tests/             # テストファイル
│   └── package.json
├── packages/               # 共有パッケージ
│   └── api/                # @rin/api - 共有 API 型
├── cli/                    # Rin CLI ツール
│   ├── bin/               # 薄い実行可能エントリポイント
│   ├── src/               # コマンド、タスク、共有ヘルパー
│   └── templates/         # Git フックとファイルテンプレート
├── scripts/                # CLI タスクの互換ラッパー
├── docs/                   # ドキュメント
├── .env.example            # 環境変数の例
├── .env.local              # ローカル設定（Git にコミットされない）
└── package.json
```

## 本番デプロイ

本番デプロイ手順については [デプロイガイド](./deploy.mdx) を参照してください。

## ヘルプ

- 📖 [羊角快車二次創作版ドキュメント](https://rin.lab.j3.ink)
- 🐛 [羊角快車二次創作版 issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快車二次創作版 discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 [公式アップストリームドキュメント](https://docs.openrin.org)
- 💬 公式アップストリーム Discord: https://discord.gg/JWbSTHvAPN