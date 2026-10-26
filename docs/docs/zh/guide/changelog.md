# 更新日志

> **版本说明**：羊角快车二创版使用独立的 `yjvX.Y.Z` 版本线，从 **yjv1.0.0** 开始，与官方原版 openRin/Rin 的 `vX.Y.Z` 版本线区分。版本号按改动规模递增：`X` 用于超大更新（大量新功能或整体重构），`Y` 用于普通更新（新增 1-2 个功能或多个简单功能），`Z` 用于补丁（缺陷修复与小改动）。发布公告按版本线维护：同一版本线的补丁合并到该线页面，版本线推进后上一条线标记为稳定版，新的版本线标记为 Beta。当前最新版本为 **yjv1.1**（稳定版）。下文 `v0.3.0` / `v0.2.0` 为官方原版（上游）的历史记录。

## yjv1.1.2 2026-10-26

把 REST API 与 MCP 的密钥管理拆分为两类。

### 本次更新

- **密钥类型区分**：`api_keys` 表新增 `key_type` 列（1 = API 接口密钥，2 = MCP 密钥），设置页按「API 接口」与「MCP」两个标签页分别管理
- **端点隔离**：API 接口密钥只能调用 `/api/key/*`，MCP 密钥只能调用 `/mcp`，类型不匹配返回 `403`
- **权限边界**：`content.read` 仅对 MCP 密钥开放

### 文档

- API 指南补充密钥类型说明；迁移 `0021.sql` 自动为历史密钥归类

### 升级说明

- 迁移自动执行：含 `content.read` 的旧密钥转为 MCP 密钥，其余转为 API 接口密钥

## yjv1.1.1 2026-10-26

新增 MCP 服务端，并修复自定义域名访问被拒的问题。

### 本次更新

- **MCP 服务端**：新增 `/mcp` 端点，以 MCP 工具形式提供文章、动态、友链与站点设置的读写，API Key 鉴权，按 scope 裁剪工具并新增 `content.read`
- **域名白名单**：Host 与 Origin 校验阻断 DNS rebinding，自定义域名通过 `MCP_ALLOWED_HOSTS` 放行，支持协议/端口写法、通配域名与 `*`

### 修复

- 部署命令补齐 `FRONTEND_URL` 与 `MCP_ALLOWED_HOSTS`，域名被拒绝时响应体给出配置提示
- 域名校验提前到鉴权之前，被拒域名返回 403 与 `Invalid Host`

### 文档

- 新增 [yjv1.1 发布公告](../blog/yjv1.1-release)，API 指南补充自定义域名排查（421 / 403 区分）

### 升级说明

- 自定义域名站点需配置 `MCP_ALLOWED_HOSTS` 或 `FRONTEND_URL` 后重新部署；本版本无数据库迁移

## yjv1.1.0 2026-10-24

二创版独立版本线上的首个功能版本，收录友链验证双方式等近期能力，并同步维护中英文文档。

### 本次更新

- **友链验证支持 DNS TXT 与 HTML 文件两种方式**
  - JSON 解析完成后进入 `awaiting_method_choice` 阶段，由访客选择验证方式：回复 `1`（或 `一` / `方案一` / `方法一`）使用 DNS TXT 记录，回复 `2`（或 `二` / `方案二` / `方法二`）上传 HTML 文件
  - DNS 方式：向访客下发 `_jiaofriend` 主机记录、TXT 类型、验证码为记录值的教程；验证时通过 Cloudflare DNS-over-HTTPS 查询 `_jiaofriend.访客域名` 的 TXT 记录并检查是否包含验证码
  - 文件方式：保留原有严格校验，GET 必须返回 200 且剔除标签/脚本后的 `<body>` 文本包含验证码
  - 状态机新增 `awaiting_verification` 阶段并记录 `verifyMethod`；修改友链时旧站点与新站点分别重新选择验证方式；升级前的 `verifying` 状态自动回退到文件验证
  - DNS 查询通过可注入依赖 `resolveTxt(name) => Promise<string[]>` 实现，便于测试与替换解析器

### 修复

- 修复友链验证被 SPA 回退、自定义 404 页面、403/500 与 30x 重定向误判通过
- 修复 `awaiting_json` 阶段把非 JSON 正文误判为格式错误并终止申请
- 修复 `friends-sitemap.xml` 路由被前端 SPA 拦截
- 修复点击查看密钥会把加密存储改成明文存储
- 修复验证码图片重复初始化导致申请崩溃
- 修复邮件解析在 CJS / ESM 产物下的兼容性

### 文档

- 部署指南按当前实现重写：仓库选择顺序、站点变量、工作流清单、迁移脚本路径与部署地址说明
- 文档目录重构：`env.md`、`database.md` 迁入 `configuration/`
- 新增 [yjv1.0.0 发布公告](../blog/yjv1.0.0-release)，博客导航中二创版条目排在官方原版之前
- 数据库文档补充 `users.password` 的哈希规则：SHA-256（无盐），手动修改 D1 中的密码时必须写入哈希值
- 文档中同时出现两个仓库时，统一先列 **羊角快车二创版（本仓库）** 并标注 **官方原版 openRin/Rin（上游）**
- 中英文文档同步更新

### 升级说明

- 友链验证方式的选择对已有友链无影响：升级前的 `verifying` 状态自动回退为 HTML 文件验证
- 其余功能无需额外环境变量

## yjv1.0.0 2026-10-24

羊角快车二创版独立版本线的起点。本版本承接官方原版 openRin/Rin `v0.3.0` 的能力，并叠加二创版本已落地的功能与基础设施。

### 新增功能

- **邮件自助友链**：访客通过邮件完成友链申请 / 修改 / 删除，包含 JSON 模板、人机验证码图片、申请取消指令、回复拦截与新建邮件引导、按邮箱绑定归属 UID
- **友链分组与排序**：后台管理友链分组与展示顺序
- **TOTP 双因素认证**：全体用户可用，支持恢复码与登录限流
- **API Key 外部调用体系**：管理员在后台设置页创建、吊销密钥并限定权限范围
- **friends-sitemap.xml**：输出已通过审核的友链，包含名称与描述
- **MailPort 多发件地址**：支持多个发件端点顺序轮询，并兼容旧配置
- **AI 能力**：AI 摘要、AI 增强搜索、自定义模型与回退模型队列排序
- **内容与阅读体验**：多套评论系统、Webhook 通知、RSS、Sitemap 与动态 robots.txt、友链可访问状态定时检查

### 修复

- 修复无密码账号启用 TOTP 后无法登录
- 修复 API Key 接口 404 文案重复拼接、权限范围列表为空
- 修复部署时批量上传 Secret 的 10214 竞态失败

### 架构与部署

- 后端运行时迁移到面向 Cloudflare Workers 的轻量框架，路由与依赖按需加载
- 抽出 `@rin/api`、`@rin/ui` 等共享包，前后端共享类型与组件
- 部署、开发、数据库任务统一收敛到 Rin CLI，并提供 GitHub Actions 的 Build / Deploy / Preview / Release / 文档站工作流
- 同步官方原版改进：feed service 的 repository 分层、路由守卫、sitemap 服务、Modal 组件、图片回退组件与目录树稳定化

### 文档

- 文档体系随仓库维护，中英文内容保持同步
- 文档中同时出现两个仓库时，统一先列 **羊角快车二创版（本仓库）** 并标注 **官方原版 openRin/Rin（上游）**

### 升级说明

- 从官方原版升级到二创版时，部署脚本会自动执行 `server/sql/` 下的迁移脚本，无需手动操作
- 邮件登录、邮箱验证码与邮件自助友链属于可选功能，需要额外配置 `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS`（见 [环境变量说明](../configuration/env)）
- TOTP、API Key、友链分组等功能无需额外环境变量，在后台页面按需启用即可

## 官方原版历史版本

### v0.3.0 2025-02-04 更新

#### 架构重构

- **轻量级框架**：将 ElysiaJS 后端框架重构为轻量级自定义框架，专门针对 Cloudflare Workers 优化
  - 移除了约 15 个重量级依赖，核心框架代码 < 10KB
  - 实现了按需加载架构，每个请求只初始化必要的服务
  - 优化的启动时间和内存占用

#### 新增功能

- **缓存系统**：实现了支持数据库和 S3 的灵活缓存系统
  - 新增 `CACHE_STORAGE_MODE` 环境变量，支持 `database` 或 `s3` 模式
  - 支持缓存数据的自动序列化和反序列化
  - 新增缓存表用于高频数据存储

- **HyperLogLog 统计**：PV/UV 统计迁移到 HyperLogLog 算法
  - 使用 16384 个寄存器，误差率约 0.81%
  - 新增 `visit_stats` 表，包含 pv 计数器和 hll_data
  - 文章统计查询从 O(n) 优化到 O(1)
  - 大幅减少了高流量文章的查询时间

- **错误处理系统**：实现全面的错误处理机制
  - 新增结构化错误类（ValidationError, NotFoundError 等）
  - 实现 `GlobalErrorBoundary` 捕获 React 渲染错误
  - 新增 `useError` hooks 处理异步操作和 API 调用
  - 服务器端中间件记录错误并生成请求 ID

- **Cookie 认证**：从 Authorization Header 迁移到 Cookie-based 认证
  - 后端设置 HttpOnly、Secure、SameSite=lax 的 Cookie
  - 前端移除 Authorization Header，依赖浏览器 Cookie
  - 增强 CSRF 防护

#### 改进和优化

- **API 客户端重构**：用自定义 API 客户端替换 Elysia/Eden
  - 移除 @elysiajs/eden 和 rin-server 依赖
  - 创建类型安全的 API 客户端
  - 简化 API 调用方式（从 treaty 模式改为直接方法调用）
  - **破坏性变更**：客户端 API 接口变更，例如 `client.feed.index.get()` → `client.feed.list()`

- **OAuth 自定义实现**：用自定义 OAuth2 实现替换 elysia-oauth2
  - 通用 OAuth2 插件架构，支持任何 OAuth2 提供商
  - 内置 GitHub OAuth 提供商作为默认
  - 通过 state 参数验证提供 CSRF 保护
  - TypeScript 全类型支持

- **依赖注入重构**：用原生机制替换 typedi
  - 移除 typedi 依赖注入容器
  - 使用 Elysia 的 decorate() 和 derive() 进行依赖注入
  - 服务通过 store 访问依赖而非 Container.get()

- **友链系统优化**：更新 Friend 接口并调整相关 API 调用
  - 改进类型安全性

#### 修复

- 修复 uv 迁移到 hll 失败的问题
- 修复 GitHub 回调路由的 schema 验证问题
- 修复查询参数整数解析问题
- 修复 CORS 预检请求处理问题
- 优化代码并精简体积

#### 数据库迁移

- 新增缓存表 `cache`（key, type, data, created_at, updated_at）
- 新增访问统计表 `visit_stats`（feed_id, pv, hll_data）
- 数据库迁移脚本：`0006.sql`

#### 环境变量

新增环境变量：
```ini
CACHE_STORAGE_MODE=<缓存存储模式：database 或 s3，默认 database>
```

### v0.2.0 2024-06-07 更新

- 新增 `S3_CACHE_FOLDER` 环境变量
- 环境变量加密列表与变量列表更新，仅保留必须加密的环境变量
- 加密变量现在可以通过 GitHub 直接配置
- GitHub 变量配置更新，新增必须通过 GitHub 配置的加密变量（S3 存储，用于 SEO 索引保存）
- `GITHUB_CLIENT_ID`与`GITHUB_CLIENT_SECRET`现在添加了前缀`RIN_`（`RIN_GITHUB_CLIENT_ID`,`RIN_GITHUB_CLIENT_SECRET`），以解决 GitHub 变量不能以 `GITHUB_` 开头的问题，使用 Cloudflare 面板配置的 `GITHUB_CLIENT_ID` 与 `GITHUB_CLIENT_SECRET` 不受影响

## 官方原版迁移指南

无特别说明时正常的版本更新直接同步 fork 的仓库即可

### v0.2.0 迁移指南


```ini
SEO_BASE_URL=<SEO 基础地址，用于 SEO 索引>
SEO_CONTAINS_KEY=<SEO 索引时只索引以 SEO_BASE_URL 开头或包含SEO_CONTAINS_KEY 关键字的链接，默认为空>
S3_FOLDER=<S3 图片资源存储的文件夹，默认为 'images/'>
S3_CACHE_FOLDER=<S3 缓存文件夹（用于 SEO、高频请求缓存），默认为 'cache/'>
S3_BUCKET=<S3 存储桶名称>
S3_REGION=<S3 存储桶所在区域，如使用 Cloudflare R2 填写 auto 即可>
S3_ENDPOINT=<S3 存储桶接入点地址>
S3_ACCESS_HOST=<S3 存储桶访问地址，末尾无'/'>
```

同时添加以下加密环境变量（加密，添加到 Secrets）：

```ini
S3_ACCESS_KEY_ID=<你的S3AccessKeyID>
S3_SECRET_ACCESS_KEY=<你的S3SecretAccessKey>
```

以上环境变量在之前的版本中是通过 Cloudflare 面板配置的，现在需要迁移到 GitHub 中配置，新版本的部署 GitHub Action 会自动其上传到 Cloudflare，之后就不再需要在 Cloudflare 面板中配置这些环境变量了
