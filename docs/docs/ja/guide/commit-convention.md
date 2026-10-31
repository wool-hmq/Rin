# コミットメッセージ規約

このドキュメントは、Rin プロジェクトのコミットメッセージ規約を概説します。これらの規約に従うことで、変更履歴とリリースノートを自動的に生成できます。

## 形式

各コミットメッセージは次の形式に従う必要があります：

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

## タイプ

| タイプ | 説明 | 例 |
|------|-------------|---------|
| `feat` | 新機能 | `feat(auth): add GitHub OAuth login` |
| `fix` | バグ修正 | `fix(api): resolve CORS issue` |
| `docs` | ドキュメント変更 | `docs(readme): update deployment guide` |
| `style` | コードスタイル変更（フォーマット、セミコロンなど） | `style: format with prettier` |
| `refactor` | コードのリファクタリング | `refactor(db): optimize query performance` |
| `perf` | パフォーマンス改善 | `perf(cache): implement Redis caching` |
| `test` | テストの追加または更新 | `test(api): add user authentication tests` |
| `chore` | ビルドプロセスまたは補助ツールの変更 | `chore(deps): update dependencies` |
| `ci` | CI/CD の変更 | `ci: add release workflow` |
| `revert` | 変更の取り消し | `revert: undo breaking change` |

## スコープ

スコープは任意で、影響を受けるコードベースの領域を示す必要があります：

- `api` - バックエンド API の変更
- `client` - フロントエンド/クライアントの変更
- `db` - データベースの変更
- `auth` - 認証関連
- `ui` - UI コンポーネント
- `deps` - 依存関係
- `config` - 設定ファイル
- `docs` - ドキュメント
- `release` - リリース関連

## サブジェクト

- 命令形を使用する（「added」や「adds」ではなく「add」）
- 最初の文字を大文字にしない
- 末尾にピリオドを付けない
- 最大 50 文字

**良い例：**
- `feat(auth): add password reset functionality`
- `fix(api): handle null response from database`
- `docs(readme): update installation instructions`

**悪い例：**
- `feat: Added new feature`（過去形、大文字）
- `fix: fixed the bug.`（過去形、末尾にピリオド）
- `update stuff`（タイプなし、曖昧な説明）

## 本文

- 命令形を使用する
- 72 文字で折り返す
- **何を**、**なぜ**を説明し、**どのように**は説明しない
- サブジェクトとは空行で区切る

例：
```
feat(auth): implement JWT token refresh

Add automatic token refresh mechanism to prevent users from being
logged out unexpectedly. Tokens now refresh 5 minutes before expiry.

This improves user experience by maintaining sessions seamlessly.
```

## フッター

- Issue と PR を参照する：`Closes #123`、`Fixes #456`
- 破壊的変更：`BREAKING CHANGE: description`

例：
```
feat(api): change response format for user endpoint

BREAKING CHANGE: The user endpoint now returns user data wrapped in
a `data` field instead of returning it directly. Update your client
code accordingly.

Closes #789
```

## 例

### 機能
```
feat(articles): add markdown editor with preview

Implement a split-pane markdown editor with live preview using
Monaco Editor. Supports syntax highlighting and image uploads.

Closes #234
```

### バグ修正
```
fix(ui): resolve mobile navigation menu overlap

The navigation menu was overlapping with content on screens smaller
than 768px. Adjusted z-index and positioning to fix the issue.

Fixes #567
```

### ドキュメント
```
docs(deploy): add Cloudflare setup guide

Add comprehensive guide for setting up Cloudflare Workers, D1
database, and R2 storage for new deployments.
```

### 破壊的変更
```
feat(auth): migrate to new OAuth provider

BREAKING CHANGE: The GitHub OAuth implementation has been replaced
with a generic OAuth2 provider. Environment variables have changed:
- GITHUB_CLIENT_ID → OAUTH_CLIENT_ID
- GITHUB_CLIENT_SECRET → OAUTH_CLIENT_SECRET

Migration guide: https://docs.example.com/migration/v2
```

## コミットメッセージのリンティング

これらの規約を強制するために commitlint の使用を推奨します：

```bash
# commitlint をインストール
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# commitlint.config.js を作成
module.exports = { extends: ['@commitlint/config-conventional'] };
```

## なぜ？

- **自動変更履歴**：リリースノートを自動生成できる
- **明確な履歴**：何が、なぜ変更されたかを理解しやすい
- **セマンティックバージョニング**：バージョンアップの判断に役立つ（feat=minor、fix=patch、breaking=major）
- **より良いコラボレーション**：一貫した形式でレビューが容易になる

## ツール

- **Commitizen**：対話式コミットメッセージビルダー
  ```bash
  npm install -g commitizen
  git cz  # git commit の代わりに
  ```

- **VS Code 拡張機能**：オートコンプリート用の「Conventional Commits」

## 質問がありますか？

コミットタイプや形式について不明な場合は、PR で質問するか、リポジトリ内の既存のコミットを参照してください。