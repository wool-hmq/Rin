---
pageType: doc
sidebar: false
---

# Secondary edition yjv1.1: dual friend-link verification, MCP server and separate key types

**Release date**: October 26, 2026

**Status**: Stable

This page collects every change in the `yjv1.1` line, covering `1.1.0`, `1.1.1` and `1.1.2`. Patches within the same line are merged into this page instead of adding new announcements; a new page is created only when a new line (such as `1.2`) starts.

## Releases in this line

| Version | Type | Highlights |
| --- | --- | --- |
| `1.1.0` | Regular update | Friend-link verification supports DNS TXT and HTML file uploads |
| `1.1.1` | Regular update | A `/mcp` server for external AI clients |
| `1.1.2` | Patch | REST API keys and MCP keys are split into separate types |

## 1.1.0 Two friend-link verification methods

After an application passes JSON validation, the bot enters the `awaiting_method_choice` stage and asks the applicant to choose:

- Reply `1` (also `一` / `方案一` / `方法一`) for a DNS TXT record
- Reply `2` (also `二` / `方案二` / `方法二`) to upload an HTML file

For DNS, the instructions list host `_jiaofriend`, type `TXT` and the verification code as the value; verification queries the TXT records of `_jiaofriend.<visitor-domain>` through Cloudflare DNS-over-HTTPS and checks whether one contains the code. The file method keeps the strict check: the GET must return 200 and the `<body>` text, after stripping tags and scripts, must contain the code.

The state machine gains an `awaiting_verification` stage and records `verifyMethod`; a modify application asks for the method again for the old and the new site; pre-upgrade `verifying` states fall back to file verification. DNS lookups go through the injectable dependency `resolveTxt(name) => Promise<string[]>`, which keeps the resolver testable and replaceable.

This release also fixes friend-link verification accepting SPA fallbacks, custom 404 pages, 403/500 responses and 30x redirects, plus `/friends-sitemap.xml` being swallowed by the frontend router, viewing a key turning encrypted storage into plaintext, repeated captcha initialization crashing applications, and inbound email parsing under CJS / ESM bundles.

## 1.1.1 MCP server

The site adds an `/mcp` endpoint that exposes articles, moments, friend links and site settings through MCP (Model Context Protocol), so Claude Code, Cursor, Claude Desktop and MCP Inspector can read and maintain content.

- **Transport**: Streamable HTTP, with a fresh instance per request and no state shared across requests
- **Authentication**: `X-API-Key` or `Authorization: Bearer`, reusing settings-page keys and refreshing their last-used timestamp
- **Scope filtering**: `tools/list` is filtered by key scopes, with the new `content.read` scope
- **Safety checks**: Host and Origin validation blocks DNS rebinding, and custom domains are enabled through `MCP_ALLOWED_HOSTS`

| Tool | Required scope | Purpose |
| --- | --- | --- |
| `whoami` | any valid key | Returns the key ID, account ID, scopes and available tools |
| `list_posts` / `get_post` / `search_posts` | `content.read` | List, read and search articles (drafts and unlisted posts included) |
| `list_tags` / `list_moments` / `list_friends` | `content.read` | List tags, moments and friend links |
| `create_post` / `update_post` / `delete_post` | `feed.write` | Create (draft by default), update and delete articles |
| `create_moment` / `update_moment` / `delete_moment` | `moment.write` | Create, update and delete moments |
| `create_friend` / `update_friend` / `delete_friend` | `friend.write` | Create, update and delete friend links |
| `get_config` / `update_config` | matching `config.*` | Read and write settings sections; out-of-scope keys are rejected |

Client configuration example:

```json
{
  "mcpServers": {
    "rin": {
      "type": "http",
      "url": "https://<site-domain>/mcp",
      "headers": {
        "X-API-Key": "<mcp-key>"
      }
    }
  }
}
```

On a custom domain, attach the domain to the worker as a Custom Domain or Route in Cloudflare, and add the domain to `MCP_ALLOWED_HOSTS` (or set `FRONTEND_URL` to the site origin). `421 Misdirected Request` comes from the Cloudflare edge while `403 Invalid Host` comes from the server allowlist; see the [API guide](../guide/api-guide) for both.

## 1.1.2 REST API keys and MCP keys split apart

Both endpoints used to share one set of keys and scopes, so a key created for scripted automation could also call the MCP endpoint. Keys are now split into two types:

| Type | `key_type` | Endpoints | Typical use |
| --- | --- | --- | --- |
| REST API key | `1` | `/api/key/*` | External scripts, scheduled jobs, automation |
| MCP key | `2` | `/mcp` | MCP clients such as Claude Code, Cursor and MCP Inspector |

- The type is fixed at creation, and the settings page lists and creates keys under separate REST API and MCP tabs
- A type that does not match the endpoint is rejected during authentication with `403`, before any business logic runs
- `content.read` is available to MCP keys only; REST API keys select `feed.write`, `moment.write`, `friend.write` and the `config.*` scopes

The database gains a `key_type` column, and migration `0021.sql` classifies existing keys automatically: keys whose scopes include `content.read` become MCP keys and the rest become REST API keys. Existing MCP clients keep working after the upgrade without recreating keys; a key that served both scripts and MCP clients keeps only one capability, so split it by purpose.

## Version status and numbering

The edition uses its own `yjvX.Y.Z` line, incremented by the size of a change:

1. **Major update**: many features or a full refactor, `X` increases and the lower numbers reset
2. **Regular update**: one or two features or several small ones, `Y` increases and `Z` resets
3. **Patch**: fixes and small changes, `Z` increases

Pages follow the line: patches within a line are merged into that line's page. When a new line starts, the previous line is marked **Stable** and the new one **Beta**; for example, when `1.2` starts, `1.1` is stable and `1.2` is beta. `1.1` is currently stable.

## Upgrade notes

- Pull the code and redeploy; migrations run as part of the deploy flow with no manual step
- Custom-domain sites must set `MCP_ALLOWED_HOSTS`, otherwise the MCP handshake returns `403`
- Existing keys are classified automatically; if a client reports `403`, check that the key's tab matches the endpoint

See the [API guide](../guide/api-guide) for endpoint details and the [changelog](../guide/changelog) for the full list of changes.

## Feedback

- Secondary edition issues: <https://github.com/wool-hmq/Rin/issues>
- Secondary edition discussions: <https://github.com/wool-hmq/Rin/discussions>
- Official upstream issues: <https://github.com/openRin/Rin/issues>
