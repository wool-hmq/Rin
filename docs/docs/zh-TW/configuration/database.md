# 資料庫結構文件

Rin 使用 SQLite 資料庫（透過 Drizzle ORM），共包含 12 張資料表。

## 資料表概覽

| 資料表名稱 | 說明 |
|------|------|
| `users` | 使用者表 |
| `feeds` | 文章／動態表 |
| `moments` | 朋友圈／動態表 |
| `comments` | 留言表 |
| `visits` | 造訪記錄表 |
| `visit_stats` | 造訪統計表 |
| `friends` | 友連表 |
| `hashtags` | 標籤表 |
| `feed_hashtags` | 文章—標籤關聯表 |
| `info` | 系統設定表 |
| `cache` | 快取表 |
| `linked_accounts` | 第三方登入綁定表 |

---

## users（使用者表）

儲存使用者資訊，支援帳號密碼、OAuth、QQ、信箱等多種登入方式。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `username` | text | NOT NULL, UNIQUE | 使用者名稱，全域唯一 |
| `openid` | text | NOT NULL | OAuth OpenID，格式為 `provider:openid`（如 `github:12345`、`qq:abcdef`） |
| `email` | text | DEFAULT "" | 信箱位址（用於電子郵件驗證碼登入） |
| `avatar` | text | NULLABLE | 頭像 URL |
| `password` | text | NULLABLE | 密碼雜湊（帳號密碼登入使用），SHA-256 無加鹽雜湊，64 位十六進位小寫字串 |
| `permission` | integer | DEFAULT 0 | 權限層級，0 為一般使用者 |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳（Unix 時間戳） |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳（Unix 時間戳） |

**索引：**
- 唯一索引 `users_username_unique` ON `username`

**注意：**
- 同一使用者可透過多種方式登入（GitHub + QQ + 信箱），`openid` 用於區分不同登入方式
- `email` 欄位用於電子郵件驗證碼登入，登入後 username 為完整信箱位址

**密碼雜湊規則：**
- `users.password` 儲存的是 **SHA-256（無加鹽）** 雜湊值，格式為 64 位十六進位小寫字串，服務端登入時會對輸入的密碼做同樣的雜湊計算後比對
- 需要手動在 D1 資料庫中為使用者設定密碼時，必須寫入**加密後的雜湊值**，直接填寫明文密碼會導致該帳號無法登入
- 計算雜湊值（Linux）：

```bash
printf '%s' '你的明文密碼' | sha256sum | cut -d' ' -f1
```

- 計算雜湊值（macOS）：

```bash
printf '%s' '你的明文密碼' | shasum -a 256 | cut -d' ' -f1
```

- 更新 D1 中的密碼：

```sql
UPDATE users
SET password = '上一步得到的雜湊值'
WHERE username = '目標使用者名稱';
```

---

## feeds（文章／動態表）

儲存部落格文章內容。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `alias` | text | NULLABLE | URL 別名（自訂 slug） |
| `title` | text | NULLABLE | 文章標題 |
| `summary` | text | DEFAULT '' | 文章摘要 |
| `ai_summary` | text | DEFAULT '' | AI 產生的摘要 |
| `ai_summary_status` | text | DEFAULT 'idle' | AI 摘要狀態：`idle`/`processing`/`done`/`error` |
| `ai_summary_error` | text | DEFAULT '' | AI 摘要產生錯誤訊息 |
| `content` | text | NOT NULL | 文章內容（Markdown） |
| `listed` | integer | DEFAULT 1 | 是否在列表頁顯示，1=顯示，0=隱藏 |
| `draft` | integer | DEFAULT 1 | 是否為草稿，1=草稿，0=已發布 |
| `top` | integer | DEFAULT 0 | 是否置頂，1=置頂，0=一般 |
| `uid` | integer | NOT NULL | 作者使用者 ID，關聯 `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `uid` → `users.id`（文章屬於一個使用者）

---

## moments（動態／朋友圈表）

儲存使用者發布的短動態。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `content` | text | NOT NULL | 動態內容 |
| `uid` | integer | NOT NULL | 發布使用者 ID，關聯 `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `uid` → `users.id`（動態屬於一個使用者）

---

## comments（留言表）

儲存文章留言，支援訪客留言。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `feed_id` | integer | NOT NULL | 關聯文章 ID，關聯 `feeds.id`，刪除時層級刪除 |
| `user_id` | integer | NULLABLE | 留言使用者 ID，關聯 `users.id`，刪除時層級刪除，訪客留言為空 |
| `content` | text | NOT NULL | 留言內容 |
| `guest_name` | text | DEFAULT '' | 訪客名稱（訪客留言時使用） |
| `guest_email` | text | DEFAULT '' | 訪客信箱（訪客留言時使用） |
| `guest_website` | text | DEFAULT '' | 訪客網站（訪客留言時使用） |
| `approved` | integer | DEFAULT 1 | 是否審核通過，1=已通過，0=待審核 |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `user_id` → `users.id` ON DELETE CASCADE（可為空）

**注意：**
- 訪客留言時 `user_id` 為空，使用 `guest_name`/`guest_email`/`guest_website` 記錄訪客資訊

---

## visits（造訪記錄表）

記錄每篇文章的每次造訪。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `feed_id` | integer | NOT NULL | 關聯文章 ID，關聯 `feeds.id`，刪除時層級刪除 |
| `ip` | text | NOT NULL | 造訪者 IP 位址 |
| `created_at` | integer | DEFAULT (unixepoch()) | 造訪時間戳 |

**關聯：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

**注意：**
- 此表記錄原始造訪資料，統計時透過 `visit_stats` 表彙總

---

## visit_stats（造訪統計表）

儲存文章的造訪統計資訊，使用 HyperLogLog 去除重複。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `feed_id` | integer | PRIMARY KEY | 關聯文章 ID（同時為主鍵），關聯 `feeds.id`，刪除時層級刪除 |
| `pv` | integer | DEFAULT 0 | 頁面瀏覽量（PV） |
| `hll_data` | text | DEFAULT '' | HyperLogLog 資料，用於有效率統計獨立訪客（UV） |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

---

## friends（友連表）

儲存友情連結。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `name` | text | NOT NULL | 友連名稱 |
| `desc` | text | NULLABLE | 友連描述 |
| `avatar` | text | NOT NULL | 友連頭像 URL |
| `url` | text | NOT NULL | 友連位址 |
| `uid` | integer | NOT NULL | 提交使用者 ID，關聯 `users.id`，刪除時層級刪除 |
| `accepted` | integer | DEFAULT 0 | 是否已接受，1=已接受，0=待審核 |
| `health` | text | DEFAULT '' | 健康狀態（用於連結檢測） |
| `sort_order` | integer | DEFAULT 0 | 排序順序，數字越小越靠前 |
| `group` | text | DEFAULT ''，NOT NULL | 友連分組，空字串表示預設分組 |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `uid` → `users.id` ON DELETE CASCADE

---

## hashtags（標籤表）

儲存文章標籤。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `name` | text | NOT NULL | 標籤名稱 |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

---

## feed_hashtags（文章—標籤關聯表）

關聯文章與標籤的多對多關係。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `feed_id` | integer | NOT NULL | 文章 ID，關聯 `feeds.id`，刪除時層級刪除 |
| `hashtag_id` | integer | NOT NULL | 標籤 ID，關聯 `hashtags.id`，刪除時層級刪除 |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |

**關聯：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `hashtag_id` → `hashtags.id` ON DELETE CASCADE

**注意：**
- 複合主鍵為 `(feed_id, hashtag_id)`，確保同一篇文章不會重複加入同一個標籤

---

## info（系統設定表）

儲存系統鍵值對設定。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `key` | text | NOT NULL, UNIQUE | 設定鍵名稱 |
| `value` | text | NOT NULL | 設定值 |

**索引：**
- 唯一索引 `info_key_unique` ON `key`

**常見 key 範例：**
- `site.name` - 網站名稱
- `site.description` - 網站描述
- `site.avatar` - 網站頭像
- `site.page_size` - 分頁大小
- `rss` - RSS 啟用狀態
- 其他執行階段設定

---

## cache（快取表）

儲存應用程式快取資料。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `key` | text | NOT NULL | 快取鍵 |
| `value` | text | NOT NULL | 快取值（JSON 字串） |
| `type` | text | DEFAULT 'cache' | 快取類型，用於分類（如 `cache`、`server_config`、`client_config`） |
| `created_at` | integer | DEFAULT (unixepoch()) | 建立時間戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新時間戳 |
| `expires_at` | integer | NULL | 到期時間戳（Unix 時間），NULL 表示永不過期 |

**約束：**
- 複合唯一約束 `cache_key_type_unique` ON (`key`, `type`)

**索引：**
- `idx_cache_type` ON `type`
- `idx_cache_key` ON `key`

**郵件自動友連申請使用的 type 值：**
- `friend.email`：以申請人信箱為 `key`，儲存其進行中申請的狀態（階段、操作類型、JSON 載荷、驗證碼、截止時間等）。
- `friend.email.lock`：固定 `key` 為 `global`，用於實作「同一時間僅允許一個申請」的並行鎖。

**友連分組使用的 `type='client.config'` 鍵：**
- `friend_groups`：管理員自訂的分組名稱 JSON 陣列（不含預設分組）。
- `friend_group_order`：控制友連顯示順序的 JSON 陣列，空字串元素代表預設分組（「朋友們」），新建分組預設插入到它之後。

---

## linked_accounts（第三方登入綁定表）

儲存使用者綁定的第三方登入帳號（GitHub、Gitee、QQ、WeChat 等）。

| 欄位名稱 | 型別 | 約束 | 說明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主鍵 |
| `user_id` | integer | NOT NULL | 使用者 ID，關聯 `users.id` |
| `provider` | text | NOT NULL | 登入供應商，如 `github`、`gitee`、`qq`、`wechat` |
| `provider_id` | text | NOT NULL | 供應商側的使用者識別碼（OpenID 等） |
| `linked_at` | integer | DEFAULT (unixepoch()) | 綁定時間戳 |

**關聯：**
- `user_id` → `users.id` ON DELETE CASCADE

**注意：**
- 同一使用者可綁定多個第三方帳號
- 同一第三方帳號不可綁定到多個使用者

---

## 資料表關聯圖

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

## 直接修改資料庫注意事項

1. **使用 Drizzle ORM 遷移**：修改表結構時，應產生 Drizzle 遷移檔而非直接執行 SQL
2. **禁止 DROP/RENAME**：Cloudflare D1 不支援 `DROP TABLE` 與 `RENAME TABLE`，遷移需使用 `ALTER TABLE` 新增欄位
3. **時間戳格式**：所有時間戳使用 Unix 時間戳（整數，單位為秒）
4. **外鍵約束**：SQLite 預設不會強制外鍵約束，應用程式層負責維護資料一致性
5. **訪客留言**：`comments.user_id` 可為空，刪除對應使用者時會層級刪除該使用者的所有留言

---

## sqlite_sequence 表

`sqlite_sequence` 是 SQLite 內部系統表，不需要手動建立或修改。

**作用**：
- 記錄使用 `AUTOINCREMENT` 的資料表目前的最大 ROWID
- 確保 `INTEGER PRIMARY KEY AUTOINCREMENT` 欄位的值單調遞增，避免 ROWID 重複使用
- 每次插入新資料列時，SQLite 會自動從此表讀取並更新序列值

**注意：**
- 這是 SQLite 自動維護的內部資料表，不應直接修改
- 如果某張資料表的序列值出現異常，可使用 `UPDATE sqlite_sequence SET seq = N WHERE name = 'table_name'` 修復，但通常不需要這麼做
