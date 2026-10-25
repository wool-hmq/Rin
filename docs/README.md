# 羊角快车二创版 Rin 文档

> **二次开发声明**
> 本文档基于 [openRin/Rin](https://github.com/openRin/Rin) 的官方文档修改而来。原项目版权归 Xeu 及贡献者所有。  
> 本仓库文档由 [羊角快车](https://github.com/wool-hmq) 维护，可能会包含与本版代码对应的新增或修改内容。

## 阅读说明

本项目已启用在线文档站点，推荐直接访问在线文档阅读：

> **在线文档地址：https://rin.lab.j3.ink**

文档源文件仍以 Markdown / MDX 格式存放在 `docs/docs` 目录中。你也可以在 GitHub 仓库中直接点击对应的 `.md` 或 `.mdx` 文件查看原始内容。

*(注：本项目基于原版项目的 [Rspress](https://rspress.dev/) 构建配置启用了文档站，相关配置如 `package.json` 和 `rspress.config.ts` 仍然保留。如需本地预览或自行构建，可参考下方的构建命令。)*

## 本地构建（可选）

如果你需要在本地预览或构建文档网页，可以执行以下命令：

```bash
# 进入文档目录（如果在根目录请先 cd docs）
cd docs

# 安装依赖
bun install

# 启动本地开发服务器
bun dev

# 构建静态网页
bun build
```

## 目录结构

以下是当前文档站点的目录结构（基于最新代码更新）：

```text
docs/
├── docs/                        # 文档内容
│   ├── zh/                      # 中文文档
│   │   ├── guide/               # 指南与核心文档
│   │   │   ├── _meta.json       # 导航菜单配置
│   │   │   ├── index.md         # 简介与快速开始
│   │   │   ├── api-guide.md     # API 使用指南
│   │   │   ├── changelog.md     # 更新日志（二创版 yjv 版本线）
│   │   │   ├── commit-convention.md # 提交规范
│   │   │   ├── contribution.md  # 贡献指南
│   │   │   ├── deploy.mdx       # 部署指南
│   │   │   ├── development.md   # 开发指南
│   │   │   ├── email-friend-apply.md # 邮件自助友链说明
│   │   │   ├── migration.md     # 数据迁移指南
│   │   │   ├── release.md       # 发布说明
│   │   │   ├── rss.md           # RSS 配置
│   │   │   ├── testing.md       # 测试指南
│   │   │   └── webhook.md       # Webhook 配置
│   │   ├── blog/                # 版本发布相关文章
│   │   │   ├── yjv1.0.0-release.md # 二创版 yjv1.0.0 发布公告
│   │   │   └── v0.3.0-release.md # 官方原版 v0.3.0 发布说明（上游）
│   │   ├── configuration/       # 环境变量与数据库配置文档
│   │   │   ├── env.md           # 环境变量说明
│   │   │   └── database.md      # 数据库结构说明
│   │   └── _nav.json            # 中文导航
│   ├── en/                      # 英文文档（结构同 zh）
│   ├── index.md                 # 文档首页
│   └── public/                  # 静态资源 (如 Logo)
├── package.json                 # 依赖配置
├── rspress.config.ts            # Rspress 配置
└── tsconfig.json                # TypeScript 配置
```

## 文档同步说明

由于本项目是二次开发版，文档的更新策略如下：

1. 核心基础文档（如部署、环境变量）：保持与上游原版逻辑一致，如果上游有更好的修正，我们会同步。
2. 二次开发新增功能（如特定 API、邮件友链验证机制、TOTP、API Key 等）：由本项目（羊角快车）独立维护和更新，上游暂无这些内容。
3. 当文档中同时出现本仓库与官方原版时，先列出 **羊角快车二创版（本仓库，推荐）**，再列出 **官方原版 openRin/Rin（上游）**，并明确标注两者身份。
4. 版本号：二创版从 `yjv1.0.0` 开始使用 `yjvX.Y.Z` 版本线，与官方原版的 `vX.Y.Z` 区分；更新日志见 [guide/changelog.md](./docs/zh/guide/changelog.md)。
5. 发布公告：每次二创版发布在 `blog/` 下新增公告页（如 [yjv1.0.0-release.md](./docs/zh/blog/yjv1.0.0-release.md)），导航中二创版公告排在官方原版公告之前。

如果你在阅读文档时发现与实际代码不符的地方，欢迎提交 [Issue](https://github.com/wool-hmq/Rin/issues) 指正！
