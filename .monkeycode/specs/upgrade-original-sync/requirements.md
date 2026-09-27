# Requirements Document

## Introduction

羊角快车版 Rin（wool-hmq/Rin）在原版 OpenRin/Rin 分叉后持续独立演进，新增了邮箱登录、账号绑定、R2 管理、AI 增强搜索、多套评论系统等自有功能。与此同时，原版也演进了一批新能力。本需求将原版 `308a542`（2026-08-31）中的新功能吸收进羊角快车版，同时完整保留羊角快车版全部自有功能。升级过程中凡遇文件冲突或不确定事项，须先询问用户确认后再改动；无冲突事项由代理独立完成。

## Glossary

- **羊角快车版**：当前工作区仓库（wool-hmq/Rin），含 0013/0014 迁移与全部自有功能。
- **原版**：OpenRin/Rin `308a542` 快照（/tmp/Rin-original）。
- **冲突**：同一文件被羊角快车版与原版各自修改，直接覆盖任一方都会丢失另一方的功能。
- **低风险新文件**：羊角快车版不存在、且不与任何羊角快车版自有文件耦合的原版新增文件。
- **接入文件**：原版为使用新功能而修改、且羊角快车版也修改过的既有文件（冲突高发区）。
- **迁移版本号**：D1 `info` 表 `migration_version` 键，当前羊角快车版为 14。
- **图片回退组件**：原版新增 `client/src/components/image-with-fallback.tsx`，图片加载失败时展示占位。
- **路由边界**：原版新增 `server/src/core/route-boundaries.ts`，提供 adminOnly/userOnly/withJsonBody 声明式路由守卫。
- **sitemap 服务**：原版新增 `server/src/services/sitemap.ts`，动态生成 sitemap.xml 与 robots.txt，含 cron 定时刷新。
- **feed 仓库层**：原版将 feed 数据访问抽离为 `server/src/features/feed/repository.ts`。

## Requirements

### Requirement 1: 图片回退组件（image-with-fallback）

**User Story:** AS 站长, I want 图片加载失败时展示占位图, SO THAT 页面不出现碎图影响观感。

#### Acceptance Criteria

1. WHEN 羊角快车版引入原版图片回退组件文件，系统 SHALL 保持组件源码与原版一致（仅调整导入路径）。
2. WHEN 在某页面/组件接入图片回退组件，系统 SHALL 同步接入该组件对应的原版测试文件并通过。
3. IF 接入文件的改动与羊角快车版本地改动冲突，代理 SHALL 先向用户展示双方差异并等待决策，再执行合并。

### Requirement 2: 通用资源加载 Hook（use-api-resource）

**User Story:** AS 开发者, I want 复用统一的 API 资源加载 Hook, SO THAT queue-status 与 health 页面减少重复的状态管理代码。

#### Acceptance Criteria

1. WHEN 引入 use-api-resource Hook，系统 SHALL 同步引入其测试文件并通过。
2. WHEN queue-status 与 health 页面改造为使用该 Hook，系统 SHALL 保持页面现有行为与展示不变。
3. IF 页面改造引入行为差异，代理 SHALL 询问用户是否接受差异后再继续。

### Requirement 3: UI 包 Modal 与样式导出

**User Story:** AS 开发者, I want packages/ui 提供标准 Modal 组件, SO THAT 弹窗交互不再依赖散落各处的临时实现。

#### Acceptance Criteria

1. WHEN 引入原版 Modal，系统 SHALL 在 packages/ui 中新增 `src/modal.tsx` 与 `src/styles.css`，并在 `package.json` 声明 `react-modal` 依赖与 `./styles.css` 导出。
2. WHEN friends 页面使用原版 Modal，系统 SHALL 保持羊角快车版 friends 页面既有本地功能不丢失。
3. IF Modal 依赖版本与工作区锁文件冲突，代理 SHALL 运行安装并验证锁文件更新后提交。

### Requirement 4: 服务端路由边界（route-boundaries）

**User Story:** AS 后端, I want 用声明式守卫收敛权限校验逻辑, SO THAT feed 与 config 路由的鉴权行为一致且可测试。

#### Acceptance Criteria

1. WHEN 引入 route-boundaries 模块，系统 SHALL 同步引入 `error-response.test.ts` 与 `route-boundaries.test.ts` 并通过。
2. WHEN feed.ts 与 config.ts 改用路由边界守卫，系统 SHALL 保留羊角快车版在这两个文件中的自有改动（如 test-ai 端点、AI 搜索等）。
3. IF 守卫改造导致任一现有测试失败，代理 SHALL 修复后重跑全部服务端测试并向用户报告结果。

### Requirement 5: sitemap 服务

**User Story:** AS 站长, I want 后端动态生成 sitemap.xml 与 robots.txt, SO THAT 搜索引擎及时收录最新文章。

#### Acceptance Criteria

1. WHEN 引入 sitemap 服务，系统 SHALL 新增 `server/src/services/sitemap.ts` 及其测试，并在 register-routes、fetch-handler、scheduled-handler 完成挂载。
2. WHEN Worker 收到 `/sitemap.xml` 或 `/robots.txt` 请求，系统 SHALL 在静态资源分支之前路由到 sitemap 服务。
3. WHEN 到达 sitemap cron 触发时间，系统 SHALL 刷新存储中的 sitemap 快照。
4. WHILE 未配置站点公开地址，系统 SHALL 以请求来源 origin 作为 sitemap/robots 的基准地址。
5. IF 羊角快车版既有静态 `client/public/robots.txt` 与动态 robots 路由冲突，代理 SHALL 向用户展示两种方案并等待决策。
6. IF 引入 sitemap 需要新增环境变量（如 FRONTEND_URL），代理 SHALL 同步更新 env 中英文文档并遵循文档同步约定。

### Requirement 6: feed 仓库层与 markdown 工具

**User Story:** AS 后端, I want feed 数据访问拆分为仓库层并提供 stripMarkdown 工具, SO THAT 服务层职责单一且摘要逻辑可测试。

#### Acceptance Criteria

1. WHEN 引入 feed 仓库层，系统 SHALL 新增 `server/src/features/feed/repository.ts`，并使 services/feed.ts 通过仓库层访问数据。
2. WHEN 引入 `server/src/utils/markdown.ts`，系统 SHALL 同步引入其测试并通过。
3. WHEN 合并 services/feed.ts，系统 SHALL 保留羊角快车版自有改动（AI 增强搜索端点、可见性逻辑等）。
4. IF 仓库层拆分与羊角快车版本地改动无法机械合并，代理 SHALL 向用户展示合并方案差异点后再执行。

### Requirement 7: 数据库迁移对齐

**User Story:** AS 站长, I want 原版新增的索引与 feeds.top 修复进入羊角快车版数据库, SO THAT 查询性能与数据完整性与原版对齐。

#### Acceptance Criteria

1. IF 原版迁移文件序号与羊角快车版既有迁移序号相同（0011/0012），系统 SHALL 将原版迁移内容重新编号为羊角快车版 `migration_version=14` 之后的下一个序号（0015 起）再引入。
2. WHEN 重新编号迁移，系统 SHALL 将其中 `UPDATE info SET value='12'` 语句改为目标序号值。
3. WHEN 迁移引入完成，系统 SHALL 在本地 D1 执行迁移并验证 `migration_version` 达到目标值。
4. IF CLI 迁移预检逻辑（feeds-top migration）与羊角快车版 CLI 本地改动冲突，代理 SHALL 先询问用户决策。

### Requirement 8: 升级过程约束

**User Story:** AS 羊角快车版维护者, I want 升级过程可控可回溯, SO THAT 自有功能在升级后完整保留。

#### Acceptance Criteria

1. WHEN 执行任一存在冲突的合并，代理 SHALL 在改动前向用户展示冲突内容与候选方案。
2. WHEN 用户未确认冲突方案，代理 SHALL 保持该文件现状，并在升级报告中标记为「待决策」。
3. WHEN 升级完成后，代理 SHALL 运行客户端与服务端全部测试并报告通过情况。
4. WHEN 升级完成，代理 SHALL 生成升级记录文档（含每个文件的处理方式：新增/合并/保留/跳过）。
5. WHILE 升级进行中，代理 SHALL 保持每完成一个独立功能单元即提交一次，便于按提交粒度回退。
