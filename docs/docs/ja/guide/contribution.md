# Rin へのコントリビュート

本プロジェクトへのパッチとコントリビュートを喜んで受け入れます。いくつかの小さなガイドラインに従うだけで大丈夫です。

## Commit-msg フック

`cli/templates/git-commit-msg.sh` にサンプルの commit-msg フックがあります。以下のコマンドを実行して設定してください：

```sh
ln -s ../../cli/templates/git-commit-msg.sh commit-msg
```

Windows では、`commit-msg.sh` ファイルを直接 `.git/hooks/commit-msg` にコピーします。

```powershell
cp .\scripts\commit-msg.sh .\.git\hooks\commit-msg
```

これにより、各コミットの前に以下のチェックが実行されます：

1. **型チェック** - `bun run check` が全パッケージの TypeScript 型を検証します
2. **リンティング** - コードのフォーマットとスタイルをチェックします
3. **コミットメッセージの形式** - コミットメッセージが `feat|chore|fix|docs|ci|style|test|pref` のいずれかで始まることを検証します

:::warning 重要
フックはテストも実行します。コミット前にすべてのテストがパスすることを確認してください：
```sh
bun run test
```
:::

フックをスキップしたい場合（非推奨）、`git commit` に `--no-verify` オプションを付けて実行してください。

## 開発環境のセットアップ

1. リポジトリをフォーク＆クローン

2. [Node](https://nodejs.org/en/download/package-manager) と [Bun](https://bun.sh/) をインストール

3. 依存関係をインストール
    ```sh
    bun i
    ```

4. `.env.local` ファイルに必要な設定を記入します。

:::tip
通常、`AVATAR`、`NAME`、`DESCRIPTION` を記入するだけで十分です。
OAuth の場合、コールバックアドレス `http://localhost:11498/api/user/github/callback`（GitHub）、`http://localhost:11498/api/user/gitee/callback`（Gitee）で OAuth App を作成するか、QQ ログイントークンについては心躍にお問い合わせください。
:::

5. セットアップスクリプトを実行して設定ファイルを生成
```sh
bun run dev:setup
```

これにより、`.env.local` の設定に基づいて `wrangler.toml` と `.dev.vars` ファイルが自動生成されます。

6. データベースマイグレーションを実行
```sh
bun run db:migrate
```

7. （任意）画像アップロード用に S3/R2 を設定

画像アップロード機能を使用する場合、`.env.local` に S3 設定を記入します：
- `S3_ENDPOINT`
- `S3_BUCKET`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`

8. 開発サーバーを起動
    ```sh
    bun run dev
    ```

9. 開発サーバーをより細かく制御するには、クライアントとサーバーの dev コマンドを 2 つの別々のターミナルで実行できます：
    ```sh
    # tty1
    bun run dev:client
    
    # tty2
    bun run dev:server
    ```

## テスト要件

プルリクエストを送信する前に、すべてのテストがパスすることを確認してください：

```sh
# すべてのテストを実行
bun run test

# 型チェックを実行
bun run check

# フォーマットチェックを実行
bun run format:check
```

### 新機能のテストを追加する

新しい API エンドポイントを追加する場合：
1. `packages/api/src/types.ts` に型を定義（クライアントとサーバーで共有）
2. `server/src/**/__tests__/*.test.ts` にサーバーテストを追加
3. 該当する場合、`client/src/**/__tests__/*.test.ts` にクライアントテストを追加

## 変更のコミット

1. 簡単なパッチの場合、通常 UTC+8 タイムゾーンの日中に 10 分以内にレビューできます。 2.

2. PR がレビュー可能になった後に軽微な変更を強制プッシュしないでください。そうするとメンテナーが PR 全体を再読する必要があり、レビュープロセスが遅れます。 3.

3. CI は常にグリーンに保ってください。

4. PR で CI が失敗した場合、プッシュしないでください。パッチのせいだと思わない場合でもです。他の何かが CI を壊している場合は、プッシュする前に根本原因の修正を手伝ってください。

*楽しくコードを書きましょう！*

## コードレビュー

プロジェクトメンバーによるものを含め、すべてのコミットはレビューが必要です。この目的のために GitHub プルリクエストを使用します。
プルリクエストの使用方法の詳細については、GitHub ヘルプを参照してください。