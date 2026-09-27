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
- Date: 2026-09-27
- Context: 用户恢复旧开发环境（克隆参考仓库）时说明的身份信息
- Category: Workflow & Collaboration
- Instructions:
  - 用户 GitHub 账号之一为 wool-hmq；网名主要使用「羊角快车」，部分特殊场景使用其它网名。
  - 本仓库（羊角快车版二创 Rin）与上游参考仓库的关系：/tmp/Rin-cunzhang（村长版二创，思路参考）、/tmp/Rin-original（原版 OpenRin/Rin，升级对比用）。
  - 上游仓库出现的其他贡献者（如 MarshaveYang）与用户无关。
  - 用户暂时没有将二创合入上游仓库的想法。

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

[Project Knowledge Summary]
- Date: 2026-09-27
- Context: 升级同步原版 OpenRin/Rin @ 308a542 完成（B1-B6 全批次），发现以下关键约束
- Category: Workflow & Collaboration | Environment Configuration
- Instructions:
  - 客户端测试统一 vitest 风格（vitest.config.ts + client/src/test/setup.ts，jsdom 环境）；从原版移植的 bun:test 客户端测试必须转换：bun:test→vitest、mock()→vi.fn()、mock.module()→vi.mock()，并显式 import "@testing-library/jest-dom"。
  - server/sql 迁移号：羊角版 0011-0014 为自有迁移（0011 用户名去重、0012 users.email、0013 linked_accounts、0014 cache.expires_at），0015/0016 已占用（原版 0011/0012 重编号）。未来同步原版迁移需从 0017 起顺延，且 SQL 末尾 UPDATE info 的 version 值必须同步改为重编号后的数字。
  - 搜索行为约束（用户决策）：SearchService 仅匹配标题、unlisted 文章必须排除出公开搜索（searchFeedPage 的 public where 需含 draft=0 AND listed=1）；原版 searchFeedPage 会泄露 unlisted，勿直接照搬。
  - CLI fixTopField 必须在 SQL 迁移执行之前调用（0015/0016 建含 feeds.top 的索引，top 缺失的旧库先迁移会失败）。
  - 预存测试失败基线：server 端 rss.test.ts（9）/favicon.test.ts（3）因 S3 环境超时失败，与代码改动无关，全量测试判读时以 366 pass / 12 fail 为基线。
