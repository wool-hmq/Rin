import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { requireScope } from "../core/api-key-middleware";
import { BadRequestError, NotFoundError } from "../errors";
import { moments } from "../db/schema";
import { parseApiKeyId } from "./api-key-feed";
import { API_KEY_CONTENT_OWNER_UID } from "./api-key-owner";

export function ApiKeyMomentService(): Hono {
    const app = new Hono();

    // POST /api/key/moment - Publish a moment
    app.post("/", requireScope("moment.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");

        const body = await c.req.json() as { content?: unknown };
        const content = typeof body.content === "string" ? body.content : "";

        if (!content.trim()) {
            throw new BadRequestError("content is required");
        }

        const date = new Date();
        const result = await profileAsync(c, "api_moment_create", () => db.insert(moments).values({
            content,
            uid: API_KEY_CONTENT_OWNER_UID,
            createdAt: date,
            updatedAt: date,
        }).returning({ insertedId: moments.id }));

        await profileAsync(c, "api_moment_create_cache", () => cache.deletePrefix("moments_"));

        return c.json({ success: true, id: result[0]?.insertedId });
    }));

    // POST /api/key/moment/:id - Edit a moment
    app.post("/:id", requireScope("moment.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Moment");
        }

        const moment = await profileAsync(c, "api_moment_lookup", () => db.query.moments.findFirst({
            where: eq(moments.id, id),
        }));
        if (!moment) {
            throw new NotFoundError("Moment");
        }

        const body = await c.req.json() as { content?: unknown };
        const content = typeof body.content === "string" ? body.content : "";
        if (!content.trim()) {
            throw new BadRequestError("content is required");
        }

        await profileAsync(c, "api_moment_update", () => db.update(moments).set({
            content,
            updatedAt: new Date(),
        }).where(eq(moments.id, id)));

        await profileAsync(c, "api_moment_update_cache", () => cache.deletePrefix("moments_"));

        return c.json({ success: true, id });
    }));

    // DELETE /api/key/moment/:id - Delete a moment
    app.delete("/:id", requireScope("moment.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Moment");
        }

        const moment = await profileAsync(c, "api_moment_lookup", () => db.query.moments.findFirst({
            where: eq(moments.id, id),
        }));
        if (!moment) {
            throw new NotFoundError("Moment");
        }

        await profileAsync(c, "api_moment_delete", () => db.delete(moments).where(eq(moments.id, id)));
        await profileAsync(c, "api_moment_delete_cache", () => cache.deletePrefix("moments_"));

        return c.json({ success: true });
    }));

    return app;
}
