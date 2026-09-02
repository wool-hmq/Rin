# User Instruction Memory

This file records user instructions, preferences, and teachings for reference in future interactions.

## Format

### User Instruction Entry
User instruction entries should follow this format:

[User Instruction Summary]
- Date: [YYYY-MM-DD]
- Context: [Mentioned scenario or time]
- Instructions:
  - [Content of user teaching or instruction, described line by line]

### Project Knowledge Entry
Entries discovered by the Agent during task execution should follow this format:

[Project Knowledge Summary]
- Date: [YYYY-MM-DD]
- Context: Discovered by Agent while performing [specific task description]
- Category: [Operations & Deployment|Build Methods|Testing Methods|Troubleshooting & Debugging|Workflow & Collaboration|Environment Configuration]
- Instructions:
  - [Specific knowledge points, described line by line]

## Deduplication Strategy
- Before adding a new entry, check for similar or identical instructions.
- If a duplicate is found, skip the new entry or merge it with the existing one.
- When merging, update the context or date information.
- This helps avoid redundant entries and keeps the memory file tidy.

## Entries

[User Instruction Summary]
- Date: 2026-08-15
- Context: 完成左侧挂件功能并推送 GitHub main 后，用户明确提出的默认行为约定
- Instructions:
  - 默认情况下，每次代码修改完成后自动提交并推送到 GitHub main 分支。
  - 例外情况（不做默认推送，需与用户确认）：代码中有不确定之处（如 ad 广告栏这类需求模糊的代码）、用户刻意要求不推送时。

[Project Knowledge Summary]
- Date: 2026-08-17
- Context: Discovered by Agent while troubleshooting Gitee OAuth login error and Cloudflare secrets propagation
- Category: Operations & Deployment
- Instructions:
  - 站点 OAuth 相关 secrets（RIN_GITHUB_CLIENT_ID/SECRET、RIN_GITEE_CLIENT_ID/SECRET、JWT_SECRET、ADMIN_*、S3_*）统一在 GitHub Actions Repository secrets 中配置，不要放在 Environment secrets 下（deploy job 引用 production/preview environment 时 repository secrets 仍可用）。
  - 首次部署后 Worker 上手动配置的 secret 会被后续 wrangler secret bulk 用 GitHub 侧 secret 值同步覆盖，手动配置只是临时兜底。
  - Gitee OAuth 登录报"服务器不支持这种 response type"的根因是 authorize URL 缺 response_type=code；此参数已写入 server/src/utils/oauth.ts 的 createRedirectUrl。

[Project Knowledge Summary]
- Date: 2026-09-02
- Context: Cloudflare Workers 不支持原始 TCP SMTP，实现 Vercel 邮件中继架构
- Category: Operations & Deployment
- Instructions:
  - 邮箱验证码登录不再使用 Cloudflare Workers 直接发 SMTP，改为调用 Vercel 部署的 Rin-Email 项目（HTTP API 中转）。
  - Rin 博客环境变量：保留 `EMAIL_RESEND_URL`（Vercel 项目 URL，Variable），`EMAIL_RESEND_PASS`（认证密码，Secret）。
  - 移除 `SMTP_MAIL`/`SMTP_USER`/`SMTP_PASS`/`SMTP_HOST`/`EMAIL_DOMAIN` 环境变量；域名限制改在 Vercel 项目的 `EMAIL_DOMAIN` 中配置。
  - Vercel 项目 `/tmp/opencode/Rin-Email` 使用 `nodemailer` 支持任何 SMTP 服务商（163/QQ/Gmail 等）。
  - deploy-cf.ts、deploy.yml、worker-configuration.d.ts、auth.ts、auth.test.ts 及中英文 env.md 文档已同步更新。

[User Instruction Summary]
- Date: 2026-09-02
- Context: 用户要求建立文档同步习惯
- Instructions:
  - 修改环境变量配置（新增/删除/重命名 env var、修改默认值、修改必填性）后，必须同步更新 docs/docs/zh/env.md 和 docs/docs/en/env.md。
  - 修改数据库字段含义（新增/删除/重命名字段、修改字段类型/约束/默认值）后，必须同步更新 docs/docs/zh/database.md 和 docs/docs/en/database.md。
  - 以上文档修改应与代码修改在同一 commit 中完成，确保代码与文档始终一致。
