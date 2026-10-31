# データベーススキーマドキュメント

Rin は SQLite データベース（Drizzle ORM 経由）を使用し、12 のテーブルを持ちます。

## テーブル概要

| テーブル | 説明 |
|-------|-------------|
| `users` | ユーザーアカウント |
| `feeds` | ブログ記事/投稿 |
| `moments` | ソーシャルモーメント/投稿 |
| `comments` | 投稿へのコメント |
| `visits` | 訪問記録 |
| `visit_stats` | 訪問統計 |
| `friends` | 友だちリンク |
| `hashtags` | タグ |
| `feed_hashtags` | 投稿-タグ関連 |
| `info` | システム設定 |
| `cache` | アプリケーションキャッシュ |
| `linked_accounts` | サードパーティログイン連携 |

---

## users（ユーザーテーブル）

ユーザー情報を保存し、複数のログイン方法をサポートします。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `username` | text | NOT NULL, UNIQUE | ユーザー名、グローバルに一意 |
| `openid` | text | NOT NULL | OAuth OpenID、形式 `provider:openid`（例：`github:12345`、`qq:abcdef`） |
| `email` | text | DEFAULT "" | メールアドレス（メール認証ログイン用） |
| `avatar` | text | NULLABLE | アバター URL |
| `password` | text | NULLABLE | パスワードハッシュ（ユーザー名/パスワードログイン用）、ソルトなし SHA-256 ハッシュの 64 文字小文字 16 進数文字列 |
| `permission` | integer | DEFAULT 0 | 権限レベル、0 = 一般ユーザー |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ（Unix タイムスタンプ） |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ（Unix タイムスタンプ） |

**インデックス：**
- 一意インデックス `users_username_unique` ON `username`

**注記：**
- 同じユーザーが複数の方法（GitHub + QQ + メール）でログイン可能。`openid` が異なるログイン方法を区別します
- `email` フィールドはメール認証ログインに使用され、ログイン後のユーザー名は完全なメールアドレスになります

**パスワードハッシュのルール：**
- `users.password` は **ソルトなし SHA-256** ハッシュを 64 文字の小文字 16 進数文字列として保存します。ログイン時にサーバーは送信されたパスワードを同じ方法でハッシュ化し、結果を比較します
- D1 データベースで手動でパスワードを設定する場合は、**ハッシュ値**をカラムに書き込んでください。平文パスワードではアカウントにログインできなくなります
- Linux でハッシュを計算：

```bash
printf '%s' 'your-plaintext-password' | sha256sum | cut -d' ' -f1
```

- macOS でハッシュを計算：

```bash
printf '%s' 'your-plaintext-password' | shasum -a 256 | cut -d' ' -f1
```

- D1 でパスワードを更新：

```sql
UPDATE users
SET password = 'hash-from-the-step-above'
WHERE username = 'target-username';
```

---

## feeds（投稿テーブル）

ブログ記事の内容を保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `alias` | text | NULLABLE | URL エイリアス（カスタムスラッグ） |
| `title` | text | NULLABLE | 投稿タイトル |
| `summary` | text | DEFAULT '' | 投稿概要 |
| `ai_summary` | text | DEFAULT '' | AI 生成概要 |
| `ai_summary_status` | text | DEFAULT 'idle' | AI 概要ステータス：`idle`/`processing`/`done`/`error` |
| `ai_summary_error` | text | DEFAULT '' | AI 概要生成エラーメッセージ |
| `content` | text | NOT NULL | 投稿内容（Markdown） |
| `listed` | integer | DEFAULT 1 | リストページに表示、1=表示、0=非表示 |
| `draft` | integer | DEFAULT 1 | 下書きかどうか、1=下書き、0=公開 |
| `top` | integer | DEFAULT 0 | ピン留めかどうか、1=ピン留め、0=通常 |
| `uid` | integer | NOT NULL | 著者ユーザー ID、`users.id` を参照 |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `uid` → `users.id`（投稿は 1 人のユーザーに属する）

---

## moments（モーメントテーブル）

ユーザーの短い投稿/モーメントを保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `content` | text | NOT NULL | モーメント内容 |
| `uid` | integer | NOT NULL | 著者ユーザー ID、`users.id` を参照 |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `uid` → `users.id`（モーメントは 1 人のユーザーに属する）

---

## comments（コメントテーブル）

投稿へのコメントを保存し、ゲストコメントをサポートします。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `feed_id` | integer | NOT NULL | 投稿 ID、`feeds.id` を参照、CASCADE 削除 |
| `user_id` | integer | NULLABLE | コメント者ユーザー ID、`users.id` を参照、CASCADE 削除、ゲストの場合は NULL |
| `content` | text | NOT NULL | コメント内容 |
| `guest_name` | text | DEFAULT '' | ゲスト名（ゲストコメント用） |
| `guest_email` | text | DEFAULT '' | ゲストメール（ゲストコメント用） |
| `guest_website` | text | DEFAULT '' | ゲストウェブサイト（ゲストコメント用） |
| `approved` | integer | DEFAULT 1 | 承認済みかどうか、1=承認済み、0=保留中 |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `user_id` → `users.id` ON DELETE CASCADE（nullable）

**注記：**
- ゲストコメントの場合、`user_id` は NULL で、ゲスト情報には `guest_name`/`guest_email`/`guest_website` を使用します

---

## visits（訪問記録テーブル）

投稿への各訪問を記録します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `feed_id` | integer | NOT NULL | 投稿 ID、`feeds.id` を参照、CASCADE 削除 |
| `ip` | text | NOT NULL | 訪問者 IP アドレス |
| `created_at` | integer | DEFAULT (unixepoch()) | 訪問タイムスタンプ |

**リレーション：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

**注記：**
- このテーブルは生の訪問データを保存し、統計は `visit_stats` 経由で集計されます

---

## visit_stats（訪問統計テーブル）

HyperLogLog を使用して重複排除した投稿の訪問統計を保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `feed_id` | integer | PRIMARY KEY | 投稿 ID（主キーも兼ねる）、`feeds.id` を参照、CASCADE 削除 |
| `pv` | integer | DEFAULT 0 | ページビュー（PV） |
| `hll_data` | text | DEFAULT '' | ユニークビジター（UV）重複排除用の HyperLogLog データ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

---

## friends（友だちリンクテーブル）

友だちリンクを保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `name` | text | NOT NULL | 友だちリンク名 |
| `desc` | text | NULLABLE | 友だちリンクの説明 |
| `avatar` | text | NOT NULL | 友だちリンクのアバター URL |
| `url` | text | NOT NULL | 友だちリンクの URL |
| `uid` | integer | NOT NULL | 申請者ユーザー ID、`users.id` を参照、CASCADE 削除 |
| `accepted` | integer | DEFAULT 0 | 承認済みかどうか、1=承認済み、0=保留中 |
| `health` | text | DEFAULT '' | ヘルスステータス（リンクチェック用） |
| `sort_order` | integer | DEFAULT 0 | 並べ替え順、小さい数字が先 |
| `group` | text | DEFAULT '', NOT NULL | 友だちリンクグループ、空文字列はデフォルトグループを意味する |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `uid` → `users.id` ON DELETE CASCADE

---

## hashtags（タグテーブル）

投稿タグを保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `name` | text | NOT NULL | タグ名 |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

---

## feed_hashtags（投稿-タグ関連テーブル）

投稿とタグの多対多関係。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `feed_id` | integer | NOT NULL | 投稿 ID、`feeds.id` を参照、CASCADE 削除 |
| `hashtag_id` | integer | NOT NULL | タグ ID、`hashtags.id` を参照、CASCADE 削除 |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |

**リレーション：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `hashtag_id` → `hashtags.id` ON DELETE CASCADE

**注記：**
- 複合主キーは `(feed_id, hashtag_id)` で、投稿ごとのタグ割り当ての重複を防ぎます

---

## info（システム設定テーブル）

システムのキー・バリュー設定を保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `key` | text | NOT NULL, UNIQUE | 設定キー名 |
| `value` | text | NOT NULL | 設定値 |

**インデックス：**
- 一意インデックス `info_key_unique` ON `key`

**一般的なキーの例：**
- `site.name` - サイト名
- `site.description` - サイト説明
- `site.avatar` - サイトアバター
- `site.page_size` - ページネーションサイズ
- `rss` - RSS 有効状態
- その他のランタイム設定

---

## cache（キャッシュテーブル）

アプリケーションのキャッシュデータを保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `key` | text | NOT NULL | キャッシュキー |
| `value` | text | NOT NULL | キャッシュ値（JSON 文字列） |
| `type` | text | DEFAULT 'cache' | キャッシュタイプ、分類用（例：`cache`、`server_config`、`client_config`） |
| `created_at` | integer | DEFAULT (unixepoch()) | 作成タイムスタンプ |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新タイムスタンプ |
| `expires_at` | integer | NULL | 有効期限タイムスタンプ（Unix 時間）、NULL は無期限を意味する |

**制約：**
- 複合一意制約 `cache_key_type_unique` ON (`key`, `type`)

**インデックス：**
- `idx_cache_type` ON `type`
- `idx_cache_key` ON `key`

**メール友だちリンク申請で使用される `type` 値：**
- `friend.email`：申請者のメールをキーとし、進行中の申請状態（ステージ、操作、JSON ペイロード、検証コード、期限）を保存します。
- `friend.email.lock`：固定 `key` の `global` で、「同時に 1 つの申請のみ」という並行ロックを実装します。

**友だちグループで使用される `type='client.config'` キー：**
- `friend_groups`：管理者定義のグループ名の JSON 配列（デフォルトグループを除く）。
- `friend_group_order`：友だちリンクの表示順を制御する JSON 配列。空文字列の要素はデフォルトグループ（「友だち」）を表し、新しいグループはデフォルトでその後に追加されます。

---

## linked_accounts（サードパーティログイン連携テーブル）

ユーザーにバインドされたサードパーティログインアカウント（GitHub、Gitee、QQ、WeChat など）を保存します。

| カラム | 型 | 制約 | 説明 |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自動増分 ID |
| `user_id` | integer | NOT NULL | ユーザー ID、`users.id` を参照 |
| `provider` | text | NOT NULL | ログインプロバイダ、例：`github`、`gitee`、`qq`、`wechat` |
| `provider_id` | text | NOT NULL | プロバイダ側のユーザー識別子（OpenID など） |
| `linked_at` | integer | DEFAULT (unixepoch()) | バインドタイムスタンプ |

**リレーション：**
- `user_id` → `users.id` ON DELETE CASCADE

**注記：**
- 1 人のユーザーが複数のサードパーティアカウントをバインドできます
- 1 つのサードパーティアカウントを複数のユーザーにバインドすることはできません

---

## テーブル関係図

```text
users (1) ──< (N) feeds
                 ├──< (N) comments
                 ├──< (N) friends
                 └──< (N) linked_accounts

feeds (1) ──< (N) comments
feeds (1) ──< (N) visits
feeds (1) ──< (1) visit_stats
feeds (N) >──< (N) hashtags (via feed_hashtags)

moments (N) >── (1) users
```

---

## データベース直接変更に関する注意

1. **Drizzle ORM マイグレーションを使用する**：スキーマを変更する場合は、生の SQL を実行するのではなく、Drizzle マイグレーションファイルを生成してください
2. **DROP/RENAME 禁止**：Cloudflare D1 は `DROP TABLE` と `RENAME TABLE` をサポートしていないため、マイグレーションは `ALTER TABLE ADD COLUMN` を使用する必要があります
3. **タイムスタンプ形式**：すべてのタイムスタンプは Unix タイムスタンプ（整数、秒）を使用します
4. **外部キー制約**：SQLite はデフォルトで外部キー制約を強制しないため、アプリケーション層がデータ整合性に責任を持ちます
5. **ゲストコメント**：`comments.user_id` は NULL にすることができ、ユーザーが削除されるとそのユーザーのすべてのコメントが CASCADE 削除されます

---

## sqlite_sequence テーブル

`sqlite_sequence` は SQLite の内部システムテーブルです。SQLite によって自動的に作成・維持されます。

**目的**：
- `AUTOINCREMENT` を使用するテーブルの現在の最大 ROWID を記録します
- `INTEGER PRIMARY KEY AUTOINCREMENT` カラムが単調増加し、ROWID の再利用を防ぐことを保証します
- SQLite は新しい行が挿入されるたびに、このテーブルからシーケンス値を自動的に読み取り・更新します

**注記**：
- これは SQLite が維持する内部テーブルであり、直接変更すべきではありません
- テーブルのシーケンス値が破損した場合は、`UPDATE sqlite_sequence SET seq = N WHERE name = 'table_name'` で修正できますが、これはほとんど必要ありません