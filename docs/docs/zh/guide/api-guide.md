# API 使用指南

Rin 提供了基于 API 密钥的外部调用接口，允许脚本或 AI 智能体在不登录的情况下管理站点内容与设置。REST 接口位于 `/api/key/` 路径下，MCP 服务端位于 `/mcp`。

密钥分为两类，互不通用：

- **API 接口密钥**：只能调用 `/api/key/*`，用于外部脚本自动化。
- **MCP 密钥**：只能调用 `/mcp`，用于 Claude Code、Cursor 等 MCP 客户端。

## 创建 API 密钥

API 密钥只能由管理员创建。以管理员身份登录后，进入后台「设置」页面，滚动到底部的「API 密钥」区域，可在「API 接口」与「MCP」两个标签页中分别创建、修改、轮换和删除密钥。

密钥归属于创建它的管理员账号，其他账号不会看到这些密钥。

创建时可设置：

- **密钥类型**：API 接口密钥或 MCP 密钥。类型在创建时确定，之后不可更改，两个标签页的密钥列表互不可见。
- **名称**：便于识别的备注，可随时修改。
- **权限范围**：勾选该密钥允许调用的能力，每个业务域为一个独立权限。
- **存储方式**：
  - 加密存储（默认）：密钥只在创建时显示一次，之后无法再次查看，只能轮换。
  - 明文可见：密钥以加密形式保存在数据库中，可随时在设置页查看与复制。

存储方式在创建时确定。加密存储的密钥无法改为可查看；可查看的密钥可以随时关闭查看能力，密钥本身仍然有效，只是不再展示明文。需要可随时查看的密钥时，请新建一个。

## 调用方式

在请求头中携带密钥，两种写法等价：

```bash
# 使用 X-API-Key 请求头
curl -H "X-API-Key: <你的密钥>" https://your-site/api/key/help
```

```bash
# 使用 Authorization 请求头
curl -H "Authorization: Bearer <你的密钥>" https://your-site/api/key/help
```

密钥是 32 位字符。缺失或无效时返回 `401`，权限不足时返回 `403`。使用与接口类型不匹配的密钥同样返回 `403`，例如用 API 接口密钥调用 `/mcp`。

## 查询当前密钥的权限

```bash
curl -H "X-API-Key: <你的密钥>" https://your-site/api/key/help
```

返回该密钥拥有的权限范围，以及每个权限下可用的接口列表：

```json
{
  "success": true,
  "key_id": 1,
  "scopes": ["feed.write"],
  "permissions": [
    {
      "scope": "feed.write",
      "title": "文章管理",
      "description": "通过 API 发布、编辑、删除文章。",
      "endpoints": ["POST /api/key/feed", "POST /api/key/feed/:id", "DELETE /api/key/feed/:id"]
    }
  ],
  "base_path": "/api/key"
}
```

## 权限与接口

| 权限 | 说明 | 接口 |
| --- | --- | --- |
| `content.read` | 内容读取（仅 MCP 密钥） | `POST /mcp`（`tools/list`、`tools/call`） |
| `feed.write` | 文章管理 | `POST /api/key/feed`、`POST /api/key/feed/:id`、`DELETE /api/key/feed/:id` |
| `friend.write` | 友链管理 | `POST /api/key/friend`、`PUT /api/key/friend/:id`、`DELETE /api/key/friend/:id` |
| `moment.write` | 动态管理 | `POST /api/key/moment`、`POST /api/key/moment/:id`、`DELETE /api/key/moment/:id` |
| `config.site` | 站点信息 | `GET/POST /api/key/config/site` |
| `config.personalization` | 个性化 | `GET/POST /api/key/config/personalization` |
| `config.other` | 其它设置（不含网站图标） | `GET/POST /api/key/config/other` |
| `config.comment` | 评论管理 | `GET/POST /api/key/config/comment` |
| `config.supportly` | Supportly 客服 | `GET/POST /api/key/config/supportly` |
| `config.webhook` | Webhook 与测试 Webhook | `GET/POST /api/key/config/webhook`、`POST /api/key/config/webhook/test` |
| `config.friend` | 友链设置 | `GET/POST /api/key/config/friend` |
| `config.maintenance` | 维护 | `GET/POST /api/key/config/maintenance`、`DELETE /api/key/config/cache` |
| `config.ai` | AI 设置 | `GET/POST /api/key/config/ai` |

## MCP 服务端

站点在根路径 `/mcp` 提供 MCP（Model Context Protocol）服务端，支持 MCP 的客户端（Claude Code、Cursor、MCP Inspector 等）可以用 MCP 密钥管理站点内容。

- 传输方式：Streamable HTTP
- 服务地址：`https://your-site/mcp`
- 鉴权方式：请求头携带 `X-API-Key` 或 `Authorization: Bearer <你的密钥>`，必须使用 MCP 密钥；API 接口密钥调用 `/mcp` 会返回 `403`
- 权限裁剪：服务端按密钥权限过滤工具，未授权的工具不会出现在 `tools/list` 中，直接调用同样会被拒绝
- 可用权限：MCP 密钥支持 `content.read` 与各类写入、配置权限，因此同一个密钥既能读取也能维护内容；API 接口密钥不能勾选 `content.read`

### 工具与权限

| 工具 | 所需权限 | 说明 |
| --- | --- | --- |
| `whoami` | 无需权限 | 返回当前密钥信息、权限范围与可用工具列表 |
| `list_posts` | `content.read` | 分页列出文章，支持 `normal`、`draft`、`unlisted`、`all` 过滤 |
| `get_post` | `content.read` | 按 ID 或别名读取文章全文 |
| `search_posts` | `content.read` | 按标题关键字搜索文章 |
| `list_tags` | `content.read` | 列出标签 |
| `list_moments` | `content.read` | 分页列出动态 |
| `list_friends` | `content.read` | 分页列出友链 |
| `create_post`、`update_post`、`delete_post` | `feed.write` | 创建、修改、删除文章 |
| `create_moment`、`update_moment`、`delete_moment` | `moment.write` | 创建、修改、删除动态 |
| `create_friend`、`update_friend`、`delete_friend` | `friend.write` | 创建、修改、删除友链 |
| `get_config`、`update_config` | 对应分区的 `config.*` | 读取与写入设置项，参数与 `GET/POST /api/key/config/{section}` 一致 |

`update_config` 只能写入当前分区允许的键，缺少分区权限或传入越权键时返回错误结果，并指明缺少的权限与被拒绝的键名。

### 客户端配置

Claude Code、Cursor 等客户端使用通用的 MCP 服务器配置格式：

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://your-site/mcp",
      "headers": {
        "X-API-Key": "<你的密钥>"
      }
    }
  }
}
```

### 调试

```bash
# 启动 MCP Inspector，在界面中填入服务地址与 X-API-Key 请求头
npx @modelcontextprotocol/inspector
```

也可以直接用 curl 调用 MCP 方法：

```bash
curl -X POST https://your-site/mcp \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### 访问控制

服务端会校验 `Host` 与 `Origin` 请求头，防止 DNS rebinding 攻击。允许的域名来自 `FRONTEND_URL` 配置、本机地址与 `*.workers.dev`。域名与站点地址不一致时，可通过 `MCP_ALLOWED_HOSTS` 环境变量追加允许的域名，多个域名用英文逗号分隔：

```bash
MCP_ALLOWED_HOSTS=blog.example.com,www.example.com
```

域名条目支持带协议或端口的写法（`https://blog.example.com:443`）、通配域名（`*.example.com`）与 `*`（关闭域名白名单，仅限内网或可信代理环境）。部署命令会把 `MCP_ALLOWED_HOSTS` 与 `FRONTEND_URL` 写入 Worker 变量，修改后重新执行部署即可生效。

### 自定义域名排查

通过自定义域名访问 `/mcp` 时，客户端可能遇到两类拒绝：

| 现象 | 来源 | 处理方式 |
| --- | --- | --- |
| `HTTP 421 Misdirected Request` | Cloudflare 边缘：请求的 Host 没有匹配到该 Worker 的域名或路由 | 在 Cloudflare 控制台为 Worker 添加自定义域名（Custom Domain）或路由（Route），让 `jiaoblog.dpdns.org` 指向该 Worker |
| `HTTP 403` 且响应体包含 `Invalid Host: <域名>` | 服务端的 DNS rebinding 防护 | 把该域名加入 `MCP_ALLOWED_HOSTS`，或把 `FRONTEND_URL` 设为站点根地址，然后重新部署 |

验证命令：

```bash
curl -i -X POST https://jiaoblog.dpdns.org/mcp \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

## 文章管理

### 发布文章

```bash
curl -X POST https://your-site/api/key/feed \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "文章标题",
    "content": "# Markdown 正文",
    "summary": "摘要",
    "tags": ["Rin"],
    "listed": true,
    "draft": false
  }'
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `title` | string | 是 | 文章标题 |
| `content` | string | 是 | Markdown 正文 |
| `summary` | string | 否 | 摘要 |
| `alias` | string | 否 | 自定义访问别名 |
| `tags` | string[] | 否 | 标签列表 |
| `listed` | boolean | 否 | 是否在列表中展示，默认 `true` |
| `draft` | boolean | 否 | 是否为草稿，默认 `true` |
| `createdAt` | string | 否 | 发布时间，ISO 8601 格式 |

### 修改文章

```bash
curl -X POST https://your-site/api/key/feed/12 \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "新标题",
    "content": "更新后的正文",
    "draft": false
  }'
```

只传需要修改的字段即可，未传的字段保持原值。

### 删除文章

```bash
curl -X DELETE https://your-site/api/key/feed/12 \
  -H "X-API-Key: <你的密钥>"
```

## 友链管理

### 创建友链

```bash
curl -X POST https://your-site/api/key/friend \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "友站名称",
    "desc": "友站简介",
    "avatar": "https://example.com/avatar.png",
    "url": "https://example.com",
    "group": "默认"
  }'
```

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `name` | string | 是 | 站点名称，最长 20 字符 |
| `desc` | string | 是 | 站点简介，最长 100 字符 |
| `avatar` | string | 是 | 头像地址，最长 100 字符 |
| `url` | string | 是 | 站点地址，最长 100 字符 |
| `group` | string | 否 | 分组名称，最长 20 字符 |
| `accepted` | boolean | 否 | 是否已通过审核，默认 `true` |
| `sort_order` | number | 否 | 排序值，默认 `0` |

### 修改友链

```bash
curl -X PUT https://your-site/api/key/friend/3 \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{ "desc": "更新后的简介" }'
```

### 删除友链

```bash
curl -X DELETE https://your-site/api/key/friend/3 \
  -H "X-API-Key: <你的密钥>"
```

## 动态管理

### 发布动态

```bash
curl -X POST https://your-site/api/key/moment \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "今天天气不错" }'
```

### 修改动态

```bash
curl -X POST https://your-site/api/key/moment/5 \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "更新后的内容" }'
```

### 删除动态

```bash
curl -X DELETE https://your-site/api/key/moment/5 \
  -H "X-API-Key: <你的密钥>"
```

## 设置项

设置类接口统一为 `GET /api/key/config/{section}` 读取、`POST /api/key/config/{section}` 写入。写入时只能包含该 section 允许的键，出现范围外的键会返回 `400` 并列出被拒绝的键名。

```bash
curl -X POST https://your-site/api/key/config/site \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{ "site.name": "新站名", "site.description": "新简介" }'
```

### 各 section 可写键

| section | 权限 | 可写键 |
| --- | --- | --- |
| `site` | `config.site` | `site.name`、`site.description`、`site.avatar`、`site.page_size`、`announcement.content`、`announcement.speed` |
| `personalization` | `config.personalization` | `header.layout`、`header.behavior`、`feed.layout`、`feed.card_variant`、`theme.color` |
| `other` | `config.other` | `login.enabled`、`counter.enabled`、`rss`、`footer`、`cache.enabled` |
| `comment` | `config.comment` | `comment.enabled`、`comment.default`、`comment.systemOrder`、`twikoo.*`、`giscus.*`、`waline.*`、`cwd.*`、`gitalk.*`、`utterances.*`、`discuss.*` |
| `supportly` | `config.supportly` | `supportly.enabled`、`supportly.channelId`、`supportly.title`、`supportly.widgetUrl` |
| `webhook` | `config.webhook` | `webhook_url`、`webhook.method`、`webhook.content_type`、`webhook.headers`、`webhook.body_template` |
| `friend` | `config.friend` | `friend_apply_enable`、`friend_groups`、`friend_group_order`、`friend_crontab`、`friend_ua` |
| `maintenance` | `config.maintenance` | `cache.enabled` |
| `ai` | `config.ai` | `ai_search.enabled`、`ai_summary.enabled`、`ai_summary.provider`、`ai_summary.model`、`ai_summary.api_url`、`ai_summary.retries`、`ai_summary.api_key`、`ai_summary.failover`、`ai_summary.custom_code` |

网站图标（`favicon`）不在任何 section 的可写范围内。

### 测试 Webhook

```bash
curl -X POST https://your-site/api/key/config/webhook/test \
  -H "X-API-Key: <你的密钥>" \
  -H "Content-Type: application/json" \
  -d '{ "test_message": "测试消息" }'
```

请求体中的 `webhook_url` 等字段可临时覆盖已保存的配置，仅对本次测试生效。

### 清空缓存

```bash
curl -X DELETE https://your-site/api/key/config/cache \
  -H "X-API-Key: <你的密钥>"
```

## 内容归属

通过 API 发布的文章与动态默认归属到用户 ID `1` 的账号。如需改为其他账号，修改 `server/src/services/api-key-owner.ts` 中的 `API_KEY_CONTENT_OWNER_UID` 常量后重新部署。

## 错误响应

```json
{
  "success": false,
  "error": "This API key is missing the \"feed.write\" scope"
}
```

| 状态码 | 含义 |
| --- | --- |
| `400` | 请求参数不合法，或包含当前权限不可写的配置键 |
| `401` | 缺少 API 密钥，或密钥无效、已轮换、已删除 |
| `403` | 密钥有效但缺少对应权限，或密钥类型与接口不匹配 |
| `404` | 目标资源或配置 section 不存在 |

## 安全建议

- 为不同用途创建不同的密钥，按最小必要原则勾选权限。
- 不要在浏览器前端或公开仓库中暴露密钥。
- 怀疑泄露时立即轮换或删除密钥。
- 不在使用的密钥及时删除。
