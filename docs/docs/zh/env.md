# 环境变量配置指南

Rin 部署需要配置两类环境变量：**Variables（明文变量）** 和 **Secrets（加密变量）**。

## 快速区分

| 类型 | 存储方式 | 用途 | 示例 |
|------|---------|------|------|
| **Variables** | 明文存储在 `wrangler.toml` | 配置参数、功能开关 | 存储桶名称、缓存模式 |
| **Secrets** | 加密存储在 Cloudflare | 敏感凭证、密钥 | API 密钥、密码、Token |

---

## Variables（明文变量）

这些变量在 `wrangler.toml` 或 GitHub Actions 中明文存储，用于配置功能开关和基本参数。

### 站点配置

| 变量名 | 必填 | 描述 | 默认值 |
|--------|------|------|--------|
| `NAME` | 否 | 网站名称 | Rin |
| `DESCRIPTION` | 否 | 网站描述 | A lightweight personal blogging system |
| `AVATAR` | 否 | 网站头像 URL | - |
| `PAGE_SIZE` | 否 | 默认分页大小 | 5 |
| `RSS_ENABLE` | 否 | 启用 RSS 链接 | false |

:::tip
站点配置可在部署后通过**设置页面**修改，环境变量仅作为初始值。
:::

### 存储配置

| 变量名 | 必填 | 描述 | 默认值 | 示例 |
|--------|------|------|--------|------|
| `S3_FOLDER` | 是 | 图片存储路径 | images/ | `images/` |
| `S3_CACHE_FOLDER` | 否 | 缓存文件路径 | cache/ | `cache/` |
| `S3_BUCKET` | 是 | S3 存储桶名称 | - | `my-bucket` |
| `S3_REGION` | 是 | S3 区域（R2 填 auto） | - | `auto` |
| `S3_ENDPOINT` | 是 | S3 接入点地址 | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | 否 | 对外访问地址 | 同 S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | 否 | 强制路径样式 | false | `false` |

### 功能开关

| 变量名 | 必填 | 描述 | 默认值 | 推荐值 |
|--------|------|------|--------|--------|
| `CACHE_STORAGE_MODE` | 否 | 缓存模式：s3/database | s3 | **database** |
| `WEBHOOK_URL` | 否 | 评论通知 Webhook | - | - |
| `RSS_TITLE` | 否 | RSS 标题 | Rin Development | - |
| `RSS_DESCRIPTION` | 否 | RSS 描述 | Development Environment | - |

:::tip 新用户推荐
建议将 `CACHE_STORAGE_MODE` 设为 `database`，无需额外配置 S3 缓存即可使用，降低部署复杂度。
:::

---

## Secrets（加密变量）

这些敏感信息必须作为 **Cloudflare Workers Secrets** 配置，部署时通过命令行输入或提前设置。

### 认证相关

| 变量名 | 必填 | 描述 | 获取方式 |
|--------|------|------|----------|
| `ADMIN_USERNAME` | 条件 | 账号密码登录用户名 | 自行设定 |
| `ADMIN_PASSWORD` | 条件 | 账号密码登录密码 | 自行设定 |
| `RIN_GITHUB_CLIENT_ID` | 条件 | GitHub OAuth 客户端 ID | GitHub OAuth App 设置 |
| `RIN_GITHUB_CLIENT_SECRET` | 条件 | GitHub OAuth 客户端密钥 | GitHub OAuth App 设置 |
| `RIN_GITEE_CLIENT_ID` | 条件 | Gitee OAuth 客户端 ID | Gitee OAuth App 设置 |
| `RIN_GITEE_CLIENT_SECRET` | 条件 | Gitee OAuth 客户端密钥 | Gitee OAuth App 设置 |
| `RIN_QQ_TOKEN` | 条件 | 心月互联 QQ 登录 Token | 心月互联 https://qq.wch666.com/ 申请 |
| `EMAIL_DOMAIN` | 否 | 邮箱登录域名限制（JSON 数组，如 `["qq.com","example.com"]`） | 空 = 不限制 |
| `SMTP_MAIL` | 条件 | SMTP 发件邮箱 | SMTP 服务商处获取 |
| `SMTP_USER` | 条件 | SMTP 登录用户名 | SMTP 服务商处获取 |
| `SMTP_PASS` | 条件 | SMTP 登录密码 | SMTP 服务商处获取 |
| `SMTP_HOST` | 条件 | 邮件服务 HTTP API 地址（Cloudflare Workers 不支持原始 TCP SMTP） | 如 Mailgun `https://api.mailgun.net/v3/your-domain/messages`、SendGrid `https://api.sendgrid.com/v3/mail/send` |
| `JWT_SECRET` | **是** | JWT 签名密钥（任意随机字符串） | 自行生成 |

:::warning SMTP 限制
Cloudflare Workers 不支持原始 TCP SMTP（如 `smtp.163.com:587`、`smtp.qq.com:465`）。必须使用提供 HTTP API 的邮件服务，例如：
- **Mailgun**：`https://api.mailgun.net/v3/your-domain/messages`
- **SendGrid**：`https://api.sendgrid.com/v3/mail/send`
- **Postmark**、**Brevo** 等

`SMTP_USER` 和 `SMTP_PASS` 分别对应邮件服务提供的 API Key 或登录凭证。
:::

:::warning 认证要求
至少配置以下认证方式中的 **一种**：
- GitHub OAuth（`RIN_GITHUB_CLIENT_ID` + `RIN_GITHUB_CLIENT_SECRET`）
- Gitee OAuth（`RIN_GITEE_CLIENT_ID` + `RIN_GITEE_CLIENT_SECRET`）
- QQ 登录（`RIN_QQ_TOKEN`）
- 邮箱验证码登录（`SMTP_MAIL` + `SMTP_USER` + `SMTP_PASS` + `SMTP_HOST`）
- 账号密码登录（`ADMIN_USERNAME` + `ADMIN_PASSWORD`）

否则无法登录后台。
:::

:::note QQ 回调地址
QQ 登录的回调地址固定为 `https://<你的域名>/api/user/xinyueqq/callback`，需在心月互联后台为该 Token 配置一致。代码中路径写死，无需环境变量。
:::

### S3 存储凭证

| 变量名 | 必填 | 描述 | 获取方式 |
|--------|------|------|----------|
| `S3_ACCESS_KEY_ID` | 条件 | S3 访问密钥 ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | 条件 | S3 访问密钥 | R2 API Token |

:::tip
当 `CACHE_STORAGE_MODE=database` 时，S3 存储凭证为可选配置，仅图片上传功能需要。
:::

### Cloudflare 绑定（非环境变量）

以下为 Cloudflare Worker 绑定，通过 `wrangler.toml` 配置，不属于环境变量：

| 绑定名 | 类型 | 描述 |
|--------|------|------|
| `DB` | D1 Database | 数据库绑定 |
| `ASSETS` | R2 / Static Assets | 静态资源绑定（可选） |
| `AI` | AI | Cloudflare AI 模型绑定 |

---

## GitHub Actions 变量配置

使用 GitHub Actions 自动部署时，需在 Repository 设置中配置以下变量：

### Repository Variables（Settings → Secrets and variables → Variables）

| 变量名 | 必填 | 描述 | 默认值 |
|--------|------|------|--------|
| `NAME` | 否 | 网站名称 | Rin |
| `DESCRIPTION` | 否 | 网站描述 | A lightweight personal blogging system |
| `AVATAR` | 否 | 网站头像 URL | - |
| `PAGE_SIZE` | 否 | 分页大小 | 5 |
| `RSS_ENABLE` | 否 | 是否启用 RSS | false |
| `CACHE_STORAGE_MODE` | 否 | 缓存模式 | s3 |
| `S3_CACHE_FOLDER` | 否 | 缓存文件路径 | cache/ |
| `S3_FOLDER` | 否 | 图片存储路径 | images/ |
| `S3_REGION` | 否 | S3 区域 | auto |
| `S3_FORCE_PATH_STYLE` | 否 | 强制路径样式 | false |
| `RSS_TITLE` | 否 | RSS 标题 | Rin Development |
| `RSS_DESCRIPTION` | 否 | RSS 描述 | Development Environment |
| `WEBHOOK_URL` | 否 | 评论通知 Webhook | - |
| `REPO_WORKER_NAME` | 否 | Worker 名称 | rin-server |
| `REPO_DB_NAME` | 否 | D1 数据库名称 | rin |
| `R2_BUCKET_NAME` | 否 | R2 存储桶名称 | - |

### Repository Secrets（Settings → Secrets and variables → Secrets）

| 变量名 | 必填 | 描述 |
|--------|------|------|
| `CLOUDFLARE_API_TOKEN` | 是 | Cloudflare API 令牌 |
| `CLOUDFLARE_ACCOUNT_ID` | 是 | Cloudflare 账户 ID |
| `S3_ENDPOINT` | 条件 | S3/R2 接入点 |
| `S3_ACCESS_HOST` | 条件 | S3/R2 访问域名 |
| `S3_BUCKET` | 条件 | S3 存储桶名称 |
| `S3_ACCESS_KEY_ID` | 条件 | S3 访问密钥 ID |
| `S3_SECRET_ACCESS_KEY` | 条件 | S3 访问密钥 |
| `JWT_SECRET` | **是** | JWT 签名密钥 |
| `RIN_GITHUB_CLIENT_ID` | 条件 | GitHub OAuth ID |
| `RIN_GITHUB_CLIENT_SECRET` | 条件 | GitHub OAuth Secret |
| `RIN_GITEE_CLIENT_ID` | 条件 | Gitee OAuth ID |
| `RIN_GITEE_CLIENT_SECRET` | 条件 | Gitee OAuth Secret |
| `RIN_QQ_TOKEN` | 条件 | 心月互联 QQ 登录 Token |
| `ADMIN_USERNAME` | 条件 | 管理员用户名 |
| `ADMIN_PASSWORD` | 条件 | 管理员密码 |
| `SMTP_MAIL` | 条件 | SMTP 发件邮箱 |
| `SMTP_USER` | 条件 | SMTP 登录用户名 |
| `SMTP_PASS` | 条件 | SMTP 登录密码 |
| `SMTP_HOST` | 条件 | SMTP 服务器地址 |

---

## 本地开发环境变量

本地开发使用 `.env` 文件，参考 `.env.example`：

```bash
# 站点配置
NAME="My Blog"
DESCRIPTION="A personal blog"
AVATAR=https://example.com/avatar.png
PAGE_SIZE=5
RSS_ENABLE=false

# S3 存储（使用 R2 或 MinIO）
S3_FOLDER=images/
S3_CACHE_FOLDER=cache/
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_HOST=https://cdn.example.com
S3_FORCE_PATH_STYLE=false

# 缓存模式
CACHE_STORAGE_MODE=database

# Webhook
WEBHOOK_URL=

# RSS
RSS_TITLE=My Blog
RSS_DESCRIPTION=My Personal Blog

# 认证方式（至少配置一种）

# 方式一：GitHub OAuth
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx

# 方式二：Gitee OAuth
RIN_GITEE_CLIENT_ID=xxx
RIN_GITEE_CLIENT_SECRET=xxx

# 方式三：心月互联 QQ 登录
RIN_QQ_TOKEN=xxx

# 方式四：邮箱验证码登录
EMAIL_DOMAIN=["qq.com","example.com"]
SMTP_MAIL=noreply@example.com
SMTP_USER=noreply@example.com
SMTP_PASS=xxx
# 必须使用 HTTP API 端点，不支持原始 TCP SMTP
# Mailgun 示例：
SMTP_HOST=https://api.mailgun.net/v3/example.com/messages
# SendGrid 示例：
# SMTP_HOST=https://api.sendgrid.com/v3/mail/send

# 方式五：账号密码登录
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# JWT 密钥（必须）
JWT_SECRET=random_secret_key

# S3 访问密钥（使用 S3 存储时需要）
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

---

## 最小部署清单

### 仅使用账号密码登录（最小配置）

| 变量 | 类型 | 必填 |
|------|------|------|
| `JWT_SECRET` | Secret | 是 |
| `ADMIN_USERNAME` | Secret | 是 |
| `ADMIN_PASSWORD` | Secret | 是 |
| `S3_FOLDER` | Variable | 是 |
| `S3_BUCKET` | Variable | 是 |
| `S3_REGION` | Variable | 是 |
| `S3_ENDPOINT` | Variable | 是 |
| `S3_ACCESS_KEY_ID` | Secret | 条件 |
| `S3_SECRET_ACCESS_KEY` | Secret | 条件 |

### 完整配置（所有功能）

包含站点配置、所有 OAuth、邮箱登录、S3 存储、Webhook、RSS。

---

## 常见问题

### Q: `CACHE_STORAGE_MODE=database` 还需要配置 S3 吗？

不需要。`database` 模式将缓存存储在 D1 数据库中，无需 S3/R2 配置。但如果需要上传图片，仍需配置 S3 存储变量。

### Q: 可以同时启用多种登录方式吗？

可以。同时配置多种登录方式的凭证即可，前端会自动显示对应的登录按钮。

### Q: `EMAIL_DOMAIN` 如何限制特定域名？

```bash
# 只允许 qq.com 和 example.com 的邮箱登录
EMAIL_DOMAIN=["qq.com","example.com"]
```

留空则不限制域名。

### Q: `SMTP_HOST` 支持 HTTP API 吗？

支持。对于 Mailgun、SendGrid 等邮件服务，`SMTP_HOST` 可以设置为 HTTP API 端点。具体格式请参考相应服务商的文档。
