import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { ApiKeyService } from "../api-key";
import { ApiKeyApiService } from "../api-key-api";
import { setupTestApp, type TestContext } from "../../../tests/fixtures";

const UID = 1;

function authHeaders(uid: number = UID) {
  return { Authorization: `Bearer mock_token_${uid}` };
}

function keyHeaders(key: string) {
  return { "X-API-Key": key };
}

async function createKey(ctx: TestContext, options: Record<string, unknown> = {}) {
  const res = await ctx.app.fetch(
    new Request("http://localhost/key/manage", {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "test key",
        scopes: ["feed.write", "moment.write"],
        ...options,
      }),
    }),
    ctx.env,
  );
  return { res, body: await res.json() as any };
}

describe("ApiKeyService", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestApp(() => {
      const app = new Hono();
      app.route("/key/manage", ApiKeyService());
      app.route("/key", ApiKeyApiService());
      return app;
    });

    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (${UID}, 'apiuser', 'avatar.png', 'gh_api', 1)
    `);

    ctx.app.onError((err: any, c: any) => {
      if (err.code && err.statusCode) {
        return c.json({ success: false, error: { code: err.code, message: err.message } }, err.statusCode);
      }
      return c.json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } }, 500);
    });
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("creates a 32-character key with scopes", async () => {
    const { res, body } = await createKey(ctx);
    expect(res.ok).toBe(true);
    expect(body.success).toBe(true);
    expect(body.plaintext).toHaveLength(32);
    expect(body.key.scopes).toEqual(["feed.write", "moment.write"]);
    expect(body.key.visible).toBe(false);
  });

  it("requires authentication to manage keys", async () => {
    const res = await ctx.app.fetch(new Request("http://localhost/key/manage"), ctx.env);
    expect(res.status).toBe(403);
  });

  it("rejects non-admin users from managing keys", async () => {
    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (2, 'normaluser', 'avatar.png', 'gh_normal', 0)
    `);

    const listRes = await ctx.app.fetch(
      new Request("http://localhost/key/manage", { headers: authHeaders(2) }),
      ctx.env,
    );
    expect(listRes.status).toBe(403);

    const createRes = await ctx.app.fetch(
      new Request("http://localhost/key/manage", {
        method: "POST",
        headers: { ...authHeaders(2), "Content-Type": "application/json" },
        body: JSON.stringify({ name: "nope", scopes: ["feed.write"] }),
      }),
      ctx.env,
    );
    expect(createRes.status).toBe(403);
  });

  it("rejects unknown scopes", async () => {
    const { res } = await createKey(ctx, { scopes: ["not.a.scope"] });
    expect(res.status).toBe(400);
  });

  it("lists keys without plaintext when encrypted", async () => {
    await createKey(ctx);
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/manage", { headers: authHeaders() }),
      ctx.env,
    );
    const body = await res.json() as any;
    expect(body.keys).toHaveLength(1);
    expect(body.keys[0].key).toBeNull();
  });

  it("reveals the key when visible is enabled", async () => {
    const { body } = await createKey(ctx, { visible: true });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/manage", { headers: authHeaders() }),
      ctx.env,
    );
    const listed = await res.json() as any;
    expect(listed.keys[0].visible).toBe(true);
    expect(listed.keys[0].key).toBe(body.plaintext);
  });

  it("rotates the key and invalidates the old secret", async () => {
    const { body } = await createKey(ctx, { visible: true });

    const rotated = await ctx.app.fetch(
      new Request(`http://localhost/key/manage/${body.key.id}/rotate`, {
        method: "POST",
        headers: authHeaders(),
      }),
      ctx.env,
    );
    const rotatedBody = await rotated.json() as any;
    expect(rotatedBody.plaintext).not.toBe(body.plaintext);
    expect(rotatedBody.plaintext).toHaveLength(32);

    const oldAttempt = await ctx.app.fetch(
      new Request("http://localhost/key/help", { headers: keyHeaders(body.plaintext) }),
      ctx.env,
    );
    expect(oldAttempt.status).toBe(401);

    const newAttempt = await ctx.app.fetch(
      new Request("http://localhost/key/help", { headers: keyHeaders(rotatedBody.plaintext) }),
      ctx.env,
    );
    expect(newAttempt.status).toBe(200);
  });

  it("deletes a key", async () => {
    const { body } = await createKey(ctx);
    const del = await ctx.app.fetch(
      new Request(`http://localhost/key/manage/${body.key.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      }),
      ctx.env,
    );
    expect(del.ok).toBe(true);

    const list = await ctx.app.fetch(
      new Request("http://localhost/key/manage", { headers: authHeaders() }),
      ctx.env,
    );
    const listed = await list.json() as any;
    expect(listed.keys).toHaveLength(0);
  });

  it("returns scopes and endpoints from /help", async () => {
    const { body } = await createKey(ctx, { scopes: ["feed.write"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/help", { headers: keyHeaders(body.plaintext) }),
      ctx.env,
    );
    expect(res.ok).toBe(true);
    const help = await res.json() as any;
    expect(help.scopes).toEqual(["feed.write"]);
    expect(help.permissions[0].scope).toBe("feed.write");
    expect(help.permissions[0].endpoints.length).toBeGreaterThan(0);
  });

  it("rejects a request with an invalid key", async () => {
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/help", { headers: keyHeaders("invalid-key-value") }),
      ctx.env,
    );
    expect(res.status).toBe(401);
  });

  it("enforces scopes on business endpoints", async () => {
    const { body } = await createKey(ctx, { scopes: ["feed.write"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/moment", {
        method: "POST",
        headers: { ...keyHeaders(body.plaintext), "Content-Type": "application/json" },
        body: JSON.stringify({ content: "hello" }),
      }),
      ctx.env,
    );
    expect(res.status).toBe(403);
    const payload = await res.json() as any;
    expect(payload.error).toContain("moment.write");
  });

  it("creates a moment with a moment.write key", async () => {
    const { body } = await createKey(ctx, { scopes: ["moment.write"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/moment", {
        method: "POST",
        headers: { ...keyHeaders(body.plaintext), "Content-Type": "application/json" },
        body: JSON.stringify({ content: "api moment" }),
      }),
      ctx.env,
    );
    expect(res.ok).toBe(true);
    const payload = await res.json() as any;
    expect(payload.success).toBe(true);

    const row = ctx.sqlite.query("SELECT content, uid FROM moments WHERE id = ?").get(payload.id) as any;
    expect(row.content).toBe("api moment");
    expect(row.uid).toBe(1);
  });

  it("rejects config keys outside the granted section", async () => {
    const { body } = await createKey(ctx, { scopes: ["config.site"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/config/site", {
        method: "POST",
        headers: { ...keyHeaders(body.plaintext), "Content-Type": "application/json" },
        body: JSON.stringify({ "site.name": "New Name", "theme.color": "#000000" }),
      }),
      ctx.env,
    );
    expect(res.status).toBe(400);
    const payload = await res.json() as any;
    expect(payload.error.message).toContain("theme.color");
  });

  it("writes allowed config keys", async () => {
    const { body } = await createKey(ctx, { scopes: ["config.site"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/config/site", {
        method: "POST",
        headers: { ...keyHeaders(body.plaintext), "Content-Type": "application/json" },
        body: JSON.stringify({ "site.name": "New Name" }),
      }),
      ctx.env,
    );
    expect(res.ok).toBe(true);

    const read = await ctx.app.fetch(
      new Request("http://localhost/key/config/site", { headers: keyHeaders(body.plaintext) }),
      ctx.env,
    );
    const payload = await read.json() as any;
    expect(payload.client["site.name"]).toBe("New Name");
  });

  it("denies reading a section without its scope", async () => {
    const { body } = await createKey(ctx, { scopes: ["config.site"] });
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/config/webhook", { headers: keyHeaders(body.plaintext) }),
      ctx.env,
    );
    expect(res.status).toBe(403);
  });
});
