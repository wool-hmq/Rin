---
pageType: doc
sidebar: false
---

# Secondary edition yjv1.0.3: REST API keys and MCP keys split apart

**Release date**: October 26, 2026

This release splits key management for the REST API and MCP into two independent key types. Previously both call paths shared one set of keys and scopes, so a key created for scripted automation could also call the MCP endpoint. Each key now works with exactly one kind of endpoint, and the settings page lists and creates them separately.

## Key types

| Type | `key_type` | Endpoints | Typical use |
| --- | --- | --- | --- |
| REST API key | `1` | `/api/key/*` | External scripts, scheduled jobs, automation |
| MCP key | `2` | `/mcp` | MCP clients such as Claude Code, Cursor and MCP Inspector |

- The type is fixed at creation and cannot be changed; create a new key for the other type
- Each tab only lists its own keys, so the lists never mix
- The per-account limit stays at 20 keys and counts both types together

## Scope changes

`content.read` was introduced for the MCP read tools, so only MCP keys can hold it:

- **REST API keys**: `feed.write`, `moment.write`, `friend.write` and the `config.*` scopes
- **MCP keys**: everything above plus `content.read`

The create dialog lists only the scopes allowed for the selected type, and the server rejects out-of-bounds selections with `400`.

## Endpoint isolation

A key type that does not match the endpoint is rejected during authentication, before any business logic runs:

```bash
# REST API key calling /mcp
curl -i -X POST https://your-site/mcp -H "X-API-Key: <rest-key>"
# HTTP/1.1 403
# {"success":false,"error":"This key is for the REST API; create an MCP key to call /mcp"}

# MCP key calling /api/key/help
curl -i https://your-site/api/key/help -H "X-API-Key: <mcp-key>"
# HTTP/1.1 403
# {"success":false,"error":"This key is for MCP; create an API key to call /api/key"}
```

| Status | Meaning |
| --- | --- |
| `401` | Missing, invalid, rotated or deleted key |
| `403` | Valid key without the required scope, or a key type that does not match the endpoint |

## Database change

The `api_keys` table gains one column:

```sql
ALTER TABLE `api_keys` ADD `key_type` integer DEFAULT 1 NOT NULL;
```

Migration `0021.sql` also classifies existing keys:

- Keys whose scopes include `content.read` become `key_type = 2` (MCP keys)
- Every other key becomes `key_type = 1` (REST API keys)

The rule covers MCP keys created since yjv1.0.2, so existing MCP clients keep working after the upgrade without recreating keys. A key that served both scripts and MCP clients keeps only one capability, so split it by purpose.

## Version numbering

Starting with this release, the edition's `yjvX.Y.Z` numbers follow the size of a change:

1. **Major update**: many features or a full refactor, `X` increases and `Y`/`Z` reset
2. **Regular update**: one or two features or several small ones, `Y` increases and `Z` resets
3. **Patch**: fixes and small changes, `Z` increases

This change is a patch, so the version moves from `yjv1.0.2` to `yjv1.0.3`.

## Upgrade notes

- Pull the code and redeploy; the migration runs as part of the deploy flow
- Existing MCP clients need no config changes unless their key also has write scopes shared with scripts
- If a client reports `403`, check that the key's tab matches the endpoint

See the [API guide](../guide/api-guide) for endpoint details and the [changelog](../guide/changelog) for the full list of changes.

## Feedback

- Secondary edition issues: <https://github.com/wool-hmq/Rin/issues>
- Secondary edition discussions: <https://github.com/wool-hmq/Rin/discussions>
- Official upstream issues: <https://github.com/openRin/Rin/issues>
