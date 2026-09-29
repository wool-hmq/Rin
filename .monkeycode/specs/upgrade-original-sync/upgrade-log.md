# 升级记录：同步 OpenRin/Rin @ 308a542

状态：已完成（2026-09-27）。所有批次提交至 main 并推送 GitHub wool-hmq/Rin。

## 批次与提交

| 批次 | 内容 | 提交 |
|------|------|------|
| AI 供应商 | Opencode→Kilo-code、Agnes-ai 模型更新、新增 baizhi-cloud、服务端空 key 恒发 Bearer | 4f2d49e、1a5bcde、fa1ae2b |
| 规格 | requirements.md + design.md | a0ba4a8 |
| B1 | ImageWithFallback + useApiResource + Spinner，接入 8 处（feed 2、moment_item、admin-layout、settings-items、image-upload-input、action-buttons 2、brand-link）；queue-status 重构；health/friends 整文件采用原版 | b2511cb |
| B2 | packages/ui Modal（react-modal）+ styles.css；friends 页同步 | 3374a10 |
| B3 | route-boundaries（adminOnly/userOnly/withJsonBody）+ 完整版 schema-validator；config.ts 内联 admin 检查替换为 adminOnly；error-response 补 isAppError 分支；修复 hono Env 类型遮蔽（app-types.ts、hono-app.ts） | cf47595 |
| B4 | SitemapService（sitemap.xml + 动态 robots.txt + sitemapCrontab）；fetch-handler 增 meta 路由；register-routes 挂载；FRONTEND_URL env + 中英文档；删除静态 client/public/robots.txt | f2b6ef7 |
| B5 | feed repository 层（DB 分页、LIKE 转义、admin 缓存隔离）+ feed.ts 三方合并（守卫 + schema 校验）；保留羊角版 AI 增强搜索；clear-feed-cache 拆出 clearFeedCollectionCaches；schemas.ts 加 minLength | 16eb9b7 |
| B6 | 0015/0016.sql（原版 0011/0012 重编号）；CLI fixTopField 改为迁移前执行（原版方案）；修复羊角版 0012.sql 反引号笔误 | 1e4049d |
| 收尾 | useTableOfContents 采用原版 useCallback 稳定化（修复 TOC 滚动位置测试） | d5f7167 |
| 部署回归修复 | syncWorkerSecrets 对 wrangler secret bulk 加版本传播竞态重试（Cloudflare code 10214） | 80b44a3 |
| 友链 sitemap | 新增 `/friends-sitemap.xml`（只含 accepted=1 友链，提取 url 的 to 参数； robots.txt 自动引用；cron 定时预生成） | f839b70 |

## 用户决策记录

1. 迁移重编号：原版 0011→0015、0012→0016（羊角版同号文件内容不同）。
2. robots.txt：删除静态文件，改用 sitemap 服务动态生成。
3. 搜索行为（B5 冲突点）：保持羊角版行为——仅标题匹配、unlisted 文章排除出公开搜索；同时吸收原版 DB 分页、LIKE 转义、admin 缓存隔离等性能改进（searchFeedPage 已按此调整）。原版 searchFeedPage 会把 unlisted 暴露给公开搜索，属上游疏漏，已规避。

## 验证结果

- `bun run check`：client / server / cli 全部 0 错误。
- client vitest：48/48 通过（含 image-with-fallback、use-api-resource、use-table-of-contents 新测试）。
- server bun test：366 通过；12 个失败为预存 rss/favicon S3 环境超时（升级前基线同样失败，与本次改动无关）。
- `bun run db:migrate`：migration_version=16，重复执行幂等（No migration needed）。
- client build：vite build 成功；wrangler deploy --dry-run 成功。

## 遗留事项

- GitHub Actions Deploy 曾因 Cloudflare 版本化部署竞态报 code 10214（wrangler deploy 后立即 secret bulk，新版本尚未成为当前已部署版本）；已通过 secret bulk 重试退避修复（80b44a3）。CI 用 bun 1.3.13 + wrangler，若再偶发需确认部署顺序或改用 script-level settings API。
- rss/favicon 测试超时为预存环境问题（S3 mock 不适用本沙箱），未在本项目范围内修复。
- 原版 server 若未来再升级，需检查 0016 之后的迁移号与羊角版 0015/0016 的衔接。
