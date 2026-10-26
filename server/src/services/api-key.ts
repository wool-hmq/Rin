import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { apiKeys } from "../db/schema";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors";
import {
    API_KEY_SCOPES,
    API_KEY_SCOPE_NAMES,
    API_KEY_TYPE_MCP,
    API_KEY_TYPE_REST,
    getApiKeyScopesForType,
    isApiKeyScope,
    type ApiKeyType,
} from "../utils/api-key-scopes";
import { generateApiKey, hashApiKey, encryptApiKey, decryptApiKey } from "../utils/api-key";

const MAX_KEYS_PER_USER = 20;

function parseScopes(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((item): item is string => typeof item === "string");
    } catch {
        return [];
    }
}

function parseKeyType(raw: unknown, fallback: ApiKeyType = API_KEY_TYPE_REST): ApiKeyType {
    if (raw === undefined || raw === null || raw === "") {
        return fallback;
    }
    const value = typeof raw === "number" ? raw : Number(raw);
    if (value === API_KEY_TYPE_REST) {
        return API_KEY_TYPE_REST;
    }
    if (value === API_KEY_TYPE_MCP) {
        return API_KEY_TYPE_MCP;
    }
    throw new BadRequestError("type must be 1 (API) or 2 (MCP)");
}

function normalizeScopes(input: unknown, type: ApiKeyType): string[] {
    if (!Array.isArray(input)) {
        throw new BadRequestError("scopes must be an array");
    }
    const allowed = new Set(getApiKeyScopesForType(type).map((item) => item.scope));
    const result: string[] = [];
    for (const item of input) {
        if (typeof item !== "string" || !isApiKeyScope(item)) {
            throw new BadRequestError(`Unknown scope: ${String(item)}`);
        }
        if (!allowed.has(item)) {
            throw new BadRequestError(`Scope ${item} is not available for this key type`);
        }
        if (!result.includes(item)) {
            result.push(item);
        }
    }
    if (result.length === 0) {
        throw new BadRequestError("At least one scope is required");
    }
    return result;
}

function serializeKey(row: {
    id: number;
    name: string;
    visible: number;
    key_type: number;
    scopes: string;
    last_used_at: number | null;
    createdAt: Date;
    updatedAt: Date;
}, plaintext: string | null) {
    return {
        id: row.id,
        name: row.name,
        visible: row.visible === 1,
        type: row.key_type,
        scopes: parseScopes(row.scopes),
        last_used_at: row.last_used_at,
        created_at: row.createdAt,
        updated_at: row.updatedAt,
        key: plaintext,
    };
}

export function ApiKeyService(): Hono {
    const app = new Hono();
    // Mounted at /api/key/manage: these endpoints manage keys themselves and
    // require an administrator, while /api/key/* is authenticated by the key.

    // GET /api/key/manage - List the current user's keys
    app.get("/", async (c: AppContext) => {
        const uid = c.get("uid");
        const db = c.get("db");
        const env = c.get("env");

        if (!uid) {
            throw new ForbiddenError("Authentication required");
        }
        if (!c.get("admin")) {
            throw new ForbiddenError("Administrator permission required");
        }

        const typeParam = c.req.query("type");
        const type = typeParam ? parseKeyType(typeParam) : undefined;

        const rows = await profileAsync(c, "api_key_list", () => db.query.apiKeys.findMany({
            where: type === undefined
                ? eq(apiKeys.uid, uid)
                : and(eq(apiKeys.uid, uid), eq(apiKeys.key_type, type)),
            orderBy: (table, { desc }) => [desc(table.createdAt)],
        }));

        const items = await Promise.all(rows.map(async (row) => {
            let plaintext: string | null = null;
            if (row.visible === 1 && row.key_encrypted) {
                plaintext = await decryptApiKey(row.key_encrypted, env.JWT_SECRET);
            }
            return serializeKey(row, plaintext);
        }));

        return c.json({ success: true, keys: items });
    });

    // GET /api/key/manage/scopes - Available scopes for the settings UI
    app.get("/scopes", async (c: AppContext) => {
        const typeParam = c.req.query("type");
        const type = typeParam ? parseKeyType(typeParam) : undefined;
        const source = type === undefined ? API_KEY_SCOPES : getApiKeyScopesForType(type);
        return c.json({
            success: true,
            type: type ?? null,
            scopes: source.map((item) => ({
                scope: item.scope,
                title: item.title,
                description: item.description,
            })),
        });
    });

    // POST /api/key/manage - Create a new key
    app.post("/", async (c: AppContext) => {
        const uid = c.get("uid");
        const db = c.get("db");
        const env = c.get("env");

        if (!uid) {
            throw new ForbiddenError("Authentication required");
        }
        if (!c.get("admin")) {
            throw new ForbiddenError("Administrator permission required");
        }

        const body = await c.req.json() as {
            name?: unknown;
            scopes?: unknown;
            visible?: unknown;
            type?: unknown;
        };

        const name = typeof body.name === "string" ? body.name.trim() : "";
        if (!name || name.length > 64) {
            throw new BadRequestError("name is required and must be at most 64 characters");
        }

        const type = parseKeyType(body.type);
        const scopes = normalizeScopes(body.scopes, type);
        const visible = body.visible === true || body.visible === "true";

        const existing = await profileAsync(c, "api_key_count", () => db.query.apiKeys.findMany({
            where: eq(apiKeys.uid, uid),
            columns: { id: true },
        }));
        if (existing.length >= MAX_KEYS_PER_USER) {
            throw new BadRequestError(`At most ${MAX_KEYS_PER_USER} keys are allowed`);
        }

        const plaintext = generateApiKey();
        const keyHash = await hashApiKey(plaintext);
        const keyEncrypted = await encryptApiKey(plaintext, env.JWT_SECRET);

        const inserted = await profileAsync(c, "api_key_insert", () => db.insert(apiKeys).values({
            uid,
            name,
            key_hash: keyHash,
            key_encrypted: keyEncrypted,
            visible: visible ? 1 : 0,
            key_type: type,
            scopes: JSON.stringify(scopes),
        }).returning());

        const row = inserted[0];
        if (!row) {
            throw new ConflictError("Failed to create API key");
        }

        return c.json({
            success: true,
            key: serializeKey(row, visible ? plaintext : null),
            // Always returned once on creation so encrypted keys can be copied.
            plaintext: plaintext,
        });
    });

    // POST /api/key/manage/:id - Update name, scopes, or visibility
    app.post("/:id", async (c: AppContext) => {
        const uid = c.get("uid");
        const db = c.get("db");
        const env = c.get("env");

        if (!uid) {
            throw new ForbiddenError("Authentication required");
        }
        if (!c.get("admin")) {
            throw new ForbiddenError("Administrator permission required");
        }

        const id = Number(c.req.param("id"));
        if (!Number.isInteger(id)) {
            throw new BadRequestError("Invalid key id");
        }

        const existing = await profileAsync(c, "api_key_lookup", () => db.query.apiKeys.findFirst({
            where: and(eq(apiKeys.id, id), eq(apiKeys.uid, uid)),
        }));
        if (!existing) {
            throw new NotFoundError("API key");
        }

        const body = await c.req.json() as {
            name?: unknown;
            scopes?: unknown;
            visible?: unknown;
            type?: unknown;
        };

        const existingType = parseKeyType(existing.key_type);
        if (body.type !== undefined && parseKeyType(body.type) !== existingType) {
            throw new BadRequestError("Key type cannot be changed after creation");
        }

        const updates: Partial<typeof apiKeys.$inferInsert> = {};

        if (body.name !== undefined) {
            const name = typeof body.name === "string" ? body.name.trim() : "";
            if (!name || name.length > 64) {
                throw new BadRequestError("name must be 1-64 characters");
            }
            updates.name = name;
        }

        if (body.scopes !== undefined) {
            updates.scopes = JSON.stringify(normalizeScopes(body.scopes, existingType));
        }

        const wantsVisible = body.visible === true || body.visible === "true";
        // Storage mode is fixed at creation. A revealable key may stop being
        // revealable, but an encrypted key can never become revealable: the
        // plaintext was only ever shown once and is not retained in that mode.
        if (body.visible !== undefined && !wantsVisible && existing.visible === 1) {
            updates.visible = 0;
        }
        if (wantsVisible && existing.visible !== 1) {
            throw new BadRequestError(
                "Encrypted keys cannot be made revealable; create a new key instead",
            );
        }

        if (Object.keys(updates).length === 0) {
            return c.json({ success: true, key: serializeKey(existing, null) });
        }

        updates.updatedAt = new Date();

        const updated = await profileAsync(c, "api_key_update", () => db.update(apiKeys)
            .set(updates)
            .where(and(eq(apiKeys.id, id), eq(apiKeys.uid, uid)))
            .returning());

        const row = updated[0];
        if (!row) {
            throw new NotFoundError("API key");
        }

        let plaintext: string | null = null;
        if (row.visible === 1 && row.key_encrypted) {
            plaintext = await decryptApiKey(row.key_encrypted, env.JWT_SECRET);
        }

        return c.json({ success: true, key: serializeKey(row, plaintext) });
    });

    // POST /api/key/manage/:id/rotate - Replace the secret, keeping name and scopes
    app.post("/:id/rotate", async (c: AppContext) => {
        const uid = c.get("uid");
        const db = c.get("db");
        const env = c.get("env");

        if (!uid) {
            throw new ForbiddenError("Authentication required");
        }
        if (!c.get("admin")) {
            throw new ForbiddenError("Administrator permission required");
        }

        const id = Number(c.req.param("id"));
        if (!Number.isInteger(id)) {
            throw new BadRequestError("Invalid key id");
        }

        const existing = await profileAsync(c, "api_key_lookup", () => db.query.apiKeys.findFirst({
            where: and(eq(apiKeys.id, id), eq(apiKeys.uid, uid)),
        }));
        if (!existing) {
            throw new NotFoundError("API key");
        }

        const plaintext = generateApiKey();
        const keyHash = await hashApiKey(plaintext);
        const keyEncrypted = await encryptApiKey(plaintext, env.JWT_SECRET);

        const updated = await profileAsync(c, "api_key_rotate", () => db.update(apiKeys)
            .set({
                key_hash: keyHash,
                key_encrypted: keyEncrypted,
                last_used_at: null,
                updatedAt: new Date(),
            })
            .where(and(eq(apiKeys.id, id), eq(apiKeys.uid, uid)))
            .returning());

        const row = updated[0];
        if (!row) {
            throw new NotFoundError("API key");
        }

        return c.json({
            success: true,
            key: serializeKey(row, row.visible === 1 ? plaintext : null),
            plaintext: plaintext,
        });
    });

    // DELETE /api/key/manage/:id - Revoke a key
    app.delete("/:id", async (c: AppContext) => {
        const uid = c.get("uid");
        const db = c.get("db");

        if (!uid) {
            throw new ForbiddenError("Authentication required");
        }
        if (!c.get("admin")) {
            throw new ForbiddenError("Administrator permission required");
        }

        const id = Number(c.req.param("id"));
        if (!Number.isInteger(id)) {
            throw new BadRequestError("Invalid key id");
        }

        const deleted = await profileAsync(c, "api_key_delete", () => db.delete(apiKeys)
            .where(and(eq(apiKeys.id, id), eq(apiKeys.uid, uid)))
            .returning({ id: apiKeys.id }));

        if (deleted.length === 0) {
            throw new NotFoundError("API key");
        }

        return c.json({ success: true });
    });

    return app;
}

export { API_KEY_SCOPE_NAMES };
