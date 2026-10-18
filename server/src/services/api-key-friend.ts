import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { requireScope } from "../core/api-key-middleware";
import { BadRequestError, NotFoundError } from "../errors";
import { friends } from "../db/schema";
import { parseApiKeyId } from "./api-key-feed";
import { API_KEY_CONTENT_OWNER_UID } from "./api-key-owner";

function str(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function num(value: unknown): number | undefined {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return undefined;
}

function int01(value: unknown): number | undefined {
    if (value === undefined) return undefined;
    return value === true || value === 1 || value === "true" || value === "1" ? 1 : 0;
}

export function ApiKeyFriendService(): Hono {
    const app = new Hono();

    // POST /api/key/friend - Create a friend link
    app.post("/", requireScope("friend.write", async (c: AppContext) => {
        const db = c.get("db");

        const body = await c.req.json() as {
            name?: unknown;
            desc?: unknown;
            avatar?: unknown;
            url?: unknown;
            group?: unknown;
            accepted?: unknown;
            sort_order?: unknown;
        };

        const name = (str(body.name) ?? "").trim();
        const desc = (str(body.desc) ?? "").trim();
        const avatar = (str(body.avatar) ?? "").trim();
        const url = (str(body.url) ?? "").trim();

        if (!name || !desc || !avatar || !url) {
            throw new BadRequestError("name, desc, avatar and url are required");
        }
        if (name.length > 20 || desc.length > 100 || avatar.length > 100 || url.length > 100) {
            throw new BadRequestError("Field length out of range");
        }

        const result = await profileAsync(c, "api_friend_create", () => db.insert(friends).values({
            name,
            desc,
            avatar,
            url,
            uid: API_KEY_CONTENT_OWNER_UID,
            accepted: int01(body.accepted) ?? 1,
            health: "",
            sort_order: num(body.sort_order) ?? 0,
            group: str(body.group) ?? "",
        }).returning({ insertedId: friends.id }));

        return c.json({ success: true, id: result[0]?.insertedId });
    }));

    // PUT /api/key/friend/:id - Edit a friend link
    app.put("/:id", requireScope("friend.write", async (c: AppContext) => {
        const db = c.get("db");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Friend link not found");
        }

        const exist = await profileAsync(c, "api_friend_lookup", () => db.query.friends.findFirst({
            where: eq(friends.id, id),
        }));
        if (!exist) {
            throw new NotFoundError("Friend link not found");
        }

        const body = await c.req.json() as {
            name?: unknown;
            desc?: unknown;
            avatar?: unknown;
            url?: unknown;
            group?: unknown;
            accepted?: unknown;
            sort_order?: unknown;
        };

        const updates: Partial<typeof friends.$inferInsert> = {};

        if (body.name !== undefined) {
            const name = (str(body.name) ?? "").trim();
            if (!name || name.length > 20) throw new BadRequestError("Invalid name");
            updates.name = name;
        }
        if (body.desc !== undefined) {
            const desc = (str(body.desc) ?? "").trim();
            if (desc.length > 100) throw new BadRequestError("Invalid desc");
            updates.desc = desc;
        }
        if (body.avatar !== undefined) {
            const avatar = (str(body.avatar) ?? "").trim();
            if (!avatar || avatar.length > 100) throw new BadRequestError("Invalid avatar");
            updates.avatar = avatar;
        }
        if (body.url !== undefined) {
            const url = (str(body.url) ?? "").trim();
            if (!url || url.length > 100) throw new BadRequestError("Invalid url");
            updates.url = url;
        }
        if (body.group !== undefined) {
            const group = (str(body.group) ?? "").trim();
            if (group.length > 20) throw new BadRequestError("Invalid group");
            updates.group = group;
        }
        if (body.accepted !== undefined) {
            updates.accepted = int01(body.accepted);
        }
        if (body.sort_order !== undefined) {
            const order = num(body.sort_order);
            if (order === undefined) throw new BadRequestError("Invalid sort_order");
            updates.sort_order = order;
        }

        if (Object.keys(updates).length === 0) {
            return c.json({ success: true, id });
        }

        updates.updatedAt = new Date();

        await profileAsync(c, "api_friend_update", () => db.update(friends)
            .set(updates)
            .where(eq(friends.id, id)));

        return c.json({ success: true, id });
    }));

    // DELETE /api/key/friend/:id - Delete a friend link
    app.delete("/:id", requireScope("friend.write", async (c: AppContext) => {
        const db = c.get("db");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Friend link not found");
        }

        const exist = await profileAsync(c, "api_friend_lookup", () => db.query.friends.findFirst({
            where: eq(friends.id, id),
        }));
        if (!exist) {
            throw new NotFoundError("Friend link not found");
        }

        await profileAsync(c, "api_friend_delete", () => db.delete(friends).where(eq(friends.id, id)));

        return c.json({ success: true });
    }));

    return app;
}
