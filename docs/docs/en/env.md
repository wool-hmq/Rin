# Environment Variables Configuration Guide

Rin requires two types of environment variables: **Variables (plaintext)** and **Secrets (encrypted)**.

## Quick Reference

| Type | Storage | Purpose | Examples |
|------|---------|---------|----------|
| **Variables** | Plaintext in `wrangler.toml` | Configuration parameters, feature flags | Bucket name, cache mode |
| **Secrets** | Encrypted in Cloudflare | Sensitive credentials, keys | API keys, passwords, tokens |

---

## Variables (Plaintext)

These variables are stored in plaintext in `wrangler.toml` or GitHub Actions and control feature flags and basic parameters.

### Site Configuration

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NAME` | No | Site name & title | Rin |
| `DESCRIPTION` | No | Site description | A lightweight personal blogging system |
| `AVATAR` | No | Site avatar URL | - |
| `PAGE_SIZE` | No | Default pagination size | 5 |
| `RSS_ENABLE` | No | Enable RSS link | false |

:::tip
Site configuration can be modified via the **Settings Page** after deployment. Environment variables serve as initial defaults only.
:::

### Storage Configuration

| Variable | Required | Description | Default | Example |
|----------|----------|-------------|---------|---------|
| `S3_FOLDER` | Yes | Image storage path | images/ | `images/` |
| `S3_CACHE_FOLDER` | No | Cache file path | cache/ | `cache/` |
| `S3_BUCKET` | Yes | S3 bucket name | - | `my-bucket` |
| `S3_REGION` | Yes | S3 region (use 'auto' for R2) | - | `auto` |
| `S3_ENDPOINT` | Yes | S3 endpoint URL | - | `https://xxx.r2.cloudflarestorage.com` |
| `S3_ACCESS_HOST` | No | Public access URL | Same as S3_ENDPOINT | `https://cdn.example.com` |
| `S3_FORCE_PATH_STYLE` | No | Force path-style URLs | false | `false` |

### Feature Flags

| Variable | Required | Description | Default | Recommended |
|----------|----------|-------------|---------|-------------|
| `CACHE_STORAGE_MODE` | No | Cache mode: s3/database | s3 | **database** |
| `WEBHOOK_URL` | No | Comment notification webhook | - | - |
| `RSS_TITLE` | No | RSS feed title | Rin Development | - |
| `RSS_DESCRIPTION` | No | RSS feed description | Development Environment | - |

:::tip For New Users
We recommend setting `CACHE_STORAGE_MODE` to `database` to reduce deployment complexity without additional S3 cache configuration.
:::

---

## Secrets (Encrypted)

These sensitive values must be configured as **Cloudflare Workers Secrets**, entered via CLI during deployment or set in advance.

### Authentication

| Variable | Required | Description | How to Obtain |
|----------|----------|-------------|---------------|
| `ADMIN_USERNAME` | Conditional | Username for password login | Set yourself |
| `ADMIN_PASSWORD` | Conditional | Password for password login | Set yourself |
| `RIN_GITHUB_CLIENT_ID` | Conditional | GitHub OAuth client ID | GitHub OAuth App settings |
| `RIN_GITHUB_CLIENT_SECRET` | Conditional | GitHub OAuth client secret | GitHub OAuth App settings |
| `RIN_GITEE_CLIENT_ID` | Conditional | Gitee OAuth client ID | Gitee OAuth App settings |
| `RIN_GITEE_CLIENT_SECRET` | Conditional | Gitee OAuth client secret | Gitee OAuth App settings |
| `RIN_QQ_TOKEN` | Conditional | Xinyue QQ login token | Apply at https://qq.wch666.com/ |
| `EMAIL_RESEND_URL` | Conditional | Email relay service URL (Vercel-deployed Rin-Email project) | Deploy Rin-Email to Vercel to get the URL |
| `EMAIL_RESEND_PASS` | Conditional | Email relay service auth password (same as EMAIL_PASS in Vercel project) | Set yourself |
| `JWT_SECRET` | **Yes** | JWT signing key (any random string) | Generate yourself |

:::warning Email Relay Architecture
Cloudflare Workers does not support raw TCP SMTP. Email verification is handled by a Vercel-deployed Rin-Email project:
1. Rin blog receives a verification code request and calls the Vercel project's `/api/send` endpoint
2. The Vercel project uses `nodemailer` to send emails via SMTP
3. Domain restrictions (`EMAIL_DOMAIN`) are configured in the Vercel project

See [Rin-Email project documentation](https://github.com/wool-hmq/Rin-Email).
:::

:::warning Authentication Required
You must configure at least **one** of the following authentication methods:
- GitHub OAuth (`RIN_GITHUB_CLIENT_ID` + `RIN_GITHUB_CLIENT_SECRET`)
- Gitee OAuth (`RIN_GITEE_CLIENT_ID` + `RIN_GITEE_CLIENT_SECRET`)
- QQ Login (`RIN_QQ_TOKEN`)
- Email Verification Code Login (`EMAIL_RESEND_URL` + `EMAIL_RESEND_PASS`)
- Username/Password (`ADMIN_USERNAME` + `ADMIN_PASSWORD`)

Otherwise you cannot access the admin panel.
:::

:::note QQ Callback URL
The QQ login callback URL is fixed to `https://<your-domain>/api/user/xinyueqq/callback`. You must configure the same callback URL for the token in Xinyue. The path is hardcoded in the code, no env var needed.
:::

### S3 Storage Credentials

| Variable | Required | Description | How to Obtain |
|----------|----------|-------------|---------------|
| `S3_ACCESS_KEY_ID` | Conditional | S3 access key ID | R2 API Token ID |
| `S3_SECRET_ACCESS_KEY` | Conditional | S3 secret access key | R2 API Token |

:::tip
When `CACHE_STORAGE_MODE=database`, S3 storage credentials are optional and only needed for image uploads.
:::

### Cloudflare Bindings (Not Environment Variables)

The following are Cloudflare Worker bindings configured in `wrangler.toml`, not environment variables:

| Binding | Type | Description |
|---------|------|-------------|
| `DB` | D1 Database | Database binding |
| `ASSETS` | R2 / Static Assets | Static assets binding (optional) |
| `AI` | AI | Cloudflare AI model binding |

---

## GitHub Actions Variables

When using GitHub Actions for automated deployment, configure these in your Repository settings:

### Repository Variables (Settings → Secrets and variables → Variables)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NAME` | No | Site name | Rin |
| `DESCRIPTION` | No | Site description | A lightweight personal blogging system |
| `AVATAR` | No | Site avatar URL | - |
| `PAGE_SIZE` | No | Pagination size | 5 |
| `RSS_ENABLE` | No | Enable RSS | false |
| `CACHE_STORAGE_MODE` | No | Cache mode | s3 |
| `S3_CACHE_FOLDER` | No | Cache file path | cache/ |
| `S3_FOLDER` | No | Image storage path | images/ |
| `S3_REGION` | No | S3 region | auto |
| `S3_FORCE_PATH_STYLE` | No | Force path-style | false |
| `RSS_TITLE` | No | RSS title | Rin Development |
| `RSS_DESCRIPTION` | No | RSS description | Development Environment |
| `WEBHOOK_URL` | No | Comment notification webhook | - |
| `REPO_WORKER_NAME` | No | Worker name | rin-server |
| `REPO_DB_NAME` | No | D1 database name | rin |
| `R2_BUCKET_NAME` | No | R2 bucket name | - |

### Repository Secrets (Settings → Secrets and variables → Secrets)

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Yes | Cloudflare API token |
| `CLOUDFLARE_ACCOUNT_ID` | Yes | Cloudflare account ID |
| `S3_ENDPOINT` | Conditional | S3/R2 endpoint URL |
| `S3_ACCESS_HOST` | Conditional | S3/R2 access domain |
| `S3_BUCKET` | Conditional | S3 bucket name |
| `S3_ACCESS_KEY_ID` | Conditional | S3 access key ID |
| `S3_SECRET_ACCESS_KEY` | Conditional | S3 secret access key |
| `JWT_SECRET` | **Yes** | JWT signing key |
| `RIN_GITHUB_CLIENT_ID` | Conditional | GitHub OAuth ID |
| `RIN_GITHUB_CLIENT_SECRET` | Conditional | GitHub OAuth Secret |
| `RIN_GITEE_CLIENT_ID` | Conditional | Gitee OAuth ID |
| `RIN_GITEE_CLIENT_SECRET` | Conditional | Gitee OAuth Secret |
| `RIN_QQ_TOKEN` | Conditional | Xinyue QQ login token |
| `ADMIN_USERNAME` | Conditional | Admin username |
| `ADMIN_PASSWORD` | Conditional | Admin password |
| `SMTP_MAIL` | Conditional | SMTP sender email |
| `SMTP_USER` | Conditional | SMTP login username |
| `SMTP_PASS` | Conditional | SMTP login password |
| `SMTP_HOST` | Conditional | SMTP server address |

---

## Local Development Environment

For local development, use `.env` file (see `.env.example`):

```bash
# Site Configuration
NAME="My Blog"
DESCRIPTION="A personal blog"
AVATAR=https://example.com/avatar.png
PAGE_SIZE=5
RSS_ENABLE=false

# S3 Storage (R2 or MinIO)
S3_FOLDER=images/
S3_CACHE_FOLDER=cache/
S3_BUCKET=my-bucket
S3_REGION=auto
S3_ENDPOINT=https://xxx.r2.cloudflarestorage.com
S3_ACCESS_HOST=https://cdn.example.com
S3_FORCE_PATH_STYLE=false

# Cache Mode
CACHE_STORAGE_MODE=database

# Webhook
WEBHOOK_URL=

# RSS
RSS_TITLE=My Blog
RSS_DESCRIPTION=My Personal Blog

# Authentication (configure at least one)

# Option 1: GitHub OAuth
RIN_GITHUB_CLIENT_ID=xxx
RIN_GITHUB_CLIENT_SECRET=xxx

# Option 2: Gitee OAuth
RIN_GITEE_CLIENT_ID=xxx
RIN_GITEE_CLIENT_SECRET=xxx

# Option 3: Xinyue QQ Login
RIN_QQ_TOKEN=xxx

# Option 4: Email Verification Code Login
# After deploying Rin-Email to Vercel, configure these variables:
# - Vercel project env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_MAIL, EMAIL_PASS
# - Rin blog env vars:
EMAIL_RESEND_URL=https://your-rin-email.vercel.app/api/send
EMAIL_RESEND_PASS=your-email-pass

# Option 5: Username/Password Login
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure_password

# JWT Secret (required)
JWT_SECRET=random_secret_key

# S3 Credentials (required if using S3 storage)
S3_ACCESS_KEY_ID=xxx
S3_SECRET_ACCESS_KEY=xxx
```

---

## Minimal Deployment Checklist

### Username/Password Login Only (Minimal Config)

| Variable | Type | Required |
|----------|------|----------|
| `JWT_SECRET` | Secret | Yes |
| `ADMIN_USERNAME` | Secret | Yes |
| `ADMIN_PASSWORD` | Secret | Yes |
| `S3_FOLDER` | Variable | Yes |
| `S3_BUCKET` | Variable | Yes |
| `S3_REGION` | Variable | Yes |
| `S3_ENDPOINT` | Variable | Yes |
| `S3_ACCESS_KEY_ID` | Secret | Conditional |
| `S3_SECRET_ACCESS_KEY` | Secret | Conditional |

### Full Configuration (All Features)

Includes site config, all OAuth providers, email login, S3 storage, webhook, and RSS.

---

## FAQ

### Q: Do I need S3 config when using `CACHE_STORAGE_MODE=database`?

No. `database` mode stores cache in D1 database without S3/R2. However, S3 config is still required if you need image uploads.

### Q: Can I enable multiple login methods simultaneously?

Yes. Configure credentials for multiple methods and the frontend will display corresponding login buttons automatically.

### Q: How to set up email verification code login?

Email verification is handled by a Vercel-deployed Rin-Email project:

1. Deploy the `/tmp/opencode/Rin-Email` project to Vercel
2. Configure SMTP environment variables in the Vercel project (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_MAIL`, `EMAIL_PASS`)
3. In your Cloudflare Worker, configure:
   - `EMAIL_RESEND_URL` = Vercel project's `/api/send` URL
   - `EMAIL_RESEND_PASS` = same as `EMAIL_PASS` in the Vercel project

### Q: How to restrict allowed email domains in the Vercel project?

Configure `EMAIL_DOMAIN` in the Vercel project's environment variables:

```bash
# Allow only qq.com and example.com
EMAIL_DOMAIN=["qq.com","example.com"]
```

Leave empty to allow all domains.

### Q: Which SMTP providers does the Vercel project support?

The Vercel project uses `nodemailer` and supports any SMTP provider, including:
- 163 Mail: `smtp.163.com:465`
- QQ Mail: `smtp.qq.com:465`
- Gmail: `smtp.gmail.com:465`
- Any other SMTP service provider
