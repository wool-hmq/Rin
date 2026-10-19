import { eq, and } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext, Variables } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { setJWTCookie, clearJWTCookie } from "../core/hono-middleware";
import { setCookie } from "hono/cookie";
import { isEmailConfigured, sendEmail } from "../utils/email";
import { verifyTOTP } from "../utils/totp";
import { TOTP_LOGIN_DISABLED_MESSAGE, LOGIN_RATE_LIMIT_PREFIX } from "@rin/api";
import { users, linkedAccounts, recoveryCodes } from "../db/schema";
import { emailCodeStore, cleanExpiredCodes } from "./email-code-store";
import {
    BadRequestError,
    ForbiddenError,
    InternalServerError,
    NotFoundError,
    RateLimitError,
} from "../errors";
import {
    IP_MAX_ATTEMPTS,
    USER_MAX_ATTEMPTS,
    checkLoginRateLimit,
    clearLoginRateLimit,
    recordLoginFailure,
} from "./login-rate-limit";
import {
    hashRecoveryCode,
    normalizeRecoveryCode,
} from "../utils/recovery-code";

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

// Allowed time steps (30s each) on either side of the current window.
// A window of 1 accepts codes from the previous and next 30s periods.
export const TOTP_WINDOW_STEPS = 1;

// Whether the submitted password field looks like a 6-digit TOTP code.
function isTotpCode(value: string): boolean {
    return /^\d{6}$/.test((value || "").trim());
}

// Best-effort client IP extraction. OAuth/email logins are not throttled, so
// this is only consulted for password/TOTP logins.
function getClientIp(c: AppContext): string {
    return (
        c.req.header("CF-Connecting-IP") ||
        c.req.header("x-real-ip") ||
        (c.req.header("x-forwarded-for") || "").split(",")[0]?.trim() ||
        "unknown"
    );
}

/**
 * Record failed login attempts for both the client IP and the account, then
 * throw an error carrying the rate-limit state. When a cooldown has just been
 * triggered the message is `LOGIN_RATE_LIMIT:ip:blocked` / `:user:blocked`;
 * when only 1-2 attempts remain it is `LOGIN_RATE_LIMIT:ip:<remaining>` etc.
 * Otherwise the original error (if provided) is re-thrown so callers like the
 * TOTP-disabled hint keep working.
 */
async function rejectLogin(c: AppContext, ip: string, username: string, fallbackErr?: Error): Promise<never> {
    const ipResult = await recordLoginFailure(c, "ip", ip, IP_MAX_ATTEMPTS);
    const userResult = await recordLoginFailure(c, "user", username, USER_MAX_ATTEMPTS);

    const messages: string[] = [];
    if (ipResult.locked) messages.push(`${LOGIN_RATE_LIMIT_PREFIX}:ip:blocked`);
    else if (ipResult.remaining > 0 && ipResult.remaining <= 2) messages.push(`${LOGIN_RATE_LIMIT_PREFIX}:ip:${ipResult.remaining}`);
    if (userResult.locked) messages.push(`${LOGIN_RATE_LIMIT_PREFIX}:user:blocked`);
    else if (userResult.remaining > 0 && userResult.remaining <= 2) messages.push(`${LOGIN_RATE_LIMIT_PREFIX}:user:${userResult.remaining}`);

    if (messages.length > 0) {
        throw new RateLimitError(messages.join(";"));
    }
    if (fallbackErr) {
        throw fallbackErr;
    }
    throw new ForbiddenError('Invalid credentials');
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

        // Throttle password/TOTP logins. OAuth and email logins are not limited.
        const ip = getClientIp(c);
        const ipCheck = await checkLoginRateLimit(c, "ip", ip);
        if (ipCheck.blocked) {
            throw new RateLimitError(`${LOGIN_RATE_LIMIT_PREFIX}:ip:blocked`);
        }
        const userCheck = await checkLoginRateLimit(c, "user", username);
        if (userCheck.blocked) {
            throw new RateLimitError(`${LOGIN_RATE_LIMIT_PREFIX}:user:blocked`);
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
                try {
                    await authorizeLogin(c, user, password, hashedPassword);
                } catch (err) {
                    await rejectLogin(c, ip, username, err as Error);
                }
            } else {
                if (hashedPassword !== expectedHash) {
                    await rejectLogin(c, ip, username);
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

            // Successful admin password/TOTP login resets both attempt counters.
            await clearLoginRateLimit(c, "ip", ip);
            await clearLoginRateLimit(c, "user", username);

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
        let user = await profileAsync(c, 'auth_user_lookup', () => db.query.users.findFirst({ 
            where: eq(users.username, username) 
        }));

        // Users created through OAuth or email login have no password but may
        // still enable TOTP. Such accounts must be allowed to login with a
        // valid TOTP code, so only reject when neither factor exists.
        if (!user || (!user.password && !user.totpSecret)) {
            await rejectLogin(c, ip, username);
        }
        user = user!;

        const allowed = await authorizeLogin(c, user, password, hashedPassword);
        if (!allowed) {
            await rejectLogin(c, ip, username);
        }

        // Successful password/TOTP login resets both attempt counters.
        await clearLoginRateLimit(c, "ip", ip);
        await clearLoginRateLimit(c, "user", username);

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

    // POST /auth/recover - Restore an account with a TOTP recovery code.
    // On success the user's TOTP is disabled so they can log in with a password
    // again. All remaining recovery codes for the account are invalidated.
    app.post("/recover", async (c: AppContext) => {
        const db = c.get('db');
        const env = c.env;

        if (!env.ADMIN_USERNAME || !env.ADMIN_PASSWORD) {
            throw new BadRequestError('Admin credentials not configured');
        }

        const { username, recoveryCode } = await profileAsync(c, 'auth_recover_parse', () => c.req.json()) as { username: string; recoveryCode: string };

        if (!username || !recoveryCode) {
            throw new BadRequestError('Username and recovery code are required');
        }

        const normalized = normalizeRecoveryCode(recoveryCode);
        if (normalized.length !== 8) {
            throw new BadRequestError('Recovery code must be 8 digits');
        }

        // The account-bound throttle applies here too to slow brute-forcing.
        const ip = getClientIp(c);
        const preIp = await checkLoginRateLimit(c, "ip", ip);
        if (preIp.blocked) {
            throw new RateLimitError(`${LOGIN_RATE_LIMIT_PREFIX}:ip:blocked`);
        }
        const preUser = await checkLoginRateLimit(c, "user", username);
        if (preUser.blocked) {
            throw new RateLimitError(`${LOGIN_RATE_LIMIT_PREFIX}:user:blocked`);
        }

        const user = await profileAsync(c, 'auth_recover_user', () => db.query.users.findFirst({
            where: eq(users.username, username),
            columns: { id: true, username: true, totpSecret: true },
        }));

        if (!user || !user.totpSecret) {
            // Record the attempt as a failure against both scopes to avoid
            // leaking whether the account or code was wrong.
            await recordLoginFailure(c, "ip", ip, IP_MAX_ATTEMPTS);
            await recordLoginFailure(c, "user", username, USER_MAX_ATTEMPTS);
            throw new BadRequestError('Invalid username or recovery code');
        }

        const codeHash = await hashRecoveryCode(normalized);
        const match = await profileAsync(c, 'auth_recover_match', () => db.query.recoveryCodes.findFirst({
            where: and(
                eq(recoveryCodes.userId, user.id),
                eq(recoveryCodes.codeHash, codeHash),
            ),
        }));

        if (!match) {
            await recordLoginFailure(c, "ip", ip, IP_MAX_ATTEMPTS);
            await recordLoginFailure(c, "user", username, USER_MAX_ATTEMPTS);
            throw new BadRequestError('Invalid username or recovery code');
        }

        // Success: disable TOTP and remove all recovery codes for this account.
        await profileAsync(c, 'auth_recover_disable_totp', () => db.update(users)
            .set({ totpSecret: null })
            .where(eq(users.id, user.id)));
        await profileAsync(c, 'auth_recover_clear_codes', () => db.delete(recoveryCodes)
            .where(eq(recoveryCodes.userId, user.id)));

        await clearLoginRateLimit(c, "ip", ip);
        await clearLoginRateLimit(c, "user", username);

        return c.json({ success: true });
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
