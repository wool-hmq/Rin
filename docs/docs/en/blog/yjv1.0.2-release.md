---
pageType: doc
sidebar: false
---

# Secondary edition yjv1.0.2: MCP server

**Release date**: October 26, 2026

This release adds an `/mcp` endpoint at the site root, exposing articles, moments, friend links and site settings through MCP (Model Context Protocol). Clients such as Claude Code, Cursor, Claude Desktop and MCP Inspector can read and maintain content with an API key created on the settings page.

## Highlights

- **MCP server**: `POST /mcp`, with a fresh instance per request and no state shared across requests
- **API key auth**: accepts `X-API-Key` and `Authorization: Bearer`, reuses settings-page keys and refreshes their last-used timestamp
- **Scope filtering**: `tools/list` is filtered by key scopes, with a new `content.read` scope; `whoami` reports the current key identity and scopes
- **Hostname allowlist**: Host and Origin validation blocks DNS rebinding attacks; custom domains are enabled through `MCP_ALLOWED_HOSTS`
- **Deploy integration**: the deploy command writes `FRONTEND_URL` and `MCP_ALLOWED_HOSTS` into the worker variables

## Tools and scopes

| Tool | Required scope | Description |
| --- | --- | --- |
| `whoami` | any valid key | Returns the key ID, account ID, scopes and available tools |
| `list_posts` / `get_post` / `search_posts` | `content.read` | List, read and search articles (drafts and unlisted posts included) |
| `list_tags` / `list_moments` / `list_friends` | `content.read` | List tags, moments and friend links |
| `create_post` / `update_post` / `delete_post` | `feed.write` | Create (draft by default), update and delete articles |
| `create_moment` / `update_moment` / `delete_moment` | `moment.write` | Create, update and delete moments |
| `create_friend` / `update_friend` / `delete_friend` | `friend.write` | Create, update and delete friend links |
| `get_config` / `update_config` | matching `config.*` | Read and write settings sections; out-of-scope keys are rejected |

Section scopes are `config.site`, `config.personalization`, `config.other`, `config.comment`, `config.supportly`, `config.webhook`, `config.friend`, `config.maintenance` and `config.ai`. The section you read or write must match the key scopes, and `update_config` reports the rejected key names when a payload carries keys outside the allowed section.

## Quick start

### 1. Create an API key

Open **Settings → API Key**, create a key and select the scopes you need. Use `content.read` for read-only access and add `feed.write` when the client should manage articles.

### 2. Configure the client

Claude Code:

```bash
claude mcp add --transport http rin https://<site-domain>/mcp \
  --header "X-API-Key: <key>"
```

Generic JSON configuration:

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://<site-domain>/mcp",
      "headers": {
        "X-API-Key": "<key>"
      }
    }
  }
}
```

### 3. Verify connectivity

```bash
curl -i -X POST https://<site-domain>/mcp \
  -H "X-API-Key: <key>" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"probe","version":"1.0.0"}}}'
```

A `200` response with `"name":"rin"` in `serverInfo` means the handshake succeeded. A missing key answers `401 Missing API key`, an unknown key answers `401 Invalid API key`.

## Custom domains, 421 and 403

When the site runs on a custom domain (for example `jiaoblog.dpdns.org`), verify both layers, otherwise the client fails during the handshake:

1. **Cloudflare must route the domain**: attach the domain to the worker as a Custom Domain or a Route. A CNAME to `*.workers.dev` is not enough, and the request is rejected at the edge with `421 Misdirected Request` before it reaches the worker.
2. **The app must allow the hostname**: add the domain to `MCP_ALLOWED_HOSTS`, or point `FRONTEND_URL` at the site origin. Otherwise the server answers `403` with `Invalid Host: <hostname>`.

| Symptom | Source | Fix |
| --- | --- | --- |
| `421 Misdirected Request` | Cloudflare edge, Host not matched to a worker domain or route | Configure a Custom Domain or Route in the Cloudflare dashboard |
| `403` with `Invalid Host` | Server-side DNS rebinding protection | Configure `MCP_ALLOWED_HOSTS` or `FRONTEND_URL`, then redeploy |

Example configuration (`.env` or deploy environment variables):

```bash
FRONTEND_URL=https://jiaoblog.dpdns.org
MCP_ALLOWED_HOSTS=jiaoblog.dpdns.org,www.jiaoblog.dpdns.org
```

Allowlist entries accept a scheme or port (`https://jiaoblog.dpdns.org:443`), wildcard domains (`*.dpdns.org`) and `*` (disables the hostname allowlist; internal networks and trusted proxies only). A redeploy applies the change, and no database migration is required.

## Behavior notes

- Every HTTP request creates a fresh MCP instance and nothing is stored between requests, avoiding cross-user data leaks
- Written content belongs to the administrator account (uid = 1) and follows the existing article, moment and friend-link models
- Writes clear the article, search and moment caches so list pages update immediately
- `get_config` returns only the `ai_summary.api_key_set` boolean for the AI section and never exposes the key itself

## Upgrade notes

- Running sites: pull the code, configure `FRONTEND_URL` / `MCP_ALLOWED_HOSTS` when needed, then redeploy
- Sites reachable only through `*.workers.dev` or localhost need no extra allowlist entries
- This release adds no database migrations, so existing data needs no handling

See the [changelog](../guide/changelog) for the full change list and the [API guide](../guide/api-guide) for tool parameters and debugging details.

## Feedback

If you find issues while validating `yjv-1.0.2`, report them through:

- 🐛 [Yangjiao Express Secondary Development Edition issues](https://github.com/wool-hmq/Rin/issues)
- 💬 [Yangjiao Express Secondary Development Edition discussions](https://github.com/wool-hmq/Rin/discussions)
- 📖 Official upstream issues: [openRin/Rin issues](https://github.com/openRin/Rin/issues)
- 💬 Official upstream discussions: [openRin/Rin discussions](https://github.com/openRin/Rin/discussions)
