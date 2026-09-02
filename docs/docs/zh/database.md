# 数据库结构文档

Rin 使用 SQLite 数据库（通过 Drizzle ORM），共包含 11 张表。

## 表概览

| 表名 | 说明 |
|------|------|
| `users` | 用户表 |
| `feeds` | 文章/动态表 |
| `moments` | 朋友圈/动态表 |
| `comments` | 评论表 |
| `visits` | 访问记录表 |
| `visit_stats` | 访问统计表 |
| `friends` | 友链表 |
| `hashtags` | 标签表 |
| `feed_hashtags` | 文章-标签关联表 |
| `info` | 系统配置表 |
| `cache` | 缓存表 |

---

## users（用户表）

存储用户信息，支持账号密码、OAuth、QQ、邮箱等多种登录方式。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `username` | text | NOT NULL, UNIQUE | 用户名，全局唯一 |
| `openid` | text | NOT NULL | OAuth OpenID，格式为 `provider:openid`（如 `github:12345`、`qq:abcdef`） |
| `email` | text | DEFAULT "" | 邮箱地址（用于邮箱验证码登录） |
| `avatar` | text | NULLABLE | 头像 URL |
| `password` | text | NULLABLE | 密码哈希（账号密码登录使用） |
| `permission` | integer | DEFAULT 0 | 权限级别，0 为普通用户 |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳（Unix 时间戳） |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳（Unix 时间戳） |

**索引：**
- 唯一索引 `users_username_unique` ON `username`

**注意：**
- 同一用户可通过多种方式登录（GitHub + QQ + 邮箱），`openid` 用于区分不同登录方式
- `email` 字段用于邮箱验证码登录，登录后 username 为完整邮箱地址

---

## feeds（文章/动态表）

存储博客文章内容。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `alias` | text | NULLABLE | URL 别名（自定义slug） |
| `title` | text | NULLABLE | 文章标题 |
| `summary` | text | DEFAULT '' | 文章摘要 |
| `ai_summary` | text | DEFAULT '' | AI 生成的摘要 |
| `ai_summary_status` | text | DEFAULT 'idle' | AI 摘要状态：`idle`/`processing`/`done`/`error` |
| `ai_summary_error` | text | DEFAULT '' | AI 摘要生成错误信息 |
| `content` | text | NOT NULL | 文章内容（Markdown） |
| `listed` | integer | DEFAULT 1 | 是否在列表页显示，1=显示，0=隐藏 |
| `draft` | integer | DEFAULT 1 | 是否为草稿，1=草稿，0=已发布 |
| `top` | integer | DEFAULT 0 | 是否置顶，1=置顶，0=普通 |
| `uid` | integer | NOT NULL | 作者用户 ID，关联 `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `uid` → `users.id`（文章属于一个用户）

---

## moments（动态/朋友圈表）

存储用户发布的短动态。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `content` | text | NOT NULL | 动态内容 |
| `uid` | integer | NOT NULL | 发布用户 ID，关联 `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `uid` → `users.id`（动态属于一个用户）

---

## comments（评论表）

存储文章评论，支持游客评论。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `feed_id` | integer | NOT NULL | 关联文章 ID，关联 `feeds.id`，删除时级联删除 |
| `user_id` | integer | NULLABLE | 评论用户 ID，关联 `users.id`，删除时级联删除，游客评论为空 |
| `content` | text | NOT NULL | 评论内容 |
| `guest_name` | text | DEFAULT '' | 游客名称（游客评论时使用） |
| `guest_email` | text | DEFAULT '' | 游客邮箱（游客评论时使用） |
| `guest_website` | text | DEFAULT '' | 游客网站（游客评论时使用） |
| `approved` | integer | DEFAULT 1 | 是否审核通过，1=已通过，0=待审核 |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `user_id` → `users.id` ON DELETE CASCADE（可为空）

**注意：**
- 游客评论时 `user_id` 为空，使用 `guest_name`/`guest_email`/`guest_website` 记录游客信息

---

## visits（访问记录表）

记录每篇文章的每次访问。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `feed_id` | integer | NOT NULL | 关联文章 ID，关联 `feeds.id`，删除时级联删除 |
| `ip` | text | NOT NULL | 访问者 IP 地址 |
| `created_at` | integer | DEFAULT (unixepoch()) | 访问时间戳 |

**关系：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

**注意：**
- 此表记录原始访问数据，统计时通过 `visit_stats` 表聚合

---

## visit_stats（访问统计表）

存储文章的访问统计信息，使用 HyperLogLog 去重。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `feed_id` | integer | PRIMARY KEY | 关联文章 ID（同时为主键），关联 `feeds.id`，删除时级联删除 |
| `pv` | integer | DEFAULT 0 | 页面浏览量（PV） |
| `hll_data` | text | DEFAULT '' | HyperLogLog 数据，用于高效统计独立访客（UV） |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `feed_id` → `feeds.id` ON DELETE CASCADE

---

## friends（友链表）

存储友情链接。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `name` | text | NOT NULL | 友链名称 |
| `desc` | text | NULLABLE | 友链描述 |
| `avatar` | text | NOT NULL | 友链头像 URL |
| `url` | text | NOT NULL | 友链地址 |
| `uid` | integer | NOT NULL | 提交用户 ID，关联 `users.id`，删除时级联删除 |
| `accepted` | integer | DEFAULT 0 | 是否已接受，1=已接受，0=待审核 |
| `health` | text | DEFAULT '' | 健康状态（用于链接检测） |
| `sort_order` | integer | DEFAULT 0 | 排序顺序，数字越小越靠前 |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `uid` → `users.id` ON DELETE CASCADE

---

## hashtags（标签表）

存储文章标签。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `name` | text | NOT NULL | 标签名称 |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

---

## feed_hashtags（文章-标签关联表）

关联文章和标签的多对多关系。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `feed_id` | integer | NOT NULL | 文章 ID，关联 `feeds.id`，删除时级联删除 |
| `hashtag_id` | integer | NOT NULL | 标签 ID，关联 `hashtags.id`，删除时级联删除 |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**关系：**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `hashtag_id` → `hashtags.id` ON DELETE CASCADE

**注意：**
- 复合主键为 `(feed_id, hashtag_id)`，确保同一文章不会重复添加同一标签

---

## info（系统配置表）

存储系统键值对配置。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `key` | text | NOT NULL, UNIQUE | 配置键名 |
| `value` | text | NOT NULL | 配置值 |

**索引：**
- 唯一索引 `info_key_unique` ON `key`

**常见 key 示例：**
- `site.name` - 网站名称
- `site.description` - 网站描述
- `site.avatar` - 网站头像
- `site.page_size` - 分页大小
- `rss` - RSS 启用状态
- 其他运行时配置

---

## cache（缓存表）

存储应用缓存数据。

| 字段名 | 类型 | 约束 | 说明 |
|--------|------|------|------|
| `id` | integer | PRIMARY KEY, NOT NULL | 自增主键 |
| `key` | text | NOT NULL | 缓存键 |
| `value` | text | NOT NULL | 缓存值（JSON 字符串） |
| `type` | text | DEFAULT 'cache' | 缓存类型，用于分类（如 `cache`、`server_config`、`client_config`） |
| `created_at` | integer | DEFAULT (unixepoch()) | 创建时间戳 |
| `updated_at` | integer | DEFAULT (unixepoch()) | 更新时间戳 |

**约束：**
- 复合唯一约束 `cache_key_type_unique` ON (`key`, `type`)

**索引：**
- `idx_cache_type` ON `type`
- `idx_cache_key` ON `key`

---

## 表关系图

```text
users (1) ──< (N) feeds
                ├──< (N) comments
                └──< (N) friends

feeds (1) ──< (N) comments
feeds (1) ──< (N) visits
feeds (1) ──< (1) visit_stats
feeds (N) >──< (N) hashtags (via feed_hashtags)

moments (N) >── (1) users
```

---

## 直接修改数据库注意事项

1. **使用 Drizzle ORM 迁移**：修改表结构时，应生成 Drizzle 迁移文件而非直接执行 SQL
2. **禁止 DROP/RENAME**：Cloudflare D1 不支持 `DROP TABLE` 和 `RENAME TABLE`，迁移需使用 `ALTER TABLE` 添加列
3. **时间戳格式**：所有时间戳使用 Unix 时间戳（整数，单位秒）
4. **外键约束**：SQLite 默认不强制外键约束，应用层负责维护数据一致性
5. **游客评论**：`comments.user_id` 可为空，删除对应用户时级联删除该用户的所有评论
