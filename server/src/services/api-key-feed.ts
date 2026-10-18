import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { requireScope } from "../core/api-key-middleware";
import { BadRequestError, NotFoundError } from "../errors";
import {
    deleteFeedById,
    findFeedById,
    insertFeed,
    updateFeedById,
} from "../features/feed/repository";
import { bindTagToPost } from "./tag";
import { clearFeedCache, clearFeedCollectionCaches } from "./clear-feed-cache";
import { syncFeedAISummaryQueueState } from "./feed-ai-summary";
import { API_KEY_CONTENT_OWNER_UID } from "./api-key-owner";

export function parseApiKeyId(value: string): number | null {
    if (!/^[1-9]\d*$/.test(value)) {
        return null;
    }
    const id = Number(value);
    return Number.isSafeInteger(id) ? id : null;
}

interface CreateFeedApiBody {
    title?: unknown;
    alias?: unknown;
    listed?: unknown;
    draft?: unknown;
    content?: unknown;
    summary?: unknown;
    tags?: unknown;
    createdAt?: unknown;
}

interface UpdateFeedApiBody {
    title?: unknown;
    alias?: unknown;
    listed?: unknown;
    draft?: unknown;
    content?: unknown;
    summary?: unknown;
    tags?: unknown;
    createdAt?: unknown;
}

function str(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}

function bool(value: unknown): boolean | undefined {
    if (value === undefined) return undefined;
    return value === true || value === 1 || value === "true" || value === "1";
}

export function ApiKeyFeedService(): Hono {
    const app = new Hono();

    // POST /api/key/feed - Publish a new article
    app.post("/", requireScope("feed.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");
        const serverConfig = c.get("serverConfig");
        const env = c.get("env");

        const body = await c.req.json() as CreateFeedApiBody;

        const title = (str(body.title) ?? "").trim();
        const content = str(body.content) ?? "";
        if (!title) {
            throw new BadRequestError("title is required");
        }
        if (!content.trim()) {
            throw new BadRequestError("content is required");
        }

        const tags = Array.isArray(body.tags)
            ? body.tags.filter((item): item is string => typeof item === "string")
            : [];

        const date = body.createdAt && str(body.createdAt)
            ? new Date(str(body.createdAt) as string)
            : new Date();

        const draft = bool(body.draft) ?? true;

        const result = await profileAsync(c, "api_feed_create", () => insertFeed(db, {
            title,
            content,
            summary: str(body.summary) ?? "",
            ai_summary: "",
            ai_summary_status: "idle",
            ai_summary_error: "",
            uid: API_KEY_CONTENT_OWNER_UID,
            alias: str(body.alias) ?? null,
            listed: bool(body.listed) ?? true ? 1 : 0,
            draft: draft ? 1 : 0,
            createdAt: date,
            updatedAt: date,
        }));

        if (!result) {
            throw new BadRequestError("Failed to insert feed");
        }

        await profileAsync(c, "api_feed_tags", () => bindTagToPost(db, result.insertedId, tags));
        await profileAsync(c, "api_feed_ai", () => syncFeedAISummaryQueueState(db, serverConfig, env, result.insertedId, {
            draft,
            updatedAt: date,
            resetSummary: true,
        }));
        await profileAsync(c, "api_feed_cache", () => clearFeedCollectionCaches(cache));

        return c.json({ success: true, id: result.insertedId });
    }));

    // POST /api/key/feed/:id - Edit an article
    app.post("/:id", requireScope("feed.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");
        const serverConfig = c.get("serverConfig");
        const env = c.get("env");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Feed not found");
        }

        const feed = await profileAsync(c, "api_feed_update_lookup", () => findFeedById(db, id));
        if (!feed) {
            throw new NotFoundError("Feed not found");
        }

        const body = await c.req.json() as UpdateFeedApiBody;

        const contentChanged = body.content !== undefined && str(body.content) !== feed.content;
        const isDraft = bool(body.draft) ?? (feed.draft === 1);
        const shouldQueueAISummary = (contentChanged && !isDraft) || (!isDraft && feed.draft === 1 && !feed.ai_summary);
        const updateTime = new Date();

        await profileAsync(c, "api_feed_update", () => updateFeedById(db, id, {
            title: str(body.title),
            content: str(body.content),
            summary: str(body.summary),
            ai_summary: shouldQueueAISummary ? "" : undefined,
            ai_summary_status: isDraft ? "idle" : undefined,
            ai_summary_error: shouldQueueAISummary || isDraft ? "" : undefined,
            alias: str(body.alias),
            listed: body.listed === undefined ? undefined : (bool(body.listed) ? 1 : 0),
            draft: body.draft === undefined ? undefined : (bool(body.draft) ? 1 : 0),
            createdAt: body.createdAt && str(body.createdAt) ? new Date(str(body.createdAt) as string) : undefined,
            updatedAt: updateTime,
        }));

        if (Array.isArray(body.tags)) {
            const tags = body.tags.filter((item): item is string => typeof item === "string");
            await profileAsync(c, "api_feed_update_tags", () => bindTagToPost(db, id, tags));
        }

        if (shouldQueueAISummary || isDraft) {
            await profileAsync(c, "api_feed_update_ai", () => syncFeedAISummaryQueueState(db, serverConfig, env, id, {
                draft: isDraft,
                updatedAt: updateTime,
                resetSummary: shouldQueueAISummary,
            }));
        }

        await profileAsync(c, "api_feed_update_cache", () => clearFeedCache(cache, id, feed.alias, str(body.alias) ?? null));

        return c.json({ success: true, id });
    }));

    // DELETE /api/key/feed/:id - Delete an article
    app.delete("/:id", requireScope("feed.write", async (c: AppContext) => {
        const db = c.get("db");
        const cache = c.get("cache");

        const id = parseApiKeyId(c.req.param("id"));
        if (id === null) {
            throw new NotFoundError("Feed not found");
        }

        const feed = await profileAsync(c, "api_feed_delete_lookup", () => findFeedById(db, id));
        if (!feed) {
            throw new NotFoundError("Feed not found");
        }

        await profileAsync(c, "api_feed_delete", () => deleteFeedById(db, id));
        await profileAsync(c, "api_feed_delete_cache", () => clearFeedCache(cache, id, feed.alias, null));

        return c.json({ success: true });
    }));

    return app;
}
