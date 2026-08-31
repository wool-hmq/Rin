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
