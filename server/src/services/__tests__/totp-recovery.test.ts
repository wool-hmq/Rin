import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { TotpService } from "../totp";
import { PasswordAuthService } from "../auth";
import { generateTOTP } from "../../utils/totp";
import { hashRecoveryCode, formatRecoveryCode, normalizeRecoveryCode } from "../../utils/recovery-code";
import { recoveryCodes, users } from "../../db/schema";
import { createMockEnv, setupTestApp, type TestContext } from "../../../tests/fixtures";

const UID = 100;

function authHeaders(uid: number = UID) {
  return { Authorization: `Bearer mock_token_${uid}` };
}

async function setupCombinedApp(env: Env): Promise<TestContext> {
  const ctx = await setupTestApp(() => {
    const app = new Hono();
    app.route("/user/totp", TotpService());
    app.route("/auth", PasswordAuthService());
    return app;
  }, env as Partial<Env>);
  ctx.app.onError((err: any, c: any) => {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.statusCode ?? 500,
    );
  });
  return ctx;
}

describe("TOTP recovery codes", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupCombinedApp(createMockEnv({ ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin123" }));
    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission)
      VALUES (${UID}, 'recoveruser', 'avatar.png', 'gh_recover', 0)
    `);
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  async function enableTotp() {
    const setupRes = await ctx.app.fetch(
      new Request("http://localhost/user/totp/setup", { method: "POST", headers: authHeaders() }),
      ctx.env,
    );
    const { secret } = await setupRes.json() as any;
    const code = await generateTOTP(secret, Math.floor(Date.now() / 1000));
    const confirmRes = await ctx.app.fetch(
      new Request("http://localhost/user/totp/confirm", {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      }),
      ctx.env,
    );
    return confirmRes;
  }

  it("returns 4 XXXX-XXXX recovery codes when TOTP is enabled", async () => {
    const confirmRes = await enableTotp();
    expect(confirmRes.ok).toBe(true);
    const body = await confirmRes.json() as any;
    expect(body.recovery_codes).toBeDefined();
    expect(body.recovery_codes).toHaveLength(4);
    for (const code of body.recovery_codes) {
      expect(code).toMatch(/^\d{4}-\d{4}$/);
    }
  });

  it("stores only hashed recovery codes (no plaintext in DB)", async () => {
    const confirmRes = await enableTotp();
    const body = await confirmRes.json() as any;
    const plaintexts = body.recovery_codes as string[];
    const rows = await ctx.db.query.recoveryCodes.findMany({
      where: eq(recoveryCodes.userId, UID),
    });
    expect(rows).toHaveLength(4);
    const hashes = await Promise.all(plaintexts.map((c) => hashRecoveryCode(normalizeRecoveryCode(c))));
    for (const h of hashes) {
      expect(rows.some((r: { codeHash: string }) => r.codeHash === h)).toBe(true);
    }
    for (const row of rows) {
      for (const code of plaintexts) {
        expect(row.codeHash).not.toBe(code);
        expect(row.codeHash).not.toBe(code.replace("-", ""));
      }
    }
  });

  it("rejects recovery with a wrong code and does not disable TOTP", async () => {
    await enableTotp();
    const res = await ctx.app.fetch(
      new Request("http://localhost/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "recoveruser", recoveryCode: "0000-0000" }),
      }),
      ctx.env,
    );
    expect(res.ok).toBe(false);
    const user = await ctx.db.query.users.findFirst({ where: eq(users.id, UID) });
    expect(user?.totpSecret).toBeTruthy();
  });

  it("restores the account via a valid recovery code and disables TOTP", async () => {
    const confirmRes = await enableTotp();
    const body = await confirmRes.json() as any;
    const code = (body.recovery_codes as string[])[0];

    const res = await ctx.app.fetch(
      new Request("http://localhost/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "recoveruser", recoveryCode: code }),
      }),
      ctx.env,
    );
    expect(res.ok).toBe(true);

    const user = await ctx.db.query.users.findFirst({ where: eq(users.id, UID) });
    expect(user?.totpSecret).toBeNull();

    const remaining = await ctx.db.query.recoveryCodes.findMany({
      where: eq(recoveryCodes.userId, UID),
    });
    expect(remaining).toHaveLength(0);
  });

  it("formats and normalizes recovery codes correctly", () => {
    expect(formatRecoveryCode("12345678")).toBe("1234-5678");
    expect(normalizeRecoveryCode("1234-5678")).toBe("12345678");
    expect(normalizeRecoveryCode(" 1234 5678 ")).toBe("12345678");
  });

  it("allows password login again after recovery disables TOTP", async () => {
    const confirmRes = await enableTotp();
    const { recovery_codes } = await confirmRes.json() as any;
    const hash = createHash("sha256").update("recoverpass").digest("hex");
    await ctx.db.update(users).set({ password: hash }).where(eq(users.id, UID));

    await ctx.app.fetch(
      new Request("http://localhost/auth/recover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "recoveruser", recoveryCode: recovery_codes[1] }),
      }),
      ctx.env,
    );

    const loginRes = await ctx.app.fetch(
      new Request("http://localhost/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "recoveruser", password: "recoverpass" }),
      }),
      ctx.env,
    );
    expect(loginRes.ok).toBe(true);
  });
});

describe("Login rate limiting", () => {
  let ctx: TestContext;

  beforeEach(async () => {
    ctx = await setupCombinedApp(createMockEnv({ ADMIN_USERNAME: "admin", ADMIN_PASSWORD: "admin123" }));
  });

  afterEach(() => {
    ctx.sqlite.close();
  });

  function loginRequest(username: string, password: string, ip?: string) {
    return new Request("http://localhost/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(ip ? { "CF-Connecting-IP": ip } : {}),
      },
      body: JSON.stringify({ username, password }),
    });
  }

  it("warns when 1 or 2 account attempts remain, then locks the account", async () => {
    // 1st and 2nd failure: generic invalid credentials (no rate-limit yet)
    for (let i = 0; i < 2; i++) {
      const res = await ctx.app.fetch(loginRequest("someuser", "wrong", "1.2.3.4"), ctx.env);
      expect(res.status).toBe(403);
    }
    // 3rd failure: remaining user attempt = 2 -> warning
    const warn3 = await ctx.app.fetch(loginRequest("someuser", "wrong", "1.2.3.4"), ctx.env);
    expect(warn3.status).toBe(429);
    const warn3Body = await warn3.json() as any;
    expect(warn3Body.error.message).toContain("LOGIN_RATE_LIMIT:user:2");

    // 4th failure: remaining user attempt = 1 -> warning
    const warn4 = await ctx.app.fetch(loginRequest("someuser", "wrong", "1.2.3.4"), ctx.env);
    expect(warn4.status).toBe(429);
    const warn4Body = await warn4.json() as any;
    expect(warn4Body.error.message).toContain("LOGIN_RATE_LIMIT:user:1");

    // 5th failure: account locked
    const warn5 = await ctx.app.fetch(loginRequest("someuser", "wrong", "1.2.3.4"), ctx.env);
    expect(warn5.status).toBe(429);
    const warn5Body = await warn5.json() as any;
    expect(warn5Body.error.message).toContain("LOGIN_RATE_LIMIT:user:blocked");

    // Correct password is still blocked while the lock is active
    const blocked = await ctx.app.fetch(loginRequest("someuser", "whatever", "1.2.3.4"), ctx.env);
    expect(blocked.status).toBe(429);
    const blockedBody = await blocked.json() as any;
    expect(blockedBody.error.message).toContain("LOGIN_RATE_LIMIT:user:blocked");
  });

  it("locks an IP after 15 consecutive failures and blocks further login attempts", async () => {
    // Use a fresh username per attempt so the account lock never triggers
    // before the IP limit; only the 15-attempt IP window is being tested.
    for (let i = 0; i < 13; i++) {
      await ctx.app.fetch(loginRequest(`ipuser${i}`, "wrong", "9.9.9.9"), ctx.env);
    }
    // 14th -> warning (1 attempt left for IP)
    const warn = await ctx.app.fetch(loginRequest("ipuser13", "wrong", "9.9.9.9"), ctx.env);
    expect(warn.status).toBe(429);
    const warnBody = await warn.json() as any;
    expect(warnBody.error.message).toContain("LOGIN_RATE_LIMIT:ip:1");

    // 15th -> IP locked
    const lock = await ctx.app.fetch(loginRequest("ipuser14", "wrong", "9.9.9.9"), ctx.env);
    expect(lock.status).toBe(429);
    const lockBody = await lock.json() as any;
    expect(lockBody.error.message).toContain("LOGIN_RATE_LIMIT:ip:blocked");

    const blocked = await ctx.app.fetch(loginRequest("otheruser", "whatever", "9.9.9.9"), ctx.env);
    expect(blocked.status).toBe(429);
  });

  it("resets the account counter after a successful login", async () => {
    const hash = createHash("sha256").update("goodpass").digest("hex");
    ctx.sqlite.exec(`
      INSERT INTO users (id, username, avatar, openid, permission, password)
      VALUES (200, 'gooduser', 'avatar.png', 'gh_good', 0, '${hash}')
    `);

    // 4 failures
    for (let i = 0; i < 4; i++) {
      await ctx.app.fetch(loginRequest("gooduser", "wrong", "5.6.7.8"), ctx.env);
    }

    // Successful login resets
    const ok = await ctx.app.fetch(loginRequest("gooduser", "goodpass", "5.6.7.8"), ctx.env);
    expect(ok.status).toBe(200);

    // Fresh failures start a new window without locking early
    const after = await ctx.app.fetch(loginRequest("gooduser", "wrong", "5.6.7.8"), ctx.env);
    expect(after.status).toBe(403);
  });

  it("keeps account lock separate from the IP lock", async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.app.fetch(loginRequest("userA", "wrong", "3.3.3.3"), ctx.env);
    }
    const aBlocked = await ctx.app.fetch(loginRequest("userA", "wrong", "3.3.3.3"), ctx.env);
    expect(aBlocked.status).toBe(429);
    expect((await aBlocked.json() as any).error.message).toContain("LOGIN_RATE_LIMIT:user:blocked");

    // Same IP logging in as a different account stays allowed
    const bOk = await ctx.app.fetch(loginRequest("userB", "wrong2", "3.3.3.3"), ctx.env);
    expect(bOk.status).toBe(403);
  });
});
