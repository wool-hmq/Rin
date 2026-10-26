---
pageType: doc
sidebar: false
---

# 羊角快车二创版 yjv1.1 发布：友链双验证、MCP 服务端与密钥分型

**发布日期**: 2026年10月26日

**版本状态**: 稳定版（Stable）

本页汇总 `yjv1.1` 版本线的全部改动，包含 `1.1.0`、`1.1.1`、`1.1.2` 三个发布。同一版本线内的补丁会合并到本页继续维护，不再单独新增发布公告；新的版本线（如 `1.2`）才新建页面。

## 版本一览

| 版本 | 类型 | 主要内容 |
| --- | --- | --- |
| `1.1.0` | 普通更新 | 友链验证支持 DNS TXT 与 HTML 文件两种方式 |
| `1.1.1` | 普通更新 | 新增 `/mcp` MCP 服务端，接入外部 AI 客户端 |
| `1.1.2` | 补丁 | 拆分 API 接口密钥与 MCP 密钥 |

## 1.1.0 友链验证支持两种方式

访客提交友链申请并通过 JSON 校验后，机器人会进入 `awaiting_method_choice` 阶段，请访客选择验证方式：

- 回复 `1`（或 `一` / `方案一` / `方法一`）：使用 DNS TXT 记录
- 回复 `2`（或 `二` / `方案二` / `方法二`）：上传 HTML 文件

DNS 方式会下发 `_jiaofriend` 主机记录、`TXT` 类型、验证码作为记录值的教程，验证时通过 Cloudflare DNS-over-HTTPS 查询 `_jiaofriend.<访客域名>` 并检查记录值是否包含验证码。文件方式保留原有严格校验：GET 必须返回 200，且剔除标签与脚本后的 `<body>` 文本包含验证码。

状态机新增 `awaiting_verification` 阶段并记录 `verifyMethod`；修改友链时，旧站点与新站点分别重新选择验证方式；升级前的 `verifying` 状态自动回退为文件验证。DNS 查询通过可注入依赖 `resolveTxt(name) => Promise<string[]>` 实现，便于测试与替换解析器。

本版本同时修复了友链验证被 SPA 回退、自定义 404、403/500 与 30x 重定向误判通过的问题，以及 `friends-sitemap.xml` 被前端路由拦截、查看密钥把加密存储改成明文、验证码重复初始化导致申请崩溃、邮件解析在 CJS / ESM 产物下的兼容性问题。

## 1.1.1 MCP 服务端

站点在根路径新增 `/mcp` 端点，把文章、动态、友链与站点设置接入 MCP（Model Context Protocol）。Claude Code、Cursor、Claude Desktop、MCP Inspector 等客户端可以读写站点内容。

- **传输方式**：Streamable HTTP，每个请求独立创建实例，不跨请求保存状态
- **鉴权方式**：`X-API-Key` 或 `Authorization: Bearer`，复用设置页密钥，并刷新最近使用时间
- **权限裁剪**：`tools/list` 按密钥权限过滤，新增 `content.read` 读取权限
- **安全校验**：Host 与 Origin 校验阻断 DNS rebinding，自定义域名通过 `MCP_ALLOWED_HOSTS` 放行

| 工具 | 所需权限 | 说明 |
| --- | --- | --- |
| `whoami` | 任意有效密钥 | 返回密钥 ID、账号 ID、权限与可用工具 |
| `list_posts` / `get_post` / `search_posts` | `content.read` | 列出、读取、搜索文章（含草稿与不公开文章） |
| `list_tags` / `list_moments` / `list_friends` | `content.read` | 列出标签、动态与友链 |
| `create_post` / `update_post` / `delete_post` | `feed.write` | 创建（默认草稿）、编辑、删除文章 |
| `create_moment` / `update_moment` / `delete_moment` | `moment.write` | 创建、编辑、删除动态 |
| `create_friend` / `update_friend` / `delete_friend` | `friend.write` | 创建、编辑、删除友链 |
| `get_config` / `update_config` | 对应分区的 `config.*` | 读写设置页分区，越权键会被拒绝 |

客户端配置示例：

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://<站点域名>/mcp",
      "headers": {
        "X-API-Key": "<MCP 密钥>"
      }
    }
  }
}
```

使用自定义域名时，需要同时在 Cloudflare 侧把域名绑定为 Worker 的自定义域名或路由，并把域名加入 `MCP_ALLOWED_HOSTS`（或把 `FRONTEND_URL` 设为站点根地址）。`421 Misdirected Request` 来自 Cloudflare 边缘，`403 Invalid Host` 来自服务端白名单，两者的排查方法见 [API 使用指南](../guide/api-guide)。

## 1.1.2 API 接口与 MCP 密钥分离

两类端点此前共用同一套密钥与权限，一把用于脚本自动化的密钥也能调用 MCP 端点。本次把密钥拆分为两种类型：

| 类型 | `key_type` | 可用端点 | 典型用途 |
| --- | --- | --- | --- |
| API 接口密钥 | `1` | `/api/key/*` | 外部脚本、定时任务、自动化同步 |
| MCP 密钥 | `2` | `/mcp` | Claude Code、Cursor、MCP Inspector 等 MCP 客户端 |

- 类型在创建时确定，之后不可更改；设置页按「API 接口」与「MCP」两个标签页分别列出与创建密钥
- 类型与端点不匹配时，请求在鉴权阶段返回 `403`，不会进入业务逻辑
- `content.read` 只对 MCP 密钥开放；API 接口密钥可选 `feed.write`、`moment.write`、`friend.write` 与各类 `config.*`

数据库新增 `key_type` 列，迁移 `0021.sql` 会为历史密钥自动归类：权限中含 `content.read` 的转为 MCP 密钥，其余转为 API 接口密钥。升级后原有 MCP 客户端可以继续使用，无需重建密钥；同时承担脚本与 MCP 两种用途的密钥只会保留其中一种能力，建议按用途拆分。

## 版本状态与编号规则

二创版使用独立的 `yjvX.Y.Z` 版本线，按改动规模递增：

1. **超大更新**：大量新功能或整体重构，`X` 加 1，低位归零
2. **普通更新**：新增 1-2 个功能，或多个简单功能，`Y` 加 1，低位归零
3. **补丁**：缺陷修复与小改动，`Z` 加 1

页面按版本线维护：同一版本线的补丁合并到该线页面。版本线推进后，上一条线标记为**稳定版**，新的版本线标记为 **Beta**，例如开始 `1.2` 时，`1.1` 为稳定版、`1.2` 为 Beta。当前 `1.1` 为稳定版。

## 升级提示

- 拉取代码后重新部署即可，迁移随部署流程自动执行，无需手动操作
- 使用自定义域名的站点需配置 `MCP_ALLOWED_HOSTS`，否则 MCP 握手返回 `403`
- 原有密钥按权限自动归类；若客户端提示 `403`，先确认密钥所在标签页与端点是否匹配

接口细节见 [API 使用指南](../guide/api-guide)，完整改动见 [更新日志](../guide/changelog)。

## 反馈

如果你在验证 `yjv1.1.0~yjv1.1.2` 时发现问题，建议直接通过以下方式反馈：

- 二创版 Issues：<https://github.com/wool-hmq/Rin/issues>
- 二创版 Discussions：<https://github.com/wool-hmq/Rin/discussions>
- 官方原版 Issues（上游）：<https://github.com/openRin/Rin/issues>
