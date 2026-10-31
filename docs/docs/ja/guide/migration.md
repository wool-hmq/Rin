# Rin 移行ガイド（v0.3.0）

このガイドは、既存の Rin ユーザーが最新バージョンに移行するためのものです。

## 変更の概要

バージョン 0.3.0 には大幅なアーキテクチャ変更が含まれています：

1. **フレームワークの移行**: ElysiaJS をカスタムの軽量フレームワークに置き換え
2. **API の変更**: 新しい API クライアントインターフェース
3. **ログイン方法**: ユーザー名/パスワード認証のサポートを追加
4. **OAuth の変更**: GitHub OAuth の変数名を更新
5. **パフォーマンスの改善**: 大幅なパフォーマンス向上

## 移行手順

### ステップ 1: フォークを同期

1. GitHub でフォークしたリポジトリに移動
2. **「Sync fork」** ボタンをクリック
3. **「Update branch」** をクリックして変更をマージ

### ステップ 2: 環境変数を更新

#### 必須の変更

**GitHub OAuth 変数（GitHub ログインを使用している場合）**

古い変数名は非推奨です：

```
GITHUB_CLIENT_ID      → RIN_GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET  → RIN_GITHUB_CLIENT_SECRET
```

**手順**:
1. Settings → Secrets and variables → Actions に移動
2. `RIN_` プレフィックス付きの新しい Secrets を追加
3. （任意）古い Secrets を削除

#### 任意: ユーザー名/パスワードログインを追加

GitHub OAuth よりもシンプルなユーザー名/パスワード認証を希望する場合：

1. 以下の Secrets を追加：
    - `ADMIN_USERNAME`: 希望するユーザー名
    - `ADMIN_PASSWORD`: 希望するパスワード

### ステップ 3: Pages を削除（任意だが推奨）

0.3.0 以降、Rin は Cloudflare Pages の代わりに Workers で静的アセットをホストします。移行するには以下の手順に従ってください：

1. **Pages ドメインのバインドを解除**
   - Cloudflare ダッシュボード → Pages に移動
   - Pages プロジェクトを選択 → Custom domains
   - バインドされたドメインを削除

2. **ドメインを Worker にバインド**
   - Cloudflare ダッシュボード → Workers & Pages に移動
   - Worker（`rin-server`）を選択
   - 「Triggers」→「Add Custom Domain」をクリック
   - ドメインを入力して保存

3. **余分なドメインバインディングを整理**
   - Worker のカスタムドメインリストを確認
   - 不要なバインディング（例：`seo/*`、`sub/*` など）を削除

4. **GitHub OAuth コールバックを更新**
   - GitHub → Settings → Developer settings → OAuth Apps に移動
   - OAuth App を検索
   - Authorization callback URL を以下から変更：
     - `https://<worker-domain>/user/github/callback`
   - 以下へ：
     - `https://<your-domain>/api/user/github/callback`

### ステップ 4: Cloudflare API キーの権限を更新

Cloudflare API Token に以下の権限があることを確認してください：
- **Cloudflare Workers**:Edit
- **D1**:Edit
- **R2**:Edit（R2 ストレージを使用している場合）

![1000000663](/cloudflare-api-key-en.png)

### ステップ 5: ブランチ名を変更

1. 以前にフォークしたブランチが `dev` だった場合、手動で `main` または `master` に名前を変更する必要があります。

### ステップ 6: デプロイ

1. リポジトリの Actions タブに移動
2. **「Build」** ワークフローを選択
3. **「Run workflow」** をクリック
4. ビルドが成功すると、`Deploy` ワークフローが自動的にトリガーされ、workers に自動デプロイされます。

### ステップ 7: デプロイを検証

1. フロントエンドの URL にアクセス
2. ログイン機能をテスト
3. 既存の記事にアクセスできるか確認
4. 画像が正しく読み込まれるか確認

## 破壊的変更のまとめ

### API クライアントインターフェース

**古いコード**（サポート終了）:
```typescript
const feeds = await client.feed.index.get({ query: { page: 1 } });
```

**新しいコード**:
```typescript
const feeds = await client.feed.list({ page: 1 });
```

古い API を使用するカスタムフロントエンドコードがある場合は、適宜更新してください。

### 認証フロー

- **旧**: バックエンドがフロントエンドのコールバック URL にリダイレクト
- **新**: 専用のログインフローを備えたスタンドアロンの `/login` ページ

### 環境変数の変更

| 旧名 | 新名 | 必須 |
|----------|----------|----------|
| `GITHUB_CLIENT_ID` | `RIN_GITHUB_CLIENT_ID` | 任意* |
| `GITHUB_CLIENT_SECRET` | `RIN_GITHUB_CLIENT_SECRET` | 任意* |
| - | `ADMIN_USERNAME` | 任意* |
| - | `ADMIN_PASSWORD` | 任意* |

*少なくとも 1 つのログイン方法を設定する必要があります

## 移行後

### 新機能を試す

1. **プロフィール管理**: `/profile` にアクセスしてアバターとユーザー名を更新
2. **パフォーマンス向上**: より高速なコールドスタートと低い CPU 使用率を体験
3. **より良いログイン体験**: フォーカス処理が改善された新しいスタンドアロンログインページ

### クリーンアップ（任意）

移行が成功したら、以下を実行できます：

1. 非推奨の環境変数を削除
2. 不要になった古いプレビューデプロイを削除
3. カスタムスクリプトを新しい API インターフェースを使用するように更新

## トラブルシューティング

### 「Version Mismatch」エラー

**解決策**: git タグが package.json のバージョンと一致していることを確認してください。同期すれば自動的に処理されるはずです。

### 「Cannot Login」

**解決策**:
1. 少なくとも 1 つのログイン方法（GitHub OAuth またはユーザー名/パスワード）が設定されていることを確認
2. Secrets が正しく設定されているか確認
3. ブラウザのキャッシュをクリアしてみる

### 「Images Not Loading」

**解決策**:
1. S3/R2 の設定を確認
2. `S3_ACCESS_HOST` が正しく設定されているか確認
3. R2 バケットの権限を確認

## ロールバック（必要な場合）

移行に失敗してロールバックが必要な場合：

1. 以前の安定したタグに切り替え（リリースタグは `v` プレフィックスを使用、例：`v1.0.0`）：`git checkout v1.0.0`
2. main に強制プッシュ（⚠️ 破壊的）：`git push origin HEAD:main --force`
3. Actions から再デプロイ

## ヘルプが必要ですか？

- 📖 [羊角快車二次創作版ドキュメント](https://rin.lab.j3.ink)
- 🐛 [羊角快車二次創作版 issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快車二次創作版 discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 [公式アップストリームドキュメント](https://docs.openrin.org)
- 🐛 [公式アップストリーム issues](https://github.com/openRin/Rin/issues)
- 💬 [公式アップストリーム discussions](https://github.com/openRin/Rin/discussions)

---

*最終更新: 2026-10-24*