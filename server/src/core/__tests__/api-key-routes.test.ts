import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { setupTestApp, type TestContext } from "../../../tests/fixtures";
import { registerRoutes } from "../register-routes";

describe("API key route prefixes", () => {
  let ctx: TestContext;
  let inner: Hono<any>;

  beforeEach(async () => {
    inner = new Hono();
    registerRoutes(inner as any);
    inner.onError((err: any, c: any) => {
      return c.json({ error: { message: err.message } }, err.statusCode ?? 500);
    });

    ctx = await setupTestApp(() => {
      const outer = new Hono();
      outer.route("/", inner);
      return outer;
    });

    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (1, 'admin', 'avatar.png', 'gh_admin', 1)
    `);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  it("serves scopes at /key/manage/scopes as rewritten from /api/key/manage/scopes", async () => {
    const res = await ctx.app.fetch(
      new Request("http://localhost/key/manage/scopes", {
        headers: { Authorization: "Bearer mock_token_1" },
      }),
      ctx.env,
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { scopes: unknown[] };
    expect(body.scopes.length).toBeGreaterThan(0);
  });
});
