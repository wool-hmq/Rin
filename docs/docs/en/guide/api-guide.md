# API Guide

Rin exposes an API-key based interface that lets scripts or AI agents manage site content and settings without a login session. REST endpoints live under `/api/key/`, and the MCP server lives at `/mcp`.

Keys come in two types that do not work interchangeably:

- **REST API keys**: call `/api/key/*` only, for scripted automation.
- **MCP keys**: call `/mcp` only, for MCP clients such as Claude Code and Cursor.

## Creating an API key

Only administrators can create API keys. Sign in as an administrator, open the admin Settings page, and scroll to the API keys section at the bottom. The REST API and MCP tabs each list, create, edit, rotate, and delete their own keys.

Each key belongs to the administrator who created it, and other accounts never see those keys.

When creating a key you choose:

- **Key type**: REST API or MCP. The type is fixed at creation and cannot be changed, and each tab only lists its own keys.
- **Name**: a label you can edit at any time.
- **Scopes**: the capabilities this key may use. Each feature area is a separate scope.
- **Storage mode**:
  - Encrypted (default): the key is shown once at creation, then only rotation is available.
  - Revealable: the key is stored encrypted and can be revealed and copied at any time.

Storage mode is fixed at creation. An encrypted key can never become revealable; a revealable key can have that capability turned off at any time, and the key keeps working, it just stops showing the plaintext. Create a new key if you need one you can reveal later.

## Making requests

Send the key in a request header. Both forms are equivalent:

```bash
# X-API-Key header
curl -H "X-API-Key: <your-key>" https://your-site/api/key/help
```

```bash
# Authorization header
curl -H "Authorization: Bearer <your-key>" https://your-site/api/key/help
```

Keys are 32 characters. A missing or invalid key returns `401`; a valid key without the required scope returns `403`. Using a key against the other key type also returns `403`, for example a REST API key calling `/mcp`.

## Inspecting the current key

```bash
curl -H "X-API-Key: <your-key>" https://your-site/api/key/help
```

The response lists the key's scopes and the endpoints available for each one:

```json
{
  "success": true,
  "key_id": 1,
  "scopes": ["feed.write"],
  "permissions": [
    {
      "scope": "feed.write",
      "title": "Article management",
      "description": "Create, edit and delete articles through the API.",
      "endpoints": ["POST /api/key/feed", "POST /api/key/feed/:id", "DELETE /api/key/feed/:id"]
    }
  ],
  "base_path": "/api/key"
}
```

## Scopes and endpoints

| Scope | Purpose | Endpoints |
| --- | --- | --- |
| `content.read` | Content reading (MCP) | `POST /mcp` (`tools/list`, `tools/call`) |
| `feed.write` | Articles | `POST /api/key/feed`, `POST /api/key/feed/:id`, `DELETE /api/key/feed/:id` |
| `friend.write` | Friend links | `POST /api/key/friend`, `PUT /api/key/friend/:id`, `DELETE /api/key/friend/:id` |
| `moment.write` | Moments | `POST /api/key/moment`, `POST /api/key/moment/:id`, `DELETE /api/key/moment/:id` |
| `config.site` | Site info | `GET/POST /api/key/config/site` |
| `config.personalization` | Personalization | `GET/POST /api/key/config/personalization` |
| `config.other` | Other settings (excluding favicon) | `GET/POST /api/key/config/other` |
| `config.comment` | Comment management | `GET/POST /api/key/config/comment` |
| `config.supportly` | Supportly widget | `GET/POST /api/key/config/supportly` |
| `config.webhook` | Webhook and test webhook | `GET/POST /api/key/config/webhook`, `POST /api/key/config/webhook/test` |
| `config.friend` | Friend link settings | `GET/POST /api/key/config/friend` |
| `config.maintenance` | Maintenance | `GET/POST /api/key/config/maintenance`, `DELETE /api/key/config/cache` |
| `config.ai` | AI settings | `GET/POST /api/key/config/ai` |

## MCP server

The site exposes an MCP (Model Context Protocol) server at the root path `/mcp`, so MCP-capable clients (Claude Code, Cursor, MCP Inspector, and similar tools) manage site content with an MCP key.

- Transport: Streamable HTTP
- Endpoint: `https://your-site/mcp`
- Authentication: send the key in the `X-API-Key` or `Authorization: Bearer <your-key>` header; the key must be an MCP key, and a REST API key calling `/mcp` gets `403`
- Scope filtering: the server registers only the tools the key is allowed to use, so unauthorized tools never appear in `tools/list` and direct calls are rejected as well
- Available scopes: MCP keys can hold `content.read` plus the write and config scopes, so one key can both read and maintain content; REST API keys cannot select `content.read`

### Tools and scopes

| Tool | Required scope | Purpose |
| --- | --- | --- |
| `whoami` | none | Returns the calling key, its scopes and the available tools |
| `list_posts` | `content.read` | Lists articles with `normal`, `draft`, `unlisted` or `all` filtering |
| `get_post` | `content.read` | Reads a full article by ID or alias |
| `search_posts` | `content.read` | Searches articles by title keyword |
| `list_tags` | `content.read` | Lists tags |
| `list_moments` | `content.read` | Lists moments |
| `list_friends` | `content.read` | Lists friend links |
| `create_post`, `update_post`, `delete_post` | `feed.write` | Creates, edits and deletes articles |
| `create_moment`, `update_moment`, `delete_moment` | `moment.write` | Creates, edits and deletes moments |
| `create_friend`, `update_friend`, `delete_friend` | `friend.write` | Creates, edits and deletes friend links |
| `get_config`, `update_config` | the `config.*` scope of the section | Reads and writes settings, matching `GET/POST /api/key/config/{section}` |

`update_config` accepts only the keys writable in the requested section. A missing section scope or a key outside the section returns an error result naming the missing scope and the rejected keys.

### Client configuration

Claude Code, Cursor and other clients use the common MCP server configuration format:

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://your-site/mcp",
      "headers": {
        "X-API-Key": "<your-key>"
      }
    }
  }
}
```

### Debugging

```bash
# Start MCP Inspector, then fill in the endpoint and the X-API-Key header
npx @modelcontextprotocol/inspector
```

MCP methods can also be called directly with curl:

```bash
curl -X POST https://your-site/mcp \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

### Access control

The server validates the `Host` and `Origin` headers to block DNS rebinding attacks. Allowed hostnames come from the `FRONTEND_URL` setting, local addresses and `*.workers.dev`. When the served domain differs from the site address, append the allowed hostnames to the `MCP_ALLOWED_HOSTS` environment variable, separated by commas:

```bash
MCP_ALLOWED_HOSTS=blog.example.com,www.example.com
```

Entries may include a scheme or port (`https://blog.example.com:443`), use a wildcard domain (`*.example.com`) or `*` to disable the hostname allowlist (internal networks and trusted proxies only). The deploy command writes `MCP_ALLOWED_HOSTS` and `FRONTEND_URL` into the worker variables, so a redeploy applies the change.

### Custom domain troubleshooting

Clients hitting `/mcp` through a custom domain can meet two kinds of rejection:

| Symptom | Source | Fix |
| --- | --- | --- |
| `HTTP 421 Misdirected Request` | Cloudflare edge: the request Host does not match a domain or route of that worker | Attach the domain (for example `jiaoblog.dpdns.org`) to the worker as a Custom Domain or a Route in the Cloudflare dashboard |
| `HTTP 403` with `Invalid Host: <hostname>` in the body | The server-side DNS rebinding protection | Add the hostname to `MCP_ALLOWED_HOSTS` or point `FRONTEND_URL` at the site origin, then redeploy |

Verification command:

```bash
curl -i -X POST https://jiaoblog.dpdns.org/mcp \
  -H "X-API-Key: <your key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

## Articles

### Create an article

```bash
curl -X POST https://your-site/api/key/feed \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Article title",
    "content": "# Markdown body",
    "summary": "Summary",
    "tags": ["Rin"],
    "listed": true,
    "draft": false
  }'
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | yes | Article title |
| `content` | string | yes | Markdown body |
| `summary` | string | no | Summary |
| `alias` | string | no | Custom URL alias |
| `tags` | string[] | no | Tag list |
| `listed` | boolean | no | Show in listings, defaults to `true` |
| `draft` | boolean | no | Draft flag, defaults to `true` |
| `createdAt` | string | no | Publish time, ISO 8601 |

### Edit an article

```bash
curl -X POST https://your-site/api/key/feed/12 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "New title",
    "content": "Updated body",
    "draft": false
  }'
```

Only send the fields you want to change; omitted fields keep their current values.

### Delete an article

```bash
curl -X DELETE https://your-site/api/key/feed/12 \
  -H "X-API-Key: <your-key>"
```

## Friend links

### Create a friend link

```bash
curl -X POST https://your-site/api/key/friend \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Friend site",
    "desc": "Short description",
    "avatar": "https://example.com/avatar.png",
    "url": "https://example.com",
    "group": "default"
  }'
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | yes | Site name, max 20 characters |
| `desc` | string | yes | Description, max 100 characters |
| `avatar` | string | yes | Avatar URL, max 100 characters |
| `url` | string | yes | Site URL, max 100 characters |
| `group` | string | no | Group name, max 20 characters |
| `accepted` | boolean | no | Mark as approved, defaults to `true` |
| `sort_order` | number | no | Sort value, defaults to `0` |

### Edit a friend link

```bash
curl -X PUT https://your-site/api/key/friend/3 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "desc": "Updated description" }'
```

### Delete a friend link

```bash
curl -X DELETE https://your-site/api/key/friend/3 \
  -H "X-API-Key: <your-key>"
```

## Moments

### Create a moment

```bash
curl -X POST https://your-site/api/key/moment \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "Nice weather today" }'
```

### Edit a moment

```bash
curl -X POST https://your-site/api/key/moment/5 \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "content": "Updated content" }'
```

### Delete a moment

```bash
curl -X DELETE https://your-site/api/key/moment/5 \
  -H "X-API-Key: <your-key>"
```

## Settings

Settings endpoints follow `GET /api/key/config/{section}` to read and `POST /api/key/config/{section}` to write. A write may only contain keys allowed for that section; out-of-range keys make the request fail with `400` and the rejected key names.

```bash
curl -X POST https://your-site/api/key/config/site \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "site.name": "New name", "site.description": "New description" }'
```

### Writable keys by section

| Section | Scope | Writable keys |
| --- | --- | --- |
| `site` | `config.site` | `site.name`, `site.description`, `site.avatar`, `site.page_size`, `announcement.content`, `announcement.speed` |
| `personalization` | `config.personalization` | `header.layout`, `header.behavior`, `feed.layout`, `feed.card_variant`, `theme.color` |
| `other` | `config.other` | `login.enabled`, `counter.enabled`, `rss`, `footer`, `cache.enabled` |
| `comment` | `config.comment` | `comment.enabled`, `comment.default`, `comment.systemOrder`, `twikoo.*`, `giscus.*`, `waline.*`, `cwd.*`, `gitalk.*`, `utterances.*`, `discuss.*` |
| `supportly` | `config.supportly` | `supportly.enabled`, `supportly.channelId`, `supportly.title`, `supportly.widgetUrl` |
| `webhook` | `config.webhook` | `webhook_url`, `webhook.method`, `webhook.content_type`, `webhook.headers`, `webhook.body_template` |
| `friend` | `config.friend` | `friend_apply_enable`, `friend_groups`, `friend_group_order`, `friend_crontab`, `friend_ua` |
| `maintenance` | `config.maintenance` | `cache.enabled` |
| `ai` | `config.ai` | `ai_search.enabled`, `ai_summary.enabled`, `ai_summary.provider`, `ai_summary.model`, `ai_summary.api_url`, `ai_summary.retries`, `ai_summary.api_key`, `ai_summary.failover`, `ai_summary.custom_code` |

The favicon is not writable through any section.

### Testing the webhook

```bash
curl -X POST https://your-site/api/key/config/webhook/test \
  -H "X-API-Key: <your-key>" \
  -H "Content-Type: application/json" \
  -d '{ "test_message": "Test message" }'
```

Values such as `webhook_url` in the body override the saved configuration for this single test only.

### Clearing the cache

```bash
curl -X DELETE https://your-site/api/key/config/cache \
  -H "X-API-Key: <your-key>"
```

## Content ownership

Articles and moments created through the API are attributed to user ID `1`. To use a different account, change `API_KEY_CONTENT_OWNER_UID` in `server/src/services/api-key-owner.ts` and redeploy.

## Error responses

```json
{
  "success": false,
  "error": "This API key is missing the \"feed.write\" scope"
}
```

| Status | Meaning |
| --- | --- |
| `400` | Invalid parameters, or a config key outside the granted section |
| `401` | Missing, invalid, rotated or deleted API key |
| `403` | Valid key without the required scope, or the key type does not match the endpoint |
| `404` | Resource or config section not found |

## Security notes

- Create one key per use case and grant only the scopes it needs.
- Never ship a key in browser code or a public repository.
- Rotate or delete a key immediately if you suspect a leak.
- Delete keys you no longer use.
