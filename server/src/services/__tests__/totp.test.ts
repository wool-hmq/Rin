import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { TotpService } from "../totp";
import { generateTOTP } from "../../utils/totp";
import { setupTestApp, type TestContext } from "../../../tests/fixtures";

const UID = 1;

function authHeaders(uid: number = UID) {
  return { Authorization: `Bearer mock_token_${uid}` };
}

describe("TotpService", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupTestApp(() => TotpService());
    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (${UID}, 'totpuser', 'avatar.png', 'gh_totp', 0)
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

  it("returns enabled=false before binding", async () => {
    const res = await ctx.app.fetch(
      new Request("http://localhost/status", { headers: authHeaders() }),
      ctx.env,
    );
    expect(res.ok).toBe(true);
    const body = await res.json() as any;
    expect(body.enabled).toBe(false);
  });

  it("requires authentication", async () => {
    const res = await ctx.app.fetch(
      new Request("http://localhost/status"),
      ctx.env,
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(403);
  });

  it("starts a setup and returns a base32 secret", async () => {
    const res = await ctx.app.fetch(
      new Request("http://localhost/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );
    expect(res.ok).toBe(true);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(typeof body.secret).toBe("string");
    expect(body.secret.length).toBeGreaterThan(0);
    expect(body.secret).toMatch(/^[A-Z2-7]+$/);
  });

  it("rejects confirm with an invalid code", async () => {
    await ctx.app.fetch(
      new Request("http://localhost/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );

    const res = await ctx.app.fetch(
      new Request("http://localhost/confirm", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code: "000000" }),
      }),
      ctx.env,
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  it("binds TOTP with a valid code, then unbinds", async () => {
    const setupRes = await ctx.app.fetch(
      new Request("http://localhost/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );
    const { secret } = await setupRes.json() as any;

    const code = await generateTOTP(secret, Math.floor(Date.now() / 1000));
    const confirmRes = await ctx.app.fetch(
      new Request("http://localhost/confirm", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
      ctx.env,
    );
    expect(confirmRes.ok).toBe(true);
    expect((await confirmRes.json() as any).enabled).toBe(true);

    const statusRes = await ctx.app.fetch(
      new Request("http://localhost/status", { headers: authHeaders() }),
      ctx.env,
    );
    expect((await statusRes.json() as any).enabled).toBe(true);

    const unbindRes = await ctx.app.fetch(
      new Request("http://localhost/", { method: "DELETE", headers: authHeaders() }),
      ctx.env,
    );
    expect(unbindRes.ok).toBe(true);
    expect((await unbindRes.json() as any).enabled).toBe(false);
  });

  it("prevents starting a second setup when already enabled", async () => {
    const setupRes = await ctx.app.fetch(
      new Request("http://localhost/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );
    const { secret } = await setupRes.json() as any;
    const code = await generateTOTP(secret, Math.floor(Date.now() / 1000));

    await ctx.app.fetch(
      new Request("http://localhost/confirm", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
      ctx.env,
    );

    const again = await ctx.app.fetch(
      new Request("http://localhost/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );
    expect(again.ok).toBe(false);
    expect(again.status).toBe(409);
  });
});
