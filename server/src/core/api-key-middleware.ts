import { Hono } from "hono";
import type { MiddlewareHandler } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { apiKeys } from "../db/schema";
import { hashApiKey } from "../utils/api-key";

function readApiKey(c: AppContext): string | null {
    const header = c.req.header("X-API-Key") || c.req.header("x-api-key");
    if (header) {
        return header.trim();
    }
    const auth = c.req.header("Authorization") || c.req.header("authorization");
    if (auth && auth.startsWith("Bearer ")) {
        return auth.slice(7).trim();
    }
    return null;
}

export function apiKeyAuthMiddleware(): MiddlewareHandler<{
    Bindings: Env;
    Variables: import("../core/hono-types").Variables;
}> {
    return async (c, next) => {
        const raw = readApiKey(c as AppContext);
        if (!raw) {
            return c.json({ success: false, error: "Missing API key" }, 401);
        }

        const db = (c as AppContext).get("db");
        const keyHash = await hashApiKey(raw);

        const row = await profileAsync(c as AppContext, "api_key_auth", () => db.query.apiKeys.findFirst({
            where: eq(apiKeys.key_hash, keyHash),
        }));

        if (!row) {
            return c.json({ success: false, error: "Invalid API key" }, 401);
        }

        let scopes: string[] = [];
        try {
            const parsed = JSON.parse(row.scopes);
            if (Array.isArray(parsed)) {
                scopes = parsed.filter((item: unknown): item is string => typeof item === "string");
            }
        } catch {
            scopes = [];
        }

        (c as AppContext).set("uid", row.uid);
        (c as AppContext).set("apiKeyId", row.id);
        (c as AppContext).set("apiKeyScopes", scopes);

        const now = new Date();
        await profileAsync(c as AppContext, "api_key_touch", () => db.update(apiKeys)
            .set({ last_used_at: Math.floor(now.getTime() / 1000) })
            .where(and(eq(apiKeys.id, row.id))));

        await next();
    };
}

export function requireScope(scope: string, handler: (c: AppContext) => Response | Promise<Response>) {
    return async (c: AppContext) => {
        const scopes = c.get("apiKeyScopes") ?? [];
        if (!scopes.includes(scope)) {
            return c.json({
                success: false,
                error: `This API key is missing the "${scope}" scope`,
            }, 403);
        }
        return handler(c);
    };
}
