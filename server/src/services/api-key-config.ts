import { Hono } from "hono";
import { wrapTime } from "hono/timing";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { requireScope } from "../core/api-key-middleware";
import { BadRequestError, NotFoundError } from "../errors";
import { getAIConfig, setAIConfig } from "../utils/db-config";
import { testAIModel } from "../utils/ai";
import { notify } from "../utils/webhook";
import {
    persistRegularConfig,
    resolveWebhookConfig,
    splitConfigPayload,
} from "./config-helpers";
import {
    isAllowedConfigKey,
    resolveApiKeyConfigSection,
} from "../utils/api-key-config-sections";

// Server-side sections are read from serverConfig, client-side ones from
// clientConfig. The AI section merges ai_summary.* keys from serverConfig.
function sectionConfigKeys(section: NonNullable<ReturnType<typeof resolveApiKeyConfigSection>>) {
    const clientKeys = [...section.clientKeys];
    const serverKeys = [...section.serverKeys];
    return { clientKeys, serverKeys };
}

export function ApiKeyConfigService(): Hono {
    const app = new Hono();

    function resolveSection(c: AppContext) {
        const name = c.req.param("section");
        const section = resolveApiKeyConfigSection(name);
        if (!section) {
            throw new NotFoundError(`Unknown config section: ${name}`);
        }
        return { name, section };
    }

    // GET /api/key/config/:section - Read the config keys in this section
    app.get("/:section", requireScope("config.site", async (c: AppContext) => {
        const { name, section } = resolveSection(c);
        const scopes = c.get("apiKeyScopes") ?? [];
        if (!scopes.includes(section.scope)) {
            return c.json({
                success: false,
                error: `This API key is missing the "${section.scope}" scope`,
            }, 403);
        }

        const clientConfig = c.get("clientConfig");
        const serverConfig = c.get("serverConfig");

        const clientValues: Record<string, unknown> = {};
        for (const key of section.clientKeys) {
            clientValues[key] = await clientConfig.get(key);
        }

        const serverValues: Record<string, unknown> = {};
        for (const key of section.serverKeys) {
            serverValues[key] = await serverConfig.get(key);
        }

        let aiValues: Record<string, unknown> | undefined;
        if (section.includeAI) {
            const aiConfig = await getAIConfig(serverConfig);
            aiValues = {
                "ai_summary.enabled": aiConfig.enabled,
                "ai_summary.provider": aiConfig.provider,
                "ai_summary.model": aiConfig.model,
                "ai_summary.api_url": aiConfig.api_url,
                "ai_summary.retries": aiConfig.retries,
                "ai_summary.failover": aiConfig.failover,
                "ai_summary.api_key_set": aiConfig.api_key.length > 0,
                "ai_search.enabled": serverValues["ai_search.enabled"],
            };
        }

        return c.json({
            success: true,
            section: name,
            scope: section.scope,
            client: clientValues,
            server: serverValues,
            ...(aiValues ? { ai: aiValues } : {}),
        });
    }));

    // POST /api/key/config/:section - Update config keys in this section
    app.post("/:section", async (c: AppContext) => {
        const { section } = resolveSection(c);
        const scopes = c.get("apiKeyScopes") ?? [];
        if (!scopes.includes(section.scope)) {
            return c.json({
                success: false,
                error: `This API key is missing the "${section.scope}" scope`,
            }, 403);
        }

        const body = await c.req.json() as Record<string, unknown>;
        const clientConfig = c.get("clientConfig");
        const serverConfig = c.get("serverConfig");

        const rejected: string[] = [];
        const clientUpdates: Record<string, unknown> = {};
        const serverUpdates: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(body)) {
            if (!isAllowedConfigKey(section, key)) {
                rejected.push(key);
                continue;
            }
            if (section.clientKeys.includes(key)) {
                clientUpdates[key] = value;
            } else {
                serverUpdates[key] = value;
            }
        }

        if (rejected.length > 0) {
            throw new BadRequestError(
                `These keys are not writable with the "${section.scope}" scope: ${rejected.join(", ")}`,
            );
        }

        if (Object.keys(clientUpdates).length === 0 && Object.keys(serverUpdates).length === 0) {
            throw new BadRequestError("No writable config keys provided");
        }

        const { regularConfig: regularClient } = splitConfigPayload(clientUpdates);
        const { regularConfig: regularServer, aiConfigUpdates } = splitConfigPayload(serverUpdates);

        await profileAsync(c, "api_config_persist", async () => {
            if (Object.keys(regularClient).length > 0) {
                await persistRegularConfig(clientConfig, regularClient);
            }
            if (Object.keys(regularServer).length > 0) {
                await persistRegularConfig(serverConfig, regularServer);
            }
            if (Object.keys(aiConfigUpdates).length > 0) {
                await setAIConfig(serverConfig, aiConfigUpdates);
            }
        });

        return c.json({ success: true, updated: Object.keys(body) });
    });

    // POST /api/key/config/webhook/test - Trigger a test webhook
    app.post("/webhook/test", requireScope("config.webhook", async (c: AppContext) => {
        const env = c.get("env");
        const serverConfig = c.get("serverConfig");
        const body = await wrapTime(c, "request_body", c.req.json()) as {
            "webhook_url"?: string;
            "webhook.method"?: string;
            "webhook.content_type"?: string;
            "webhook.headers"?: string;
            "webhook.body_template"?: string;
            test_message?: string;
        };

        const resolved = await wrapTime(c, "webhook_config", resolveWebhookConfig(serverConfig, env, body));

        if (!resolved.webhookUrl?.trim()) {
            return c.json({ success: false, error: "Webhook URL is required" }, 400);
        }

        const frontendUrl = new URL(c.req.url).origin;
        const testMessage = body.test_message?.trim() || "This is a test webhook message from Rin API.";

        try {
            const response = await wrapTime(c, "webhook_send", notify(
                resolved.webhookUrl as string,
                {
                    event: "webhook.test",
                    message: testMessage,
                    title: "Webhook Test",
                    url: `${frontendUrl}/admin/settings`,
                    username: "api-key",
                    content: testMessage,
                    description: "Webhook test triggered through the API key endpoint.",
                },
                {
                    method: resolved.webhookMethod,
                    contentType: resolved.webhookContentType,
                    headers: resolved.webhookHeaders,
                    bodyTemplate: resolved.webhookBodyTemplate,
                },
            ));

            if (!response) {
                return c.json({ success: false, error: "Webhook request was not sent" }, 400);
            }
            if (!response.ok) {
                const details = await response.text();
                return c.json({
                    success: false,
                    error: `Webhook test failed with status ${response.status}`,
                    details,
                }, 400);
            }
            return c.json({ success: true });
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return c.json({ success: false, error: message }, 400);
        }
    }));

    // DELETE /api/key/config/cache - Clear the cache (maintenance scope)
    app.delete("/cache", requireScope("config.maintenance", async (c: AppContext) => {
        const cache = c.get("cache");
        await cache.clear();
        return c.json({ success: true });
    }));

    return app;
}

export { sectionConfigKeys };
