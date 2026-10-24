---
pageType: doc
sidebar: false
---

# 羊角快车二创版 yjv1.0.0 发布：独立版本线启动

**发布日期**: 2026年10月24日

从今天起，羊角快车二创版（[wool-hmq/Rin](https://github.com/wool-hmq/Rin)）启用独立的 `yjvX.Y.Z` 版本线，与官方原版（[openRin/Rin](https://github.com/openRin/Rin)，上游）的 `vX.Y.Z` 版本线分开维护。首个版本为 `yjv1.0.0`，后续功能更新以 `yjv1.0.1`、`yjv1.0.2` 的形式递增。

## 版本线约定

- 二创版版本号使用 `yjv` 前缀，官方原版继续使用 `v` 前缀
- 二创版版本号与各 package 的 `0.3.0` 语义化版本互不影响，发布标签以 `yjvX.Y.Z` 为准
- 官方原版的历史发布记录（`v0.3.0`、`v0.2.0` 等）继续保留在更新日志中，标注为官方原版/上游
- 文档中同时出现两个仓库时，统一先列 **羊角快车二创版（本仓库）**，再列 **官方原版 openRin/Rin（上游）**

## 本版本的主要内容

### 友链申请与验证

- 邮件自助友链：访客通过邮件完成友链申请、修改与删除，流程包含 JSON 模板、人机验证码图片、申请取消指令与回复拦截引导
- 友链验证支持 DNS TXT 与 HTML 文件两种方式：访客在邮件中回复 `1` 或 `2` 选择验证方式，DNS 方式通过 `_jiaofriend` 主机的 TXT 记录校验，文件方式保持 200 状态码加 `<body>` 文本匹配的严格校验
- 友链分组与展示顺序管理、友链可访问状态定时检查、`friends-sitemap.xml` 输出

### 账号安全

- TOTP 双因素认证：所有用户可用，支持恢复码与登录限流，无密码账号同样可以启用
- API Key 外部调用体系：管理员在后台创建、吊销密钥并限定权限范围
- 登录限流与账号锁定策略在密码 / TOTP 登录路径上生效

### 内容与阅读体验

- 多套评论系统、Webhook 通知、RSS、Sitemap 与动态 robots.txt
- AI 摘要、AI 增强搜索、自定义模型与回退模型队列排序
- Monorepo 共享包（`@rin/api`、`@rin/ui`）与前后端类型同步

### 部署与工程化

- 部署、开发、数据库任务统一收敛到 Rin CLI，并配套 GitHub Actions 的 Build / Deploy / Preview / Release / 文档站工作流
- 后端运行时面向 Cloudflare Workers 轻量化改造，路由与依赖按需加载
- 中英文文档随仓库同步维护，部署指南、配置说明与数据库结构文档按当前实现校准

## 升级提示

- 从官方原版升级到二创版时，部署脚本会自动执行 `server/sql/` 下的迁移脚本，无需手动操作
- 邮件登录、邮箱验证码与邮件自助友链属于可选功能，需要配置 `EMAIL_SEND_URLS` / `EMAIL_SEND_KEYS`，详见 [环境变量说明](../configuration/env)
- TOTP、API Key、友链分组等功能无需额外环境变量，在后台页面按需启用即可

完整的版本改动记录见 [更新日志](../guide/changelog)，部署步骤见 [部署指南](../guide/deploy)。

## 反馈

如果你在验证 `yjv1.0.0` 时发现问题，建议直接通过以下方式反馈：

- 🐛 [羊角快车二创版 Issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快车二创版 Discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 官方原版 Issues（上游）：[openRin/Rin Issues](https://github.com/openRin/Rin/issues)
- 💬 官方原版 Discussions（上游）：[openRin/Rin Discussions](https://github.com/openRin/Rin/discussions)
