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
| `FRONTEND_URL` | 否 | 站点根地址（sitemap.xml 与 robots.txt 生成基准，多域名部署时建议配置） | 请求 origin |

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
| `RIN_WECHAT_APPID` | 条件 | 聚合登录 WeChat 应用 ID | 聚合登录 https://login.mapay.cn/ 申请 |
| `RIN_WECHAT_APPKEY` | 条件 | 聚合登录 WeChat 应用密钥 | 聚合登录 https://login.mapay.cn/ 申请 |
| `EMAIL_SEND_URLS` | 条件 | MailPort 发件地址（JSON 数组，可填多个；仅一个发件商时可省略数组括号，详见下方「填写格式」） | 部署 [MailPort](https://github.com/wool-hmq/mailport) 后在发件商页面获取 |
| `EMAIL_SEND_KEYS` | 条件 | MailPort API 密钥（JSON 数组或单个字符串，与 `EMAIL_SEND_URLS` 按顺序一一匹配） | MailPort 发件商页面生成 |
| `EMAIL_RESEND_URL` | 条件 | 旧版邮件转发服务 URL（Vercel 部署的 Rin-Email 项目地址），未配置 `EMAIL_SEND_URLS` 时回退使用 | 自行部署 Rin-Email 到 Vercel 获取 |
| `EMAIL_RESEND_PASS` | 条件 | 旧版邮件转发服务认证密码（与 Vercel 项目中 EMAIL_PASS 相同） | 自行设定 |
| `JWT_SECRET` | **是** | JWT 签名密钥（任意随机字符串） | 自行生成 |

:::warning 认证要求
至少配置以下认证方式中的 **一种**：
- GitHub OAuth（`RIN_GITHUB_CLIENT_ID` + `RIN_GITHUB_CLIENT_SECRET`）
- Gitee OAuth（`RIN_GITEE_CLIENT_ID` + `RIN_GITEE_CLIENT_SECRET`）
- QQ 登录（`RIN_QQ_TOKEN`）
- 微信登录（`RIN_WECHAT_APPID` + `RIN_WECHAT_APPKEY`）
- 邮箱验证码登录（`EMAIL_SEND_URLS` + `EMAIL_SEND_KEYS`，或旧的 `EMAIL_RESEND_URL` + `EMAIL_RESEND_PASS`）
- 账号密码登录（`ADMIN_USERNAME` + `ADMIN_PASSWORD`）

否则无法登录后台。
:::

:::note 邮箱验证码架构
Rin 博客运行在 Cloudflare Workers 上，不支持原始 TCP SMTP。邮箱验证码功能通过 [MailPort](https://github.com/wool-hmq/mailport) 发件服务实现：

1. 部署 MailPort 项目，创建发件商并配置发件方式（SMTP / HTTP API / Outlook 或 Gmail OAuth）
2. Rin 博客收到发送验证码请求后，调用 `EMAIL_SEND_URLS` 中的发件接口，以 `Authorization: Bearer <EMAIL_SEND_KEYS>` 鉴权
3. 允许的收件域名在 MailPort 发件商配置中管理

`EMAIL_SEND_URLS` 与 `EMAIL_SEND_KEYS` 按顺序一一匹配、轮询使用：第一个失败会自动尝试下一个，全部失败才报错。

未配置 `EMAIL_SEND_URLS` 时，回退到旧的 `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email 项目）。

**填写格式**

`EMAIL_SEND_URLS` 是发件地址的 JSON 数组，每个元素是 MailPort 发件商的完整发件地址，形如 `https://<你的域名>/api/<发件商ID>/send`；`EMAIL_SEND_KEYS` 是与之对应的 API 密钥，同样可以是 JSON 数组。

只用一个发件商时，`EMAIL_SEND_KEYS` 可以直接写成一个普通字符串，无需数组括号：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

用多个发件商、且每个发件商密钥各不相同时，两个数组按下标一一对应：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

用多个发件商、但共用一个密钥时，`EMAIL_SEND_KEYS` 只写一个即可，会自动套用到所有地址：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

当 `EMAIL_SEND_KEYS` 提供多个值时，其数量必须与 `EMAIL_SEND_URLS` 一致（或只提供一个密钥供所有地址共用），数量不匹配会在发送时直接报错。
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
| `EMAIL_SEND_URLS` | 条件 | MailPort 发件地址（JSON 数组） | - |

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
| `EMAIL_SEND_KEYS` | 条件 | MailPort API 密钥（与 `EMAIL_SEND_URLS` 按顺序匹配） |

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

# 方式四：聚合登录 WeChat
RIN_WECHAT_APPID=xxx
RIN_WECHAT_APPKEY=xxx

# 方式五：邮箱验证码登录
# 部署 MailPort（https://github.com/wool-hmq/mailport）后，配置以下环境变量：
# - MailPort 项目：创建发件商，配置发件方式与收件域名白名单，生成 API 密钥
# - Rin 博客环境变量：EMAIL_SEND_URLS 是发件地址的 JSON 数组，EMAIL_SEND_KEYS 是对应密钥
#   单个发件商（密钥可直接写普通字符串）：
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-mailport-api-key
#   多个发件商（密钥与地址按下标一一对应，或共用一个密钥）：
# EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
# EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
# 旧方案（未配置上面两个变量时回退使用，需部署 Rin-Email 到 Vercel）：
EMAIL_RESEND_URL=https://your-rin-email.vercel.app/api/send
EMAIL_RESEND_PASS=your-email-pass

# 方式六：账号密码登录
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

### Q: 如何配置邮箱验证码登录？

邮箱验证码功能通过 [MailPort](https://github.com/wool-hmq/mailport) 发件服务实现：

1. 部署 MailPort 项目，创建发件商并配置发件方式（SMTP / HTTP API / Outlook 或 Gmail OAuth）
2. 在 MailPort 发件商页面生成 API 密钥，并按需配置收件域名白名单
3. 在 Cloudflare Worker 中配置：
   - `EMAIL_SEND_URLS` = MailPort 发件商的完整发件地址（JSON 数组，可填多个）
   - `EMAIL_SEND_KEYS` = 对应的 API 密钥（与地址按顺序一一匹配）

`EMAIL_SEND_URLS` 与 `EMAIL_SEND_KEYS` 按顺序轮询：第一个失败会自动尝试下一个，全部失败才报错。
未配置这两个变量时，回退到旧的 `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`（Rin-Email）。

### Q: `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS` 的 JSON 格式怎么填？

`EMAIL_SEND_URLS` 是发件地址的 JSON 数组，每个元素形如 `https://<你的域名>/api/<发件商ID>/send`；`EMAIL_SEND_KEYS` 是与之一一对应的密钥数组。

只用一个发件商时，密钥可直接写成普通字符串：

```bash
EMAIL_SEND_URLS=["https://your-mailport.vercel.app/api/xxxxxx/send"]
EMAIL_SEND_KEYS=your-api-key
```

用多个发件商、密钥各不相同时，两个数组按下标对应：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=["key-for-a","key-for-b"]
```

多个发件商共用一个密钥时，密钥只写一个：

```bash
EMAIL_SEND_URLS=["https://mail-a.vercel.app/api/aaaaaa/send","https://mail-b.vercel.app/api/bbbbbb/send"]
EMAIL_SEND_KEYS=shared-api-key
```

多个密钥的数量必须与地址数量一致，或只提供一个密钥共用；数量不匹配会在发送时报错。

### Q: 如何限制允许的邮箱域名？

在 MailPort 发件商配置的「收件域名白名单」中添加允许的域名（例如 `qq.com`、`example.com`），只有白名单内的收件地址才会发送。

白名单留空则不限制域名。

### Q: MailPort 支持哪些发件方式？

MailPort 支持以下发件方式：
- SMTP：任意 SMTP 服务商（163 邮箱、QQ 邮箱、Gmail 等）
- HTTP API：转发到自定义的 HTTP 接口
- Outlook OAuth2 / Gmail OAuth2：免应用密码，授权后直接发件

详见 [MailPort 项目文档](https://github.com/wool-hmq/mailport)。
