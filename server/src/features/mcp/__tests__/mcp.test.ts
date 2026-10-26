import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { setupTestApp, type TestContext } from "../../../../tests/fixtures";
import { McpService } from "../../../services/mcp";
import { hashApiKey } from "../../../utils/api-key";
import { feeds } from "../../../db/schema";
import { guardMcpRequest, resolveMcpAllowedHostRules, resolveMcpAllowedHosts } from "../guard";

const READ_KEY = "read-key-000000000000000000000";
const WRITE_KEY = "write-key-000000000000000000000";
const CONFIG_KEY = "config-key-00000000000000000000";

async function insertApiKey(ctx: TestContext, id: number, rawKey: string, scopes: string[]) {
    const keyHash = await hashApiKey(rawKey);
    ctx.sqlite.exec(`
        INSERT INTO api_keys (id, uid, name, key_hash, key_encrypted, visible, scopes)
        VALUES (${id}, 1, 'key-${id}', '${keyHash}', NULL, 0, '${JSON.stringify(scopes)}')
    `);
}

interface RpcRequest {
    method: string;
    params?: Record<string, unknown>;
    id?: number;
}

async function rpc(
    ctx: TestContext,
    body: RpcRequest,
    options: { key?: string; headers?: Record<string, string> } = {},
) {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        ...(options.headers ?? {}),
    };
    if (options.key) {
        headers["X-API-Key"] = options.key;
    }

    const res = await ctx.app.fetch(
        new Request("http://localhost/mcp", {
            method: "POST",
            headers,
            body: JSON.stringify({
                jsonrpc: "2.0",
                id: body.id ?? 1,
                method: body.method,
                ...(body.params ? { params: body.params } : {}),
            }),
        }),
        ctx.env,
    );

    return res;
}

async function readRpcBody(res: Response): Promise<any> {
    const text = await res.text();
    if (!text) {
        return null;
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
        const frames = text
            .split("\n")
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());
        return JSON.parse(frames[frames.length - 1]);
    }
    return JSON.parse(text);
}

async function callTool(ctx: TestContext, key: string, name: string, args: Record<string, unknown> = {}) {
    const res = await rpc(ctx, {
        method: "tools/call",
        params: { name, arguments: args },
    }, { key });

    expect(res.status).toBe(200);
    const body = await readRpcBody(res);
    expect(body.error).toBeUndefined();

    const content = body.result?.content?.[0]?.text ?? "";
    let payload: any = {};
    if (content) {
        try {
            payload = JSON.parse(content);
        } catch {
            payload = { message: content };
        }
    }
    return {
        body,
        isError: body.result?.isError === true,
        payload,
    };
}

describe("MCP service", () => {
    let ctx: TestContext;

    beforeEach(async () => {
        ctx = await setupTestApp(() => {
            const app = new Hono();
            app.route("/mcp", McpService());
            return app;
        });

        ctx.sqlite.exec(`
            INSERT INTO users (id, username, avatar, openid, permission)
            VALUES (1, 'admin', 'avatar.png', 'gh_admin', 1)
        `);

        await insertApiKey(ctx, 1, READ_KEY, ["content.read"]);
        await insertApiKey(ctx, 2, WRITE_KEY, ["feed.write", "moment.write", "friend.write"]);
        await insertApiKey(ctx, 3, CONFIG_KEY, ["config.site"]);
    });

    afterEach(() => {
        ctx.sqlite.close();
    });

    it("rejects requests without an API key", async () => {
        const res = await rpc(ctx, { method: "tools/list" });
        expect(res.status).toBe(401);
        const body = await res.json() as any;
        expect(body.error).toBe("Missing API key");
    });

    it("rejects requests with an unknown API key", async () => {
        const res = await rpc(ctx, { method: "tools/list" }, { key: "unknown-key" });
        expect(res.status).toBe(401);
        const body = await res.json() as any;
        expect(body.error).toBe("Invalid API key");
    });

    it("answers the initialize handshake", async () => {
        const res = await rpc(ctx, {
            method: "initialize",
            params: {
                protocolVersion: "2025-06-18",
                capabilities: {},
                clientInfo: { name: "rin-test", version: "1.0.0" },
            },
        }, { key: READ_KEY });

        expect(res.status).toBe(200);
        const body = await readRpcBody(res);
        expect(body.result.serverInfo.name).toBe("rin");
    });

    it("lists only the tools allowed by the key scopes", async () => {
        const res = await rpc(ctx, { method: "tools/list" }, { key: READ_KEY });
        expect(res.status).toBe(200);

        const body = await readRpcBody(res);
        const names = body.result.tools.map((tool: any) => tool.name);
        expect(names).toContain("whoami");
        expect(names).toContain("list_posts");
        expect(names).not.toContain("create_post");
        expect(names).not.toContain("update_config");
    });

    it("reports the calling key through whoami", async () => {
        const { payload, isError } = await callTool(ctx, READ_KEY, "whoami");
        expect(isError).toBe(false);
        expect(payload.key_id).toBe(1);
        expect(payload.scopes).toEqual(["content.read"]);
        expect(payload.tools).toContain("list_posts");
    });

    it("creates an article with the feed.write scope", async () => {
        const { payload, isError } = await callTool(ctx, WRITE_KEY, "create_post", {
            title: "MCP Article",
            content: "Hello from MCP",
            tags: ["mcp"],
        });

        expect(isError).toBe(false);
        expect(payload.success).toBe(true);

        const inserted = await ctx.db.query.feeds.findFirst({
            where: eq(feeds.title, "MCP Article"),
        });
        expect(inserted).toBeTruthy();
        expect(inserted?.content).toBe("Hello from MCP");
        expect(inserted?.draft).toBe(1);
        expect(inserted?.uid).toBe(1);
    });

    it("rejects the create_post tool without the feed.write scope", async () => {
        const res = await rpc(ctx, {
            method: "tools/call",
            params: { name: "create_post", arguments: { title: "blocked", content: "blocked" } },
        }, { key: READ_KEY });

        expect(res.status).toBe(200);
        const body = await readRpcBody(res);
        expect(body.error.code).toBe(-32602);
    });

    it("updates a moment and a friend link", async () => {
        const moment = await callTool(ctx, WRITE_KEY, "create_moment", { content: "first moment" });
        expect(moment.isError).toBe(false);

        const updatedMoment = await callTool(ctx, WRITE_KEY, "update_moment", {
            id: moment.payload.id,
            content: "updated moment",
        });
        expect(updatedMoment.isError).toBe(false);

        const friend = await callTool(ctx, WRITE_KEY, "create_friend", {
            name: "Rin",
            desc: "Blog",
            avatar: "https://example.com/avatar.png",
            url: "https://example.com",
        });
        expect(friend.isError).toBe(false);

        const updatedFriend = await callTool(ctx, WRITE_KEY, "update_friend", {
            id: friend.payload.id,
            desc: "Updated blog",
        });
        expect(updatedFriend.isError).toBe(false);

        const listed = await callTool(ctx, READ_KEY, "list_friends");
        expect(listed.isError).toBe(false);
        expect(listed.payload.data[0].desc).toBe("Updated blog");
    });

    it("writes config keys of an allowed section", async () => {
        const updated = await callTool(ctx, CONFIG_KEY, "update_config", {
            section: "site",
            values: { "site.name": "Renamed Site" },
        });
        expect(updated.isError).toBe(false);
        expect(updated.payload.updated).toEqual(["site.name"]);

        const read = await callTool(ctx, CONFIG_KEY, "get_config", { section: "site" });
        expect(read.isError).toBe(false);
        expect(read.payload.client["site.name"]).toBe("Renamed Site");
    });

    it("rejects config writes for a section outside the key scopes", async () => {
        const { isError, payload } = await callTool(ctx, CONFIG_KEY, "update_config", {
            section: "ai",
            values: { "ai_summary.enabled": true },
        });

        expect(isError).toBe(true);
        expect(payload.message).toContain("config.ai");
    });

    it("rejects config keys outside the requested section", async () => {
        const { isError } = await callTool(ctx, CONFIG_KEY, "update_config", {
            section: "site",
            values: { "feed.layout": "grid" },
        });

        expect(isError).toBe(true);
    });

    it("returns an error result when a tool argument is invalid", async () => {
        const { isError } = await callTool(ctx, WRITE_KEY, "create_post", { title: "no content" });
        expect(isError).toBe(true);
    });
});

describe("MCP request guard", () => {
    it("allows localhost and the configured frontend host", () => {
        const env = { FRONTEND_URL: "https://rin.lab.j3.ink" } as Env;
        const request = new Request("https://rin.lab.j3.ink/mcp");

        expect(resolveMcpAllowedHosts(env, request)).toContain("rin.lab.j3.ink");
        expect(guardMcpRequest(request, env)).toBeNull();
    });

    it("rejects a request whose host is not allowed", () => {
        const env = { FRONTEND_URL: "https://rin.lab.j3.ink" } as Env;
        const request = new Request("https://rin.lab.j3.ink/mcp", {
            headers: { Host: "attacker.example.com" },
        });

        const rejected = guardMcpRequest(request, env);
        expect(rejected).not.toBeNull();
        expect(rejected?.status).toBe(403);
    });

    it("allows a custom domain listed in MCP_ALLOWED_HOSTS", () => {
        const env = { MCP_ALLOWED_HOSTS: "jiaoblog.dpdns.org" } as Env;
        const request = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: { Host: "jiaoblog.dpdns.org" },
        });

        expect(resolveMcpAllowedHosts(env, request)).toContain("jiaoblog.dpdns.org");
        expect(guardMcpRequest(request, env)).toBeNull();
    });

    it("accepts allowlist entries written with a scheme or a port", () => {
        const env = { MCP_ALLOWED_HOSTS: "https://jiaoblog.dpdns.org:443, blog.example.com:8080" } as Env;
        const request = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: { Host: "jiaoblog.dpdns.org" },
        });

        const rules = resolveMcpAllowedHostRules(env, request);
        expect(rules.exactHosts).toContain("jiaoblog.dpdns.org");
        expect(rules.exactHosts).toContain("blog.example.com");
        expect(guardMcpRequest(request, env)).toBeNull();
    });

    it("allows wildcard domains and rejects unrelated hosts", () => {
        const env = { MCP_ALLOWED_HOSTS: "*.dpdns.org" } as Env;
        const allowed = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: { Host: "jiaoblog.dpdns.org" },
        });
        const rejected = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: { Host: "attacker.example.com" },
        });

        expect(resolveMcpAllowedHostRules(env, allowed).wildcardSuffixes).toContain(".dpdns.org");
        expect(guardMcpRequest(allowed, env)).toBeNull();
        expect(guardMcpRequest(rejected, env)?.status).toBe(403);
    });

    it("allows browser origins matching a wildcard domain", () => {
        const env = { MCP_ALLOWED_HOSTS: "*.dpdns.org" } as Env;
        const request = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: {
                Host: "jiaoblog.dpdns.org",
                Origin: "https://jiaoblog.dpdns.org",
            },
        });

        expect(guardMcpRequest(request, env)).toBeNull();
    });

    it("allows every host when MCP_ALLOWED_HOSTS is a wildcard", () => {
        const env = { MCP_ALLOWED_HOSTS: "*" } as Env;
        const request = new Request("https://jiaoblog.dpdns.org/mcp", {
            headers: { Host: "jiaoblog.dpdns.org" },
        });

        expect(resolveMcpAllowedHostRules(env, request).allowAnyHost).toBe(true);
        expect(guardMcpRequest(request, env)).toBeNull();
    });

    it("explains how to allow a host when the request is rejected", async () => {
        const env = { FRONTEND_URL: "https://rin.lab.j3.ink" } as Env;
        const request = new Request("https://rin.lab.j3.ink/mcp", {
            headers: { Host: "jiaoblog.dpdns.org" },
        });

        const rejected = guardMcpRequest(request, env);
        expect(rejected?.status).toBe(403);

        const body = await rejected?.json() as {
            error: { message: string; data: { hint: string } };
        };
        expect(body.error.message).toContain("jiaoblog.dpdns.org");
        expect(body.error.data.hint).toContain("MCP_ALLOWED_HOSTS");
    });
});
