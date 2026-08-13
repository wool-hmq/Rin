import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { Hono } from "hono";
import type { Database } from "bun:sqlite";
import { createTestUser, cleanupTestDB, setupTestApp, type TestContext } from "../../../tests/fixtures";
import { SearchService } from "../feed";
import type { Variables } from "../../core/hono-types";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

describe("SearchService", () => {
    let ctx: TestContext;
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let serverConfig: TestContext["serverConfig"];

    beforeEach(async () => {
        ctx = await setupTestApp(SearchService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        serverConfig = ctx.serverConfig;
        createTestUser(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function createFeed(title: string): Promise<number> {
        const result = sqlite.query(
            `INSERT INTO feeds (title, content, summary, ai_summary, uid, draft, listed) VALUES (?, ?, '', '', 1, 0, 1) RETURNING id`,
        ).get(title, `Content of ${title}`) as { id: number };
        return result.id;
    }

    function enableAISearch() {
        serverConfig.set("ai_search.enabled", true);
        serverConfig.set("ai_summary.enabled", true);
        serverConfig.set("ai_summary.provider", "openai");
        serverConfig.set("ai_summary.model", "gpt-4o-mini");
        serverConfig.set("ai_summary.api_key", "secret");
        serverConfig.set("ai_summary.api_url", "https://api.openai.com/v1");
        serverConfig.set("ai_summary.failover", []);
    }

    it("returns matching feeds in keyword mode without mode fields", async () => {
        await createFeed("TypeScript Tips");
        await createFeed("Rust Notes");

        const res = await app.request("/TypeScript", { method: "GET" }, env);

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.mode).toBeUndefined();
        expect(data.fallbackReason).toBeUndefined();
        expect(data.data).toHaveLength(1);
        expect(data.data[0].title).toBe("TypeScript Tips");
    });

    it("returns feeds ranked by the LLM in AI mode", async () => {
        const firstId = await createFeed("Alpha Post");
        const secondId = await createFeed("Alpha Beta");
        enableAISearch();

        globalThis.fetch = mock(async () => new Response(JSON.stringify({
            choices: [{ message: { content: `["${secondId}","${firstId}"]` } }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;

        const res = await app.request("/Alpha?mode=ai", { method: "GET" }, env);

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.mode).toBe("ai");
        expect(data.hasNext).toBe(false);
        expect(data.data.map((feed: any) => feed.id)).toEqual([secondId, firstId]);
    });

    it("falls back to keyword mode with ai_search.disabled when the switch is off", async () => {
        await createFeed("Alpha Post");
        serverConfig.set("ai_search.enabled", false);

        const res = await app.request("/Alpha?mode=ai", { method: "GET" }, env);

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.mode).toBe("keyword");
        expect(data.fallbackReason).toBe("ai_search.disabled");
        expect(data.data.length).toBeGreaterThan(0);
    });

    it("falls back to keyword mode with llm_failed when the LLM request fails", async () => {
        await createFeed("Alpha Post");
        enableAISearch();

        globalThis.fetch = mock(async () => new Response("server error", { status: 500 })) as typeof fetch;

        const res = await app.request("/Alpha?mode=ai", { method: "GET" }, env);

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data.mode).toBe("keyword");
        expect(data.fallbackReason).toBe("llm_failed");
    });

    it("returns an empty result for an empty keyword", async () => {
        const res = await app.request("/%20?mode=ai", { method: "GET" }, env);

        expect(res.status).toBe(200);
        const data = (await res.json()) as any;
        expect(data).toEqual({ size: 0, data: [], hasNext: false });
    });
});
