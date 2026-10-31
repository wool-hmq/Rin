# リリースプロセス

このドキュメントでは、Rin プロジェクトのリリースプロセスについて説明します。

## 概要

Rin は [セマンティックバージョニング](https://semver.org/) を採用し、安定性と一貫性を確保するために構造化されたリリースワークフローに従います。

**主な特徴：**
- 🤖 **リリースノートの自動生成**：従来のコミットメッセージから生成
- 📝 **詳細な変更履歴**：`CHANGELOG.md` に移行ガイドとともに維持
- ✅ **自動検証**：CI がバージョンの一貫性をチェックし、テストを実行
- 🚀 **自動デプロイ**：バージョンタグで Cloudflare にデプロイ

## バージョン形式

バージョンは `MAJOR.MINOR.PATCH` の形式に従います：

- **MAJOR**：互換性のない API 変更
- **MINOR**：新機能（後方互換）
- **PATCH**：バグ修正（後方互換）

プレリリースバージョンにはハイフンを付けてタグ付けできます。例：`v1.0.0-beta.1`。

### プロジェクトのバージョンライン

プロジェクトは独自のラインで標準的なセマンティックバージョニングに従い、`v1.0.0` から始まり、リリースタグは `vX.Y.Z` 形式です：

- **MAJOR**：互換性のない変更。`X` が増加し、下位の番号はリセットされます
- **MINOR**：後方互換性のある機能。`Y` が増加し、`Z` はリセットされます
- **PATCH**：修正と小さな変更。`Z` が増加します
- **プレリリース**：`-beta` や `-rc.1` などのサフィックス。例：`v1.2.0-beta.1`

すべてのリリースは `CHANGELOG.md` と `docs/docs/{zh,en}/guide/changelog.md` を更新します。告知ページは変更の規模と必要性に応じて維持されます。大きな変更には新しいページまたは更新されたページが作成され、1つのラインの複数リリースが同じページを共有でき、ページは `_nav.json` のブログセクションに登録されます。

項目が公式アップストリームのバージョンと本プロジェクトのバージョンの両方に言及する場合、本プロジェクトのバージョンは区別のため `yjvX.Y.Z` と表記します。

## コミットメッセージの規約

[Conventional Commits](https://www.conventionalcommits.org/) 仕様に従います。これにより、リリースノートを自動生成できます。

### クイックリファレンス

| タイプ | 説明 | 例 |
|------|-------------|---------|
| `feat` | 新機能 | `feat(auth): add GitHub OAuth` |
| `fix` | バグ修正 | `fix(api): resolve CORS issue` |
| `docs` | ドキュメント | `docs(readme): update guide` |
| `refactor` | コードのリファクタリング | `refactor(db): optimize queries` |
| `perf` | パフォーマンス | `perf(cache): add Redis` |
| `chore` | メンテナンス | `chore(deps): update packages` |

詳細なガイドラインは [コミット規約](./commit-convention.md) を参照してください。

## リリースワークフロー

### 1. すべての変更の準備を確認

- [ ] すべての機能/修正が `main` にマージされている
- [ ] すべてのコミットが [従来のコミット形式](./commit-convention.md) に従っている
- [ ] テストがパスしている（`bun run check`、`bun run build`）

### 2. リリーススクリプトを実行

```bash
# パッチバージョンを上げる (1.1.2 -> 1.1.3)
bun cli/bin/rin.ts release patch

# マイナーバージョンを上げる (1.1.2 -> 1.2.0)
bun cli/bin/rin.ts release minor

# メジャーバージョンを上げる (1.1.2 -> 2.0.0)
bun cli/bin/rin.ts release major

# または特定のバージョンを指定
bun cli/bin/rin.ts release 1.2.3

# プレリリースバージョン
bun cli/bin/rin.ts release 1.2.0-rc.1
```

スクリプトは以下を実行します：
1. ✅ リリース前チェックを実行（型チェック、ビルド、ブランチ/変更履歴の検証）
2. 📝 すべてのワークスペースの `package.json` のバージョンを更新
3. 🔗 `CHANGELOG.md` にターゲットバージョンのリリースリンクを追加
4. 🏷️ git コミットとタグを作成

**重要**：スクリプトは変更履歴の本文を書きません。`CHANGELOG.md` に一致するバージョンセクションがすでに存在することを期待します。

### 3. CHANGELOG を確認して編集

リリーススクリプトを実行した後：

```bash
# CHANGELOG.md を開いて新しいバージョンセクションを完成させる
# 詳細な説明、移行ガイドなどを追加
nano CHANGELOG.md  # またはお好みのエディタ

# 変更を加えた場合はコミットを修正
git add CHANGELOG.md
git commit --amend --no-edit
```

### 4. ドライラン（任意）

変更を適用せずにプレビューするには：

```bash
bun cli/bin/rin.ts release minor --dry-run
```

### 5. リリースをプッシュ

```bash
# コミットをプッシュ
git push origin main

# タグをプッシュ（リリースワークフローをトリガー）
git push origin v1.2.0-rc.1
```

### 6. 自動リリースプロセス

タグがプッシュされると、GitHub Actions が自動的に以下を実行します：

1. **🔍 検証** (`release.yml`)
   - バージョンの一貫性を検証
   - 型チェックとビルドを実行

2. **📝 リリースノートの生成** (`release.yml`)
   - コミットをタイプ別に分類（機能、修正など）
   - CHANGELOG.md から詳細なノートを抽出
   - フォーマットされたノートで GitHub Release を作成
   - `build-v<version>-cloudflare.tar.gz` をリリースアセットとして添付

3. **🚀 デプロイ** (`deploy.yml`)
   - デプロイバージョンを検証
   - Cloudflare Workers にデプロイ
   - データベースマイグレーションを実行

## リリースノートの構造

GitHub Releases には以下が含まれます：

```markdown
## What's Changed

**Full Changelog**: v1.1.0...v1.1.2

### 🚀 Features
- feat(auth): add GitHub OAuth login (abc1234)
- feat(ui): implement dark mode (def5678)

### 🐛 Bug Fixes
- fix(api): resolve CORS issue (ghi9012)

### 📋 Detailed Changelog
[Content from CHANGELOG.md for this version]

---

## 🆙 Upgrade Guide
...
```

## フォークユーザー向け

### リリースアーティファクトからのデプロイ

自分のリポジトリで再ビルドしたくない場合は、GitHub Release アセットから直接デプロイできます：

1. ターゲットバージョンの GitHub Release ページを開く
2. Assets の下にある `build-v<version>-cloudflare.tar.gz` を見つける
3. そのダウンロード URL をコピー
4. `deploy.yml` を手動でトリガーし、その URL を `artifact_url` として渡す

その URL はまさに `deploy.yml` の `artifact_url` 入力が消費することを意図したものです。

### オプション 1：フォークを同期（推奨）

1. GitHub でフォークしたリポジトリに移動
2. **「Sync fork」** ボタンをクリック
3. 移行手順について [CHANGELOG.md](./changelog.md) を確認
4. 必要に応じて環境変数を更新
5. 設定されていればデプロイが自動的に実行されます

### オプション 2：手動更新

```bash
# upstream リモート（オリジナル）を追加
git remote add upstream https://github.com/openRin/Rin.git

# またはフォークリモートを使用
git remote add upstream https://github.com/wool-hmq/Rin.git

# 最新の変更を取得
git fetch upstream

# main ブランチにマージ
git checkout main
git merge upstream/main

# フォークにプッシュ
git push origin main
```

## リリースチェックリスト

リリースを作成する前に：

- [ ] すべてのテストがパスしている（`bun run check`、`bun run build`）
- [ ] すべてのコミットが従来の形式に従っている
- [ ] ターゲットバージョンの CHANGELOG.md セクションが準備されている
- [ ] 移行ガイドが含まれている（破壊的変更の場合）
- [ ] ドキュメントが更新されている（必要に応じて）

タグをプッシュした後：

- [ ] GitHub Release が正常に作成された
- [ ] リリースノートが正しく見える
- [ ] デプロイが正常に完了した

## 緊急リリース

即時リリースが必要な重大なバグの場合：

```bash
# 最新タグから hotfix ブランチを作成
git checkout -b fix/critical-bug v1.1.2

# 修正を適用し、従来の形式でコミット
git commit -m "fix(api): resolve critical security issue"

# リリーススクリプトを実行
bun cli/bin/rin.ts release patch

# プッシュ（hotfix の場合、main にマージする必要はありません）
git push origin fix/critical-bug
git push origin v0.2.1
```

## トラブルシューティング

### バージョン不一致エラー

**問題**：CI が「Version mismatch」エラーを表示する

**解決策**：
1. git タグが `package.json` のバージョンと一致していることを確認
2. リリーススクリプトがこれを自動的に処理します
3. 手動リリースの場合、`git tag v1.0.0` が package.json の `"version": "1.0.0"` と一致することを確認

### 空のリリースノート

**問題**：GitHub Release に変更がリストされていない

**解決策**：
1. コミットが従来の形式（`feat:`、`fix:` など）に従っていることを確認
2. タグ間にコミットが存在することを確認：`git log v1.1.0..v1.1.2 --oneline`
3. 従来の形式でないコミットは分類リストに表示されません

### デプロイの失敗

**問題**：リリース後にデプロイが失敗する

**解決策**：
1. 特定のエラーについて GitHub Actions ログを確認
2. 必要なすべてのシークレットが設定されていることを確認
3. デプロイエラーについて Cloudflare ダッシュボードを確認
4. 必要に応じて Actions タブから手動でデプロイをトリガー

### CHANGELOG.md の競合

**問題**：CHANGELOG.md のマージ競合

**解決策**：
1. 両方のセクションを保持
2. 時系列に並べ替え（新しいものが先）
3. 重複するエントリを削除

## ベストプラクティス

### 良いコミットの書き方

✅ **良い例**：
```
feat(auth): implement JWT token refresh

Add automatic token refresh to prevent session timeouts.
Tokens refresh 5 minutes before expiry.

Closes #123
```

❌ **悪い例**：
```
update auth stuff
fixed bug
```

### CHANGELOG の維持

- 開発中は [Unreleased] セクションを最新に保つ
- 破壊的変更には移行ガイドを書く
- 移行セクションにコード例を含める
- 該当する場合は貢献者をクレジットする

### バージョンの上げ方

- **パッチ**（1.1.3）：バグ修正のみ
- **マイナー**（1.2.0）：新機能、後方互換
- **メジャー**（2.0.0）：破壊的変更

迷った場合は、新機能には **マイナー** を使用してください。

> **バージョン管理**：プロジェクトは標準的なセマンティックバージョニングに従い、バージョンラインは `v1.0.0` から始まり、リリースタグは `vX.Y.Z` を使用し、プレリリースには `-beta` や `-rc.1` などのサフィックスを付けます。項目が公式アップストリームのバージョンと本プロジェクトのバージョンの両方に言及する場合、本プロジェクトのバージョンは `yjvX.Y.Z` と表記します。

## 質問がありますか？

- 📖 コミットガイドラインについては [コミット規約](./commit-convention.md) を参照
- 🐛 問題を報告：[羊角快車二次創作版 issues](https://github.com/wool-hmq/Rin/issues)
- 📖 公式アップストリーム issues：[openRin/Rin issues](https://github.com/openRin/Rin/issues)
- 💬 コミュニティのディスカッションに参加（二次創作版が先）