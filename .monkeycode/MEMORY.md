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
  - 本仓库（羊角快车版二创 Rin）与上游参考仓库的关系：/tmp/Rin-cunzhang（村长版二创 cunzhangcrypto/Rin，思路参考）、/tmp/Rin-original（原版 OpenRin/Rin，升级对比用）。
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
  - 修改环境变量配置（新增/删除/重命名 env var、修改默认值、修改必填性）后，必须同步更新 docs/docs/zh/configuration/env.md 和 docs/docs/en/configuration/env.md。
  - 修改数据库字段含义（新增/删除/重命名字段、修改字段类型/约束/默认值）后，必须同步更新 docs/docs/zh/configuration/database.md 和 docs/docs/en/configuration/database.md。
  - 以上文档修改应与代码修改在同一 commit 中完成，确保代码与文档始终一致。
  - 2026-10-31 起文档语言扩展为四种：docs/docs/{zh（默认，根路径）,zh-TW,en,ja}，新增页面时四个语言目录都要同步创建（含 _meta.json/_nav.json）；mailport 仓库对应为 {zh-cn（默认）,zh-TW,en,ja}。

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

[User Instruction Summary]
- Date: 2026-10-24
- Context: 用户要求开始维护更新日志并统一二创版/官方原版的文档标注方式
- Instructions:
  - 从 2026-10-24 起维护更新日志，文档写入 docs/docs/zh/guide/changelog.md 与 docs/docs/en/guide/changelog.md，中英文内容保持同步。
  - 本项目使用标准语义化版本，版本线从 v1.0.0 开始，发布标签为 vX.Y.Z；官方原版继续使用 vX.Y.Z，两者分开记录，同一条目同时出现两个仓库的版本时本项目写作 yjvX.Y.Z 以示区分。
  - 文档中同时出现两个仓库时，羊角快车二创版（wool-hmq/Rin）排在前面并标注身份，官方原版（openRin/Rin）排在后面并标注为官方原版/上游。
  - README.md 保持纯英文，README_zh_CN.md 使用中文，两者分别维护。
  - 部署、迁移、发布等说明文档需与仓库实际状态保持一致（工作流清单、CLI 默认值、环境变量名等），过时内容需同步修正。
  - 网络不可用期间的协作方式：改动完成后输出涉及的文件路径清单，由用户在 GitHub 网页版逐个上传；用户提供仓库 zip 快照时，用解压内容覆盖工作区对应目录（保留 `.git`、`node_modules` 等本地目录），随后再恢复常规推送流程。

[Project Knowledge Summary]
- Date: 2026-10-24
- Context: 提交文档后 GitHub 推送持续失败时的排查过程
- Category: Troubleshooting & Debugging | Workflow & Collaboration
- Instructions:
  - 该执行环境到 github.com 的 HTTPS 出口可能被临时中断：TCP 443 可连但 TLS 握手被切断，git 报 `gnutls_handshake() failed`；github.com:22 与 ssh.github.com:443 的 SSH 握手同样被中断，curl 访问 npmjs 等境外域名也失败（baidu 等国内站点正常）。属于网络侧问题，与凭据无关。
  - 凭据由 `/app/agent/bin/agent git-credential-helper` 提供（仓库 `.git/config` 中已配置），无需手动填写账号密码；该 helper 不区分邮箱，git 推送认证与提交邮箱无关。
  - 处理方式：短间隔重试 `git push` / `git fetch`；长时间不通时改用 GitHub 网页版直接编辑提交，之后本地执行 `git fetch origin && git reset --hard origin/main` 覆盖本地，再恢复常规推送。
  - 文档站构建验证命令：`cd docs && bun install && bun run build`（Rspress v2，产物在 docs/doc_build，已被 gitignore）；中英文文档改动后必须重新构建确认无死链。

[Project Knowledge Summary]
- Date: 2026-10-25（2026-10-31 补充多语言规则）
- Context: 为 MailPort/Rin 文档站接入多语言时验证出的 Rspress v2 路由、导航与锚点规则
- Category: Build Methods | Troubleshooting & Debugging
- Instructions:
  - Rspress v2 中 `lang`（默认语言）对应目录的内容输出到站点根路径，其余语言保留语言前缀（MailPort：zh-cn 在 `/`、en 在 `/en/`；Rin：zh 在 `/`、zh-TW/en/ja 带前缀）。
  - 语言目录根部 `_nav.json` 声明顶部导航栏，其链接会被自动加 locale 前缀，因此只写站点内路径（如 `/guide/deploy`），写死 `/en/...` 会产生 `/en/en/...` 双前缀 404。
  - 首页 hero action 链接不会被自动加前缀，非默认语言首页必须显式写 `/ja/guide/`、`/zh-TW/guide/` 这样的带前缀链接。
  - 根部 `_meta.json` 条目必须用 v2 对象格式（`{"type": "file", "name": "api.md", "label": "..."}`），带 `text` 键的旧格式会触发迁移校验并终止构建。
  - Rspress 内置界面文案只含 en/zh；zh-cn/zh-TW 需在 `i18nSource` 补齐，否则回退英文并产生构建警告。
  - `base` 会自动加到首页动作链接等绝对路径前，链接写站点内路径即可。
  - 标题锚点由 github-slugger 生成：序号后的 `.` `、` 被删除且不留空格，如 "6. General troubleshooting"→`#6-general-troubleshooting`、"六、通用排错"→`#六通用排错`；跨页锚点链接必须与目标语言标题逐字一致。

[User Instruction Summary]
- Date: 2026-10-25
- Context: 用户休息期间交代 MCP 服务端需求，明确要求不要提问、自主完成全部任务
- Instructions:
  - 用户明确表示要休息并要求「不要提问」，遇到需求模糊点由 Agent 自主决策并完整落地实现、测试、文档与提交推送。
  - 在该场景下禁止中途抛出问题或等待确认；方案取舍以现有项目约定与代码事实为依据，完成后一次性汇报结果与关键决策。

[Project Knowledge Summary]
- Date: 2026-10-25
- Context: 验证 MCP 服务端线上部署与本地 workerd 运行时行为时确认的环境限制
- Category: Operations & Deployment | Troubleshooting & Debugging
- Instructions:
  - 生产 Worker 地址为 `rin-server.<账号>.workers.dev`（可从 GitHub deployments API 的 `environment_url` 取到），本沙箱访问 `*.workers.dev` 会被 DNS 污染成 Meta 网段地址，TLS 握手失败，无法直连线上 Worker 验证。
  - 线上功能验证改用本地 `bunx wrangler dev`（workerd 运行时）：先 `bun run build:client` 生成 `dist/client` 供 assets 绑定，再按 `server/sql/*.sql` 逐个 `bunx wrangler d1 execute rin --local --file ...` 建本地库。
  - `wrangler d1 execute --local` 不会建 `users` 行，插入 `api_keys` 前需先插入 `users(id=1, ...)`，否则触发外键约束失败。
  - 本地冒烟端口需避开已被占用的 11499/11498，沙箱内占用端口的服务会统一返回 `{"id":"upstream-msg-001"}`，容易误判为应用返回。
  - CI `coverage` 作业通过根 `test:coverage` 依次运行客户端 vitest 覆盖率与服务端 bun 覆盖率；根目录 `bun test` 会把客户端 vitest 用例交给 bun 执行并因缺少 DOM 报错，根 `test` 脚本已改为按工作区分组执行。
  - 客户端覆盖率依赖与 vitest 同版本的 `@vitest/coverage-v8`，报告输出到 `client/coverage/lcov.info`；服务端必须在脚本里显式传 `--coverage-reporter=lcov`（Bun 不读取 `server/bunfig.json`），报告输出到 `server/coverage/lcov.info`。
  - Bun 的 `bun test <参数>` 把参数当路径子串过滤，`cli` 会误匹配 `client/**`，需要写成 `cli/src` 这类精确路径。


[User Instruction Summary]
- Date: 2026-10-26（2026-10-27 修订版本编号规则）
- Context: 用户确定二创版版本号递增规则，并要求据此发布改动
- Instructions:
  - 版本线使用标准语义化版本，从 v1.0.0 开始：MAJOR 用于不兼容变更，MINOR 用于向后兼容的新功能，PATCH 用于缺陷修复与小改动；版本号直接递增，不自创预发布标识，特殊标识用 -beta、-rc.1 等后缀。
  - 发布标签为 vX.Y.Z；同一条目同时涉及官方原版版本与本项目版本时，本项目版本写作 yjvX.Y.Z 以示区分。
  - 发布时同步更新 `docs/docs/{zh,en}/guide/changelog.md` 顶部最新版本说明、`CHANGELOG.md`、`docs/docs/{zh,en}/blog/` 发布公告与 `_nav.json` 博客导航。
  - 更新日志每次发布都要写，条目保持简短（一行式），详细说明放在 blog 发布公告中。
  - 发布公告按需要维护：改动较大或需要重点说明时新建或更新公告页，同一版本线的多次发布可合并到同一页；页面不再使用 Stable / Beta 标签，预发布由版本号后缀表达。
  - 数据库结构变更以 `server/sql/NNNN.sql` 递增编号追加，并在文件末尾更新 `info.migration_version`。

[Project Knowledge Summary]
- Date: 2026-10-31
- Context: 为文档站新增 zh-TW/ja 语言时确认的翻译与协议约束
- Category: Workflow & Collaboration
- Instructions:
  - Rin 邮件自助友链的邮件指令字面量固定为简体（`友链申请`/`友链修改`/`友链删除`/`结束本次友链申请`/`请你进行下一步验证`，见 server/src/services/friend-email.ts），zh-TW/ja 文档中这些指令必须保留简体原文，其余说明文字正常翻译。
  - zh-TW 以 zh/zh-cn 为基准做简繁转换 + 台湾用语润色（工具 /tmp/opencode/tools/s2tw.py，opencc s2twp + 术语覆写）；ja 以 en 为基准人工翻译。
  - 翻译保留代码块、行内代码、URL、表格结构与 `:::tip/:::warning` 容器语法；新语言复用 en 版 logo，不新增图片。

[Project Knowledge Summary]
- Date: 2026-10-31
- Context: 本地复现 CI flaky 测试时确认的 bun 环境配置
- Category: Environment Configuration | Troubleshooting & Debugging
- Instructions:
  - 沙箱内无预装 bun 且 bun.sh/npm 源不可达；CI 锁定 bun 1.3.13。本地复现 server 测试用 /root/.bun/bin/bun（1.3.13，用户从镜像下载提供）。
  - bun test 单文件跑通过但 CI 失败时，先怀疑概率性 bug 与并行文件时序，再查 mock.module 跨文件污染；直接用 `gh run view <run-id> --log-failed` 拉断言详情最快。
