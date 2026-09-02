import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import { PasswordAuthService } from "../auth";
import {
  createMockDB,
  createMockEnv,
  cleanupTestDB,
} from "../../../tests/fixtures";
import { createTestClient } from "../../../tests/test-api-client";
import type { Database } from "bun:sqlite";
import type { Variables } from "../../core/hono-types";

describe("PasswordAuthService", () => {
  let db: any;
  let sqlite: Database;
  let env: Env;
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let api: ReturnType<typeof createTestClient>;

  beforeEach(async () => {
    const mockDB = createMockDB();
    db = mockDB.db;
    sqlite = mockDB.sqlite;
    env = createMockEnv({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "admin123",
    });

    // Setup Hono app with mock db
    app = new Hono<{ Bindings: Env; Variables: Variables }>();

    // Add middleware to inject test dependencies
    app.use(async (c: any, next: any) => {
      c.set("db", db);
      c.set("jwt", {
        sign: async (payload: any) => `mock_token_${payload.id}`,
        verify: async (token: string) => {
          const match = token.match(/mock_token_(\d+)/);
          return match ? { id: parseInt(match[1]) } : null;
        },
      });
      c.set("env", env);
      await next();
    });

    // Register service with prefix
    app.route('/auth', PasswordAuthService());

    // Add error handler
    app.onError((err: any, c: any) => {
      if (err.code && err.statusCode) {
        return c.json(
          {
            success: false,
            error: {
              code: err.code,
              message: err.message,
              details: err.details,
            },
          },
          err.statusCode,
        );
      }
      return c.json(
        {
          success: false,
          error: {
            code: "INTERNAL_ERROR",
            message: err.message || "An unexpected error occurred",
          },
        },
        500,
      );
    });

    api = createTestClient(app, env);
  });

  afterEach(() => {
    cleanupTestDB(sqlite);
  });

  describe("POST /auth/login - Login with credentials", () => {
    it("should login with admin credentials", async () => {
      const result = await api.auth.login({
        username: "admin",
        password: "admin123",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.success).toBe(true);
      expect(result.data?.token).toBeDefined();
      expect(result.data?.user.username).toBe("admin");
      expect(result.data?.user.permission).toBe(true);
    });

    it("should create admin user on first login", async () => {
      // First login - admin user doesn't exist yet
      const result = await api.auth.login({
        username: "admin",
        password: "admin123",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.success).toBe(true);
      expect(result.data?.user.id).toBeDefined();

      // Verify admin user was created in database
      const dbResult = sqlite.prepare(`SELECT * FROM users WHERE openid = 'admin'`).all() as any[];
      expect(dbResult.length).toBe(1);
      expect(dbResult[0].username).toBe("admin");
      expect(dbResult[0].permission).toBe(1);
    });

    it("should reject invalid admin password", async () => {
      const result = await api.auth.login({
        username: "admin",
        password: "wrongpassword",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Invalid credentials");
    });

    it("should login with regular user credentials", async () => {
      // Create a regular user with password
      sqlite.exec(`
        INSERT INTO users (id, username, avatar, openid, password, permission) 
        VALUES (2, 'regularuser', 'avatar.png', 'user_2', '${await hashPassword('userpass')}', 0)
      `);

      const result = await api.auth.login({
        username: "regularuser",
        password: "userpass",
      });

      expect(result.error).toBeUndefined();
      expect(result.data?.success).toBe(true);
      expect(result.data?.user.username).toBe("regularuser");
      expect(result.data?.user.permission).toBe(false);
    });

    it("should reject non-existent user", async () => {
      const result = await api.auth.login({
        username: "nonexistent",
        password: "somepassword",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Invalid credentials");
    });

    it("should require username and password", async () => {
      const result = await api.auth.login({
        username: "",
        password: "",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Username and password are required");
    });

    it("should return 400 if admin credentials not configured", async () => {
      const envNoCreds = createMockEnv({
        ADMIN_USERNAME: "",
        ADMIN_PASSWORD: "",
      });

      const honoAppNoCreds = new Hono<{
        Bindings: Env;
        Variables: Variables;
      }>();
      honoAppNoCreds.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("jwt", {
          sign: async (payload: any) => `mock_token_${payload.id}`,
          verify: async (token: string) => {
            const match = token.match(/mock_token_(\d+)/);
            return match ? { id: parseInt(match[1]) } : null;
          },
        });
        c.set("env", envNoCreds);
        await next();
      });

      honoAppNoCreds.route('/auth', PasswordAuthService());

      // Add error handler
      honoAppNoCreds.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      const appNoCreds = {
        ...honoAppNoCreds,
        fetch: (request: Request, env: Env) =>
          honoAppNoCreds.fetch(request, { ...env, DB: db }),
      };

      const apiNoCreds = createTestClient(appNoCreds, envNoCreds);

      const result = await apiNoCreds.auth.login({
        username: "admin",
        password: "admin123",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Admin credentials not configured");
    });

    it("should reject user without password", async () => {
      // Create a user without password
      sqlite.exec(`
        INSERT INTO users (id, username, avatar, openid, password, permission) 
        VALUES (3, 'nopassworduser', 'avatar.png', 'user_3', NULL, 0)
      `);

      const result = await api.auth.login({
        username: "nopassworduser",
        password: "anypassword",
      });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(403);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Invalid credentials");
    });
  });

  describe("GET /auth/status - Check auth availability", () => {
    it("should return github and password status", async () => {
      const result = await api.auth.status();

      expect(result.error).toBeUndefined();
      expect(result.data?.github).toBe(true); // Has GitHub credentials in env
      expect(result.data?.password).toBe(true); // Has admin credentials
    });

    it("should return false when credentials not configured", async () => {
      const envNoCreds = createMockEnv({
        RIN_GITHUB_CLIENT_ID: "",
        RIN_GITHUB_CLIENT_SECRET: "",
        ADMIN_USERNAME: "",
        ADMIN_PASSWORD: "",
      });

      const honoAppNoCreds = new Hono<{
        Bindings: Env;
        Variables: Variables;
      }>();
      honoAppNoCreds.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("env", envNoCreds);
        await next();
      });
      honoAppNoCreds.route('/auth', PasswordAuthService());

      // Add error handler
      honoAppNoCreds.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      // Add fetch method for test client compatibility
      const appNoCreds = {
        ...honoAppNoCreds,
        fetch: (request: Request, env: Env) =>
          honoAppNoCreds.fetch(request, { ...env, DB: db }),
      };

      const apiNoCreds = createTestClient(appNoCreds, envNoCreds);

      const result = await apiNoCreds.auth.status();

      expect(result.error).toBeUndefined();
      expect(result.data?.github).toBe(false);
      expect(result.data?.password).toBe(false);
    });
  });

  describe("POST /auth/email/send - Send email verification code", () => {
    const smtpEnv = createMockEnv({
      EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send",
      EMAIL_RESEND_PASS: "test-resend-pass",
    });

    let emailApp: Hono<{ Bindings: Env; Variables: Variables }>;
    let emailApi: ReturnType<typeof createTestClient>;

    beforeEach(async () => {
      emailApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      emailApp.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("jwt", {
          sign: async (payload: any) => `mock_token_${payload.id}`,
          verify: async (token: string) => {
            const match = token.match(/mock_token_(\d+)/);
            return match ? { id: parseInt(match[1]) } : null;
          },
        });
        c.set("env", smtpEnv);
        await next();
      });
      emailApp.route('/auth', PasswordAuthService());
      emailApp.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      const fetchApp = {
        ...emailApp,
        fetch: (request: Request, env: Env) =>
          emailApp.fetch(request, { ...env, DB: db }),
      };
      emailApi = createTestClient(fetchApp, smtpEnv);
    });

    it("should send verification code to valid email", async () => {
      // Mock the fetch call to Mailgun API
      const originalFetch = global.fetch;
      global.fetch = async () => new Response("", { status: 200 });

      try {
        const result = await emailApi.auth.sendEmailCode({ email: "user@example.com" });

        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(result.data?.message).toBe("Verification code sent");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should reject invalid email", async () => {
      const result = await emailApi.auth.sendEmailCode({ email: "invalid-email" });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Invalid email address");
    });

    it("should return 400 when email service is not configured", async () => {
      const envNoSmtp = createMockEnv({
        EMAIL_RESEND_URL: "",
        EMAIL_RESEND_PASS: "",
      });

      const appNoSmtp = new Hono<{ Bindings: Env; Variables: Variables }>();
      appNoSmtp.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("jwt", {
          sign: async (payload: any) => `mock_token_${payload.id}`,
          verify: async () => null,
        });
        c.set("env", envNoSmtp);
        await next();
      });
      appNoSmtp.route('/auth', PasswordAuthService());
      appNoSmtp.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      const fetchAppNoSmtp = {
        ...appNoSmtp,
        fetch: (request: Request, env: Env) =>
          appNoSmtp.fetch(request, { ...env, DB: db }),
      };
      const apiNoSmtp = createTestClient(fetchAppNoSmtp, envNoSmtp);

      const result = await apiNoSmtp.auth.sendEmailCode({ email: "user@example.com" });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Email service is not configured");
    });
  });

  describe("POST /auth/email/login - Email verification login", () => {
    const smtpEnv = createMockEnv({
      EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send",
      EMAIL_RESEND_PASS: "test-resend-pass",
    });

    let emailApp: Hono<{ Bindings: Env; Variables: Variables }>;
    let emailApi: ReturnType<typeof createTestClient>;

    beforeEach(async () => {
      emailApp = new Hono<{ Bindings: Env; Variables: Variables }>();
      emailApp.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("jwt", {
          sign: async (payload: any) => `mock_token_${payload.id}`,
          verify: async (token: string) => {
            const match = token.match(/mock_token_(\d+)/);
            return match ? { id: parseInt(match[1]) } : null;
          },
        });
        c.set("env", smtpEnv);
        await next();
      });
      emailApp.route('/auth', PasswordAuthService());
      emailApp.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      const fetchApp = {
        ...emailApp,
        fetch: (request: Request, env: Env) =>
          emailApp.fetch(request, { ...env, DB: db }),
      };
      emailApi = createTestClient(fetchApp, smtpEnv);
    });

    it("should login existing user with valid code", async () => {
      // Insert a test user with email
      sqlite.exec(`INSERT INTO users (id, username, email, openid, avatar, permission) VALUES (10, 'emailuser', 'user@example.com', 'email:user@example.com', '', 0)`);

      // First send a code
      const originalFetch = global.fetch;
      global.fetch = async () => new Response("", { status: 200 });

      try {
        const sendResult = await emailApi.auth.sendEmailCode({ email: "user@example.com" });
        expect(sendResult.error).toBeUndefined();
        const code = sendResult.data?.code as string;
        expect(code).toBeDefined();

        const result = await emailApi.auth.emailLogin({ email: "user@example.com", code });

        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(result.data?.token).toBe("mock_token_10");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should create new user with valid code", async () => {
      // First send a code
      const originalFetch = global.fetch;
      global.fetch = async () => new Response("", { status: 200 });

      try {
        const sendResult = await emailApi.auth.sendEmailCode({ email: "new@example.com" });
        expect(sendResult.error).toBeUndefined();
        const code = sendResult.data?.code as string;
        expect(code).toBeDefined();

        const result = await emailApi.auth.emailLogin({ email: "new@example.com", code });

        expect(result.error).toBeUndefined();
        expect(result.data?.success).toBe(true);
        expect(result.data?.token).toBeDefined();

        // Verify user was created
        const dbResult = sqlite.prepare(`SELECT * FROM users WHERE email = 'new@example.com'`).all() as any[];
        expect(dbResult.length).toBe(1);
        expect(dbResult[0].username).toBe("new@example.com");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should reject invalid code", async () => {
      const result = await emailApi.auth.emailLogin({ email: "user@example.com", code: "wrong" });

      expect(result.error).toBeDefined();
      expect(result.error?.status).toBe(400);
      const errorData = result.error?.value as any;
      expect(errorData.error.message).toBe("Invalid or expired verification code");
    });
  });

  describe("POST /auth/email/send - IP rate limiting", () => {
    const smtpEnv = createMockEnv({
      EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send",
      EMAIL_RESEND_PASS: "test-resend-pass",
    });

    let app: Hono<{ Bindings: Env; Variables: Variables }>;
    let api: ReturnType<typeof createTestClient>;

    beforeEach(async () => {
      app = new Hono<{ Bindings: Env; Variables: Variables }>();
      app.use(async (c: any, next: any) => {
        c.set("db", db);
        c.set("jwt", {
          sign: async (payload: any) => `mock_token_${payload.id}`,
          verify: async () => null,
        });
        c.set("env", smtpEnv);
        await next();
      });
      app.route('/auth', PasswordAuthService());
      app.onError((err: any, c: any) => {
        if (err.code && err.statusCode) {
          return c.json(
            {
              success: false,
              error: {
                code: err.code,
                message: err.message,
                details: err.details,
              },
            },
            err.statusCode,
          );
        }
        return c.json(
          {
            success: false,
            error: {
              code: "INTERNAL_ERROR",
              message: err.message || "An unexpected error occurred",
            },
          },
          500,
        );
      });

      const fetchApp = {
        ...app,
        fetch: (request: Request, env: Env) =>
          app.fetch(request, { ...env, DB: db }),
      };
      api = createTestClient(fetchApp, smtpEnv);
    });

    it("should allow first send, then reject second send within 1 minute from same IP", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => new Response("", { status: 200 });

      try {
        const req1 = new Request(`http://localhost/auth/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "1.2.3.4",
          },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const res1 = await app.fetch(req1, smtpEnv);
        const data1 = await res1.json() as any;
        expect(res1.ok).toBe(true);
        expect(data1.success).toBe(true);

        const req2 = new Request(`http://localhost/auth/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "1.2.3.4",
          },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const res2 = await app.fetch(req2, smtpEnv);
        const data2 = await res2.json() as any;
        expect(res2.ok).toBe(false);
        expect(data2.error?.message).toBe("Please wait before requesting another code");
      } finally {
        global.fetch = originalFetch;
      }
    });

    it("should allow send from different IPs", async () => {
      const originalFetch = global.fetch;
      global.fetch = async () => new Response("", { status: 200 });

      try {
        const req1 = new Request(`http://localhost/auth/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "1.2.3.4",
          },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const res1 = await app.fetch(req1, smtpEnv);
        expect(res1.ok).toBe(true);

        const req2 = new Request(`http://localhost/auth/email/send`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "CF-Connecting-IP": "5.6.7.8",
          },
          body: JSON.stringify({ email: "user@example.com" }),
        });
        const res2 = await app.fetch(req2, smtpEnv);
        expect(res2.ok).toBe(true);
      } finally {
        global.fetch = originalFetch;
      }
    });
  });
});

// Hash password using SHA-256
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}
