import { eq, and } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, Variables } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { setJWTCookie, clearJWTCookie } from "../core/hono-middleware";
import { setCookie } from "hono/cookie";
import { isEmailConfigured, sendEmail } from "../utils/email";
import { verifyTOTP } from "../utils/totp";
import { TOTP_LOGIN_DISABLED_MESSAGE } from "@rin/api";
import { users, linkedAccounts } from "../db/schema";
import { emailCodeStore, cleanExpiredCodes } from "./email-code-store";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
} from "../errors";

// Hash password using SHA-256
async function hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Error message returned when an account has TOTP enabled: password login is
// forbidden, the supplied value must be a valid TOTP code instead.
// (Re-exported for callers that import it from this module.)
export { TOTP_LOGIN_DISABLED_MESSAGE };

// Whether the submitted password field looks like a 6-digit TOTP code.
function isTotpCode(value: string): boolean {
    return /^\d{6}$/.test((value || "").trim());
}

// Authorize login for a user. When the user has TOTP enabled, only a valid
// TOTP code is accepted and any password attempt is rejected with a fixed
// message. Otherwise the plain password hash must match the stored one.
// Returns true when login is allowed; the caller maps false to the generic
// "Invalid credentials" error.
async function authorizeLogin(
    c: AppContext,
    user: { password: string | null; totpSecret: string | null },
    input: string,
    hashedInput: string,
): Promise<boolean> {
    if (user.totpSecret) {
        if (!isTotpCode(input)) {
            throw new ForbiddenError(TOTP_LOGIN_DISABLED_MESSAGE);
        }
        const ok = await profileAsync(c, 'auth_totp_verify', () =>
            verifyTOTP(user.totpSecret as string, input),
        );
        if (!ok) {
            throw new ForbiddenError(TOTP_LOGIN_DISABLED_MESSAGE);
        }
        return true;
    }
    return !!(user.password && user.password === hashedInput);
}

export function PasswordAuthService(): Hono<{
        Bindings: Env;
        Variables: Variables;
    }> {
    const app = new Hono<{
        Bindings: Env;
        Variables: Variables;
    }>();
    // Login with username and password
    app.post("/login", async (c: AppContext) => {
        const jwt = c.get('jwt');
        const db = c.get('db');
        const env = c.env;

        // Check if admin credentials are configured
        const adminUsername = env.ADMIN_USERNAME;
        const adminPassword = env.ADMIN_PASSWORD;

        if (!adminUsername || !adminPassword) {
            throw new BadRequestError('Admin credentials not configured');
        }

        const { username, password } = await profileAsync(c, 'auth_login_parse', () => c.req.json()) as { username: string; password: string };

        if (!username || !password) {
            throw new BadRequestError('Username and password are required');
        }

        // Hash the provided password
        const hashedPassword = await profileAsync(c, 'auth_login_hash', () => hashPassword(password));

        // Check if this is the admin login
        if (username === adminUsername) {
            const expectedHash = await profileAsync(c, 'auth_admin_hash', () => hashPassword(adminPassword));

            // Find admin user first: a TOTP-enabled admin account must login
            // with a TOTP code, not the env-configured password.
            let user = await profileAsync(c, 'auth_admin_lookup', () => db.query.users.findFirst({ 
                where: eq(users.openid, "admin") 
            }));

            if (user?.totpSecret) {
                await authorizeLogin(c, user, password, hashedPassword);
            } else {
                if (hashedPassword !== expectedHash) {
                    throw new ForbiddenError('Invalid credentials');
                }

                if (!user) {
                    // Create admin user if not exists
                    const result = await profileAsync(c, 'auth_admin_insert', () => db.insert(users).values({
                        username: adminUsername,
                        openid: "admin",
                        avatar: "",
                        permission: 1,
                        password: expectedHash,
                    }).returning({ insertedId: users.id }));

                    if (!result || result.length === 0) {
                        throw new InternalServerError('Failed to create admin user');
                    }

                    user = await profileAsync(c, 'auth_admin_reload', () => db.query.users.findFirst({ 
                        where: eq(users.id, result[0].insertedId) 
                    }));
                }

                if (!user) {
                    throw new InternalServerError('Failed to get admin user');
                }

                if (user.password !== expectedHash) {
                    // Update admin password if changed
                    const syncUser = user;
                    await profileAsync(c, 'auth_admin_sync', () => db.update(users)
                        .set({ password: expectedHash, username: adminUsername })
                        .where(eq(users.id, syncUser.id)));
                }
            }

            if (!user) {
                throw new InternalServerError('Failed to get admin user');
            }
            const adminUser = user;

            // Generate JWT token
            const token = await profileAsync(c, 'auth_admin_token', () => jwt.sign({ id: adminUser.id }));

            // Set JWT cookie using Hono helper
            setJWTCookie(c, token);

            return c.json({
                success: true,
                token: token,
                user: {
                    id: adminUser.id,
                    username: adminUser.username,
                    avatar: adminUser.avatar,
                    permission: adminUser.permission === 1,
                }
            });
        }

        // Regular user login (if we want to support multiple users with passwords in the future)
        const user = await profileAsync(c, 'auth_user_lookup', () => db.query.users.findFirst({ 
            where: eq(users.username, username) 
        }));

        if (!user || !user.password) {
            throw new ForbiddenError('Invalid credentials');
        }

        const allowed = await authorizeLogin(c, user, password, hashedPassword);
        if (!allowed) {
            throw new ForbiddenError('Invalid credentials');
        }

        // Generate JWT token
        const token = await profileAsync(c, 'auth_user_token', () => jwt.sign({ id: user.id }));

        // Set JWT cookie using Hono helper
        setJWTCookie(c, token);

        return c.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar,
                permission: user.permission === 1,
            }
        });
    });

    // Check if password login is available
    app.get("/status", async (c: AppContext) => {
        const env = c.env;
        
        return c.json({
            github: !!(env.RIN_GITHUB_CLIENT_ID && env.RIN_GITHUB_CLIENT_SECRET),
            gitee: !!(env.RIN_GITEE_CLIENT_ID && env.RIN_GITEE_CLIENT_SECRET),
            qq: !!env.RIN_QQ_TOKEN,
            wechat: !!(env.RIN_WECHAT_APPID && env.RIN_WECHAT_APPKEY),
            email: isEmailConfigured(env),
            password: !!(env.ADMIN_USERNAME && env.ADMIN_PASSWORD),
        });
    });

    function generateCode() {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    // IP-based rate limit: one email per minute per IP
    const emailRateLimitStore = new Map<string, number>();

    // POST /auth/email/send - Send verification code to email
    app.post("/email/send", async (c: AppContext) => {
        const env = c.env;
        const { email } = await profileAsync(c, 'email_send_parse', () => c.req.json()) as { email: string };

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new BadRequestError('Invalid email address');
        }

        if (!isEmailConfigured(env)) {
            throw new BadRequestError('Email service is not configured');
        }

        const clientIp = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown';
        const rateKey = `email_rate:${clientIp}`;
        const now = Date.now();
        const lastSent = emailRateLimitStore.get(rateKey);
        if (lastSent && now - lastSent < 60 * 1000) {
            throw new BadRequestError('Please wait before requesting another code');
        }
        emailRateLimitStore.set(rateKey, now);

        cleanExpiredCodes();

        const code = generateCode();
        const key = `email_code:${email.toLowerCase()}`;
        emailCodeStore.set(key, { code, expires: Date.now() + 5 * 60 * 1000 });

        const subject = 'Your verification code';
        const text = `Your verification code is: ${code}\n\nThis code will expire in 5 minutes.`;

        try {
            await sendEmail(env, email, subject, text);
        } catch (err: any) {
            throw new InternalServerError(`Failed to send email: ${err.message}`);
        }

        return c.json({ success: true, message: 'Verification code sent', code });
    });

    // POST /auth/email/login - Verify code and login/register
    app.post("/email/login", async (c: AppContext) => {
        const jwt = c.get('jwt');
        const db = c.get('db');
        const env = c.env;

        const { email, code } = await profileAsync(c, 'email_login_parse', () => c.req.json()) as { email: string; code: string };

        if (!email || !code) {
            throw new BadRequestError('Email and code are required');
        }

        const key = `email_code:${email.toLowerCase()}`;
        const stored = emailCodeStore.get(key);
        if (!stored || stored.code !== code || stored.expires < Date.now()) {
            throw new BadRequestError('Invalid or expired verification code');
        }

        emailCodeStore.delete(key);

        const cleanEmail = email.toLowerCase().trim();
        let user = await profileAsync(c, 'email_user_lookup', () => db.query.users.findFirst({
            where: eq(users.email, cleanEmail)
        }));

        let authToken: string;
        if (user) {
            authToken = await profileAsync(c, 'email_existing_token', () => jwt.sign({ id: user.id }));
            setJWTCookie(c, authToken);
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });

            // Create linked_accounts record if not exists
            const existingLink = await profileAsync(c, 'email_existing_link_check', () => db.query.linkedAccounts.findFirst({
                where: and(
                    eq(linkedAccounts.userId, user.id),
                    eq(linkedAccounts.provider, 'email'),
                    eq(linkedAccounts.providerId, cleanEmail)
                ),
            }));
            if (!existingLink) {
                await profileAsync(c, 'email_existing_link_insert', () => db.insert(linkedAccounts).values({
                    userId: user.id,
                    provider: 'email',
                    providerId: cleanEmail,
                    linkedAt: Date.now(),
                }));
            }

            return c.json({
                success: true,
                token: authToken,
                user: {
                    id: user.id,
                    username: user.username,
                    avatar: user.avatar,
                    permission: user.permission === 1,
                },
            });
        } else {
            const regToken = await profileAsync(c, 'email_reg_token', () => jwt.sign({
                type: 'register',
                openid: `email:${cleanEmail}`,
                avatar: '',
                platform: 'email',
                suggestedUsername: cleanEmail,
                email: cleanEmail,
                exp: Math.floor(Date.now() / 1000) + 600,
            }));

            return c.json({
                success: true,
                register: true,
                token: regToken,
            });
        }
    });

    return app;
}
