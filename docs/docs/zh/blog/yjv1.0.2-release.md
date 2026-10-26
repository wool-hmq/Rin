---
pageType: doc
sidebar: false
---

# 羊角快车二创版 yjv1.0.2 发布：新增 MCP 服务端

**发布日期**: 2026年10月26日

本次版本在站点根路径新增 `/mcp` 端点，把文章、动态、友链与站点设置接入 MCP（Model Context Protocol）。Claude Code、Cursor、Claude Desktop、MCP Inspector 等客户端可以用设置页创建的 API Key 直接读取与维护站点内容。

## 主要变化

- **MCP 服务端**：`POST /mcp`，每个请求独立创建实例，无状态、不跨请求保存会话
- **API Key 鉴权**：支持 `X-API-Key` 请求头与 `Authorization: Bearer`，复用设置页的密钥，并刷新最近使用时间
- **权限裁剪**：`tools/list` 按密钥 scope 过滤，新增 `content.read` 读取权限；`whoami` 可查看当前密钥身份与权限
- **域名白名单**：Host 与 Origin 校验阻断 DNS rebinding 攻击，自定义域名通过 `MCP_ALLOWED_HOSTS` 放行
- **部署集成**：部署命令会把 `FRONTEND_URL` 与 `MCP_ALLOWED_HOSTS` 写入 Worker 变量

## 工具与权限

| 工具 | 所需权限 | 说明 |
| --- | --- | --- |
| `whoami` | 任意有效密钥 | 返回密钥 ID、账号 ID、权限与可用工具 |
| `list_posts` / `get_post` / `search_posts` | `content.read` | 列出、读取、搜索文章（可读取草稿与不公开文章） |
| `list_tags` / `list_moments` / `list_friends` | `content.read` | 列出标签、动态与友链 |
| `create_post` / `update_post` / `delete_post` | `feed.write` | 创建（默认草稿）、编辑、删除文章 |
| `create_moment` / `update_moment` / `delete_moment` | `moment.write` | 创建、编辑、删除动态 |
| `create_friend` / `update_friend` / `delete_friend` | `friend.write` | 创建、编辑、删除友链 |
| `get_config` / `update_config` | 对应分区的 `config.*` | 读写设置页分区，越权键会被拒绝 |

配置分区权限包括 `config.site`、`config.personalization`、`config.other`、`config.comment`、`config.supportly`、`config.webhook`、`config.friend`、`config.maintenance` 与 `config.ai`。读写的分区必须与密钥权限一致，`update_config` 提交越权键名时会直接报错并列出被拒绝的键。

## 快速开始

### 1. 创建 API Key

进入后台「设置 → API Key」，新建密钥并勾选需要的权限。只读场景勾选 `content.read`，需要维护文章再追加 `feed.write`。

### 2. 配置客户端

Claude Code：

```bash
claude mcp add --transport http rin https://<站点域名>/mcp \
  --header "X-API-Key: <密钥>"
```

通用 JSON 配置：

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://<站点域名>/mcp",
      "headers": {
        "X-API-Key": "<密钥>"
      }
    }
  }
}
```

### 3. 验证连通性

```bash
curl -i -X POST https://<站点域名>/mcp \
  -H "X-API-Key: <密钥>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

返回 `200` 与 `serverInfo` 中的 `"name":"rin"` 即表示握手成功。缺少密钥返回 `401 Missing API key`，密钥无效返回 `401 Invalid API key`。

## 自定义域名与 421 / 403

使用自定义域名（例如 `jiaoblog.dpdns.org`）时，需要同时确认两件事，否则客户端会在握手阶段失败：

1. **Cloudflare 侧接管域名**：为 Worker 添加自定义域名（Custom Domain）或路由（Route）。把域名 CNAME 到 `*.workers.dev` 并不能代替这一步，请求会在边缘被 Cloudflare 以 `421 Misdirected Request` 拒绝，无法到达 Worker。
2. **应用侧放行域名**：把域名加入 `MCP_ALLOWED_HOSTS`，或者把 `FRONTEND_URL` 设为站点根地址。否则服务端返回 `403`，响应体为 `Invalid Host: <域名>`。

| 现象 | 来源 | 处理方式 |
| --- | --- | --- |
| `421 Misdirected Request` | Cloudflare 边缘，Host 未匹配到 Worker 域名或路由 | 在 Cloudflare 控制台配置自定义域名或路由 |
| `403` 且包含 `Invalid Host` | 服务端 DNS rebinding 防护 | 配置 `MCP_ALLOWED_HOSTS` 或 `FRONTEND_URL` 后重新部署 |

配置示例（`.env` 或部署环境变量）：

```bash
FRONTEND_URL=https://jiaoblog.dpdns.org
MCP_ALLOWED_HOSTS=jiaoblog.dpdns.org,www.jiaoblog.dpdns.org
```

白名单条目支持带协议或端口的写法（`https://jiaoblog.dpdns.org:443`）、通配域名（`*.dpdns.org`）与 `*`（关闭域名白名单，仅限内网或可信代理环境）。修改后重新部署即可生效，无需数据库迁移。

## 行为说明

- 每个 HTTP 请求都会新建 MCP 实例，不在请求之间保留会话状态，避免多用户环境下的数据串扰
- 写入的内容归属管理员账号（uid = 1），沿用现有的文章、动态与友链模型
- 写入后会清理文章、搜索与动态相关缓存，列表页可以立即看到更新
- `get_config` 读取 AI 分区时只返回 `ai_summary.api_key_set` 布尔值，不暴露密钥本身

## 升级提示

- 已在旧版本运行的站点：拉取代码，在部署环境按需配置 `FRONTEND_URL` / `MCP_ALLOWED_HOSTS`，重新部署即可
- 只通过 `*.workers.dev` 或本机地址访问时，不需要额外配置白名单
- 本版本没有新增数据库迁移，历史数据无需处理

完整的改动记录见 [更新日志](../guide/changelog)，工具参数与调试细节见 [API 使用指南](../guide/api-guide)。

## 反馈

如果你在验证 `yjv-1.0.2` 时发现问题，建议直接通过以下方式反馈：

- 🐛 [羊角快车二创版 Issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [羊角快车二创版 Discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 官方原版 Issues（上游）：[openRin/Rin Issues](https://github.com/openRin/Rin/issues)
- 💬 官方原版 Discussions（上游）：[openRin/Rin Discussions](https://github.com/openRin/Rin/discussions)
