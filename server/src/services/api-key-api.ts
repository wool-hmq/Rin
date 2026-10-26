import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { apiKeyAuthMiddleware } from "../core/api-key-middleware";
import { API_KEY_SCOPES, API_KEY_TYPE_REST } from "../utils/api-key-scopes";
import { ApiKeyFeedService } from "./api-key-feed";
import { ApiKeyFriendService } from "./api-key-friend";
import { ApiKeyMomentService } from "./api-key-moment";
import { ApiKeyConfigService } from "./api-key-config";

export function ApiKeyApiService(): Hono {
    const app = new Hono();

    app.use("*", apiKeyAuthMiddleware({ keyType: API_KEY_TYPE_REST }));

    // GET /api/key/help - Scopes and usage of the calling key
    app.get("/help", (c: AppContext) => {
        const scopes = c.get("apiKeyScopes") ?? [];
        const available = API_KEY_SCOPES
            .filter((item) => scopes.includes(item.scope))
            .map((item) => ({
                scope: item.scope,
                title: item.title,
                description: item.description,
                endpoints: item.endpoints,
            }));

        return c.json({
            success: true,
            key_id: c.get("apiKeyId"),
            scopes,
            permissions: available,
            base_path: "/api/key",
        });
    });

    app.route("/feed", ApiKeyFeedService());
    app.route("/friend", ApiKeyFriendService());
    app.route("/moment", ApiKeyMomentService());
    app.route("/config", ApiKeyConfigService());

    return app;
}
