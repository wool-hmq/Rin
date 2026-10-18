# API 使用指南

Rin 提供了基于 API 密钥的外部调用接口，允许脚本或 AI 智能体在不登录的情况下管理站点内容与设置。所有接口都位于 `/api/key/` 路径下。

## 创建 API 密钥

登录后打开「个人资料」页面，点击「API 密钥」区域的「管理」按钮，或直接访问 `/api-keys`。

创建时可设置：

- **名称**：便于识别的备注，可随时修改。
- **权限范围**：勾选该密钥允许调用的能力，每个业务域为一个独立权限。
- **存储方式**：
  - 加密存储（默认）：密钥只在创建时显示一次，之后无法再次查看，只能轮换。
  - 明文可见：密钥以加密形式保存在数据库中，可随时在设置页查看与复制。

明文可见可以随时开启或关闭；关闭后不影响密钥本身，只是不再展示明文。

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

密钥是 32 位字符。缺失或无效时返回 `401`，权限不足时返回 `403`。

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
| `403` | 密钥有效但缺少对应权限 |
| `404` | 目标资源或配置 section 不存在 |

## 安全建议

- 为不同用途创建不同的密钥，按最小必要原则勾选权限。
- 不要在浏览器前端或公开仓库中暴露密钥。
- 怀疑泄露时立即轮换或删除密钥。
- 不在使用的密钥及时删除。
