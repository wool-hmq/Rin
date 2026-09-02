# Database Schema Documentation

Rin uses SQLite database (via Drizzle ORM) with 11 tables.

## Table Overview

| Table | Description |
|-------|-------------|
| `users` | User accounts |
| `feeds` | Blog posts/articles |
| `moments` | Social moments/posts |
| `comments` | Comments on posts |
| `visits` | Visit records |
| `visit_stats` | Visit statistics |
| `friends` | Friend links |
| `hashtags` | Tags |
| `feed_hashtags` | Post-tag associations |
| `info` | System configuration |
| `cache` | Application cache |

---

## users (User Table)

Stores user information, supporting multiple login methods.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `username` | text | NOT NULL, UNIQUE | Username, globally unique |
| `openid` | text | NOT NULL | OAuth OpenID, format `provider:openid` (e.g. `github:12345`, `qq:abcdef`) |
| `email` | text | DEFAULT "" | Email address (for email verification login) |
| `avatar` | text | NULLABLE | Avatar URL |
| `password` | text | NULLABLE | Password hash (for username/password login) |
| `permission` | integer | DEFAULT 0 | Permission level, 0 = regular user |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp (Unix timestamp) |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp (Unix timestamp) |

**Indexes:**
- Unique index `users_username_unique` ON `username`

**Notes:**
- Same user can login via multiple methods (GitHub + QQ + Email), `openid` distinguishes different login methods
- `email` field is used for email verification login, username becomes full email address after login

---

## feeds (Posts Table)

Stores blog post content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `alias` | text | NULLABLE | URL alias (custom slug) |
| `title` | text | NULLABLE | Post title |
| `summary` | text | DEFAULT '' | Post summary |
| `ai_summary` | text | DEFAULT '' | AI-generated summary |
| `ai_summary_status` | text | DEFAULT 'idle' | AI summary status: `idle`/`processing`/`done`/`error` |
| `ai_summary_error` | text | DEFAULT '' | AI summary generation error message |
| `content` | text | NOT NULL | Post content (Markdown) |
| `listed` | integer | DEFAULT 1 | Show in list page, 1=show, 0=hide |
| `draft` | integer | DEFAULT 1 | Is draft, 1=draft, 0=published |
| `top` | integer | DEFAULT 0 | Is pinned, 1=pinned, 0=normal |
| `uid` | integer | NOT NULL | Author user ID, references `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `uid` → `users.id` (post belongs to one user)

---

## moments (Moments Table)

Stores user short posts/moments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `content` | text | NOT NULL | Moment content |
| `uid` | integer | NOT NULL | Author user ID, references `users.id` |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `uid` → `users.id` (moment belongs to one user)

---

## comments (Comments Table)

Stores post comments, supports guest comments.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `feed_id` | integer | NOT NULL | Post ID, references `feeds.id`, CASCADE delete |
| `user_id` | integer | NULLABLE | Commenter user ID, references `users.id`, CASCADE delete, NULL for guests |
| `content` | text | NOT NULL | Comment content |
| `guest_name` | text | DEFAULT '' | Guest name (for guest comments) |
| `guest_email` | text | DEFAULT '' | Guest email (for guest comments) |
| `guest_website` | text | DEFAULT '' | Guest website (for guest comments) |
| `approved` | integer | DEFAULT 1 | Is approved, 1=approved, 0=pending |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `user_id` → `users.id` ON DELETE CASCADE (nullable)

**Notes:**
- For guest comments, `user_id` is NULL, use `guest_name`/`guest_email`/`guest_website` for guest info

---

## visits (Visit Records Table)

Records each visit to a post.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `feed_id` | integer | NOT NULL | Post ID, references `feeds.id`, CASCADE delete |
| `ip` | text | NOT NULL | Visitor IP address |
| `created_at` | integer | DEFAULT (unixepoch()) | Visit timestamp |

**Relations:**
- `feed_id` → `feeds.id` ON DELETE CASCADE

**Notes:**
- This table stores raw visit data, statistics are aggregated via `visit_stats`

---

## visit_stats (Visit Statistics Table)

Stores post visit statistics using HyperLogLog for deduplication.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `feed_id` | integer | PRIMARY KEY | Post ID (also primary key), references `feeds.id`, CASCADE delete |
| `pv` | integer | DEFAULT 0 | Page views (PV) |
| `hll_data` | text | DEFAULT '' | HyperLogLog data for unique visitor (UV) deduplication |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `feed_id` → `feeds.id` ON DELETE CASCADE

---

## friends (Friend Links Table)

Stores友情链接 (friend links).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `name` | text | NOT NULL | Friend link name |
| `desc` | text | NULLABLE | Friend link description |
| `avatar` | text | NOT NULL | Friend link avatar URL |
| `url` | text | NOT NULL | Friend link URL |
| `uid` | integer | NOT NULL | Submitter user ID, references `users.id`, CASCADE delete |
| `accepted` | integer | DEFAULT 0 | Is accepted, 1=accepted, 0=pending |
| `health` | text | DEFAULT '' | Health status (for link checking) |
| `sort_order` | integer | DEFAULT 0 | Sort order, lower numbers first |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `uid` → `users.id` ON DELETE CASCADE

---

## hashtags (Tags Table)

Stores post tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `name` | text | NOT NULL | Tag name |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

---

## feed_hashtags (Post-Tag Association Table)

Many-to-many relationship between posts and tags.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `feed_id` | integer | NOT NULL | Post ID, references `feeds.id`, CASCADE delete |
| `hashtag_id` | integer | NOT NULL | Tag ID, references `hashtags.id`, CASCADE delete |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Relations:**
- `feed_id` → `feeds.id` ON DELETE CASCADE
- `hashtag_id` → `hashtags.id` ON DELETE CASCADE

**Notes:**
- Composite primary key is `(feed_id, hashtag_id)`, ensures no duplicate tag assignments per post

---

## info (System Configuration Table)

Stores system key-value configuration.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `key` | text | NOT NULL, UNIQUE | Configuration key name |
| `value` | text | NOT NULL | Configuration value |

**Indexes:**
- Unique index `info_key_unique` ON `key`

**Common key examples:**
- `site.name` - Site name
- `site.description` - Site description
- `site.avatar` - Site avatar
- `site.page_size` - Pagination size
- `rss` - RSS enabled status
- Other runtime configuration

---

## cache (Cache Table)

Stores application cache data.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | integer | PRIMARY KEY, NOT NULL | Auto-incrementing ID |
| `key` | text | NOT NULL | Cache key |
| `value` | text | NOT NULL | Cache value (JSON string) |
| `type` | text | DEFAULT 'cache' | Cache type, for categorization (e.g. `cache`, `server_config`, `client_config`) |
| `created_at` | integer | DEFAULT (unixepoch()) | Creation timestamp |
| `updated_at` | integer | DEFAULT (unixepoch()) | Update timestamp |

**Constraints:**
- Composite unique constraint `cache_key_type_unique` ON (`key`, `type`)

**Indexes:**
- `idx_cache_type` ON `type`
- `idx_cache_key` ON `key`

---

## Table Relationship Diagram

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

## Notes for Direct Database Modification

1. **Use Drizzle ORM migrations**: When modifying schema, generate Drizzle migration files instead of executing raw SQL
2. **No DROP/RENAME**: Cloudflare D1 does not support `DROP TABLE` and `RENAME TABLE`, migrations must use `ALTER TABLE ADD COLUMN`
3. **Timestamp format**: All timestamps use Unix timestamp (integer, seconds)
4. **Foreign key constraints**: SQLite does not enforce foreign key constraints by default, application layer is responsible for data consistency
5. **Guest comments**: `comments.user_id` can be NULL, when user is deleted, all their comments are CASCADE deleted
