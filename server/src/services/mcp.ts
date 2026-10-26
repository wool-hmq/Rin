import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { apiKeyAuthMiddleware } from "../core/api-key-middleware";
import { guardMcpRequest } from "../features/mcp/guard";
import { createRinMcpHandler } from "../features/mcp/server";

export function McpService(): Hono {
    const app = new Hono();

    app.use("*", async (c: AppContext, next) => {
        const rejected = guardMcpRequest(c.req.raw, c.get("env"));
        if (rejected) {
            return rejected;
        }
        return next();
    });

    app.use("*", apiKeyAuthMiddleware());

    app.all("/", async (c: AppContext) => {
        const env = c.get("env");
        const request = c.req.raw;

        const scopes = c.get("apiKeyScopes") ?? [];
        const keyId = c.get("apiKeyId") ?? 0;

        const handler = createRinMcpHandler({
            db: c.get("db"),
            cache: c.get("cache"),
            serverConfig: c.get("serverConfig"),
            clientConfig: c.get("clientConfig"),
            env,
            scopes,
            keyId,
            uid: c.get("uid") ?? 0,
        });

        return handler.fetch(request, {
            authInfo: {
                token: "",
                clientId: `api-key-${keyId}`,
                scopes,
            },
        });
    });

    return app;
}
