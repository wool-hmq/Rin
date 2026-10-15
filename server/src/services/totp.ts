import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { users, cache } from "../db/schema";
import { generateTOTPSecret, verifyTOTP } from "../utils/totp";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
} from "../errors";

// Pending TOTP setup records live in the cache table so that any logged-in
// user can start a binding flow and confirm it within the TTL window.
const TOTP_SETUP_TYPE = "totp_setup";
const TOTP_SETUP_TTL_MS = 10 * 60 * 1000;

export function TotpService(): Hono {
    const app = new Hono();

    // GET /user/totp/status - Whether the current user has TOTP enabled
    app.get('/status', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const user = await profileAsync(c, 'totp_status_lookup', () => db.query.users.findFirst({
            where: eq(users.id, uid),
            columns: { totpSecret: true },
        }));

        return c.json({ success: true, enabled: !!(user?.totpSecret) });
    });

    // POST /user/totp/setup - Start binding TOTP, returns a secret the user
    // enters into their authenticator app. No QR code is generated.
    app.post('/setup', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const user = await profileAsync(c, 'totp_setup_lookup', () => db.query.users.findFirst({
            where: eq(users.id, uid),
            columns: { totpSecret: true },
        }));

        if (user?.totpSecret) {
            throw new ConflictError('TOTP is already enabled');
        }

        const secret = generateTOTPSecret();
        const now = Date.now();

        // Upsert the pending setup record.
        const existing = await profileAsync(c, 'totp_setup_find', () => db.query.cache.findFirst({
            where: and(
                eq(cache.key, `totp:${uid}`),
                eq(cache.type, TOTP_SETUP_TYPE),
            ),
        }));

        if (existing) {
            await profileAsync(c, 'totp_setup_update', () => db.update(cache)
                .set({ value: secret, expiresAt: now + TOTP_SETUP_TTL_MS, updatedAt: new Date() })
                .where(eq(cache.id, existing.id)));
        } else {
            await profileAsync(c, 'totp_setup_insert', () => db.insert(cache).values({
                key: `totp:${uid}`,
                value: secret,
                type: TOTP_SETUP_TYPE,
                expiresAt: now + TOTP_SETUP_TTL_MS,
            }));
        }

        return c.json({ success: true, secret, expiresIn: TOTP_SETUP_TTL_MS });
    });

    // POST /user/totp/confirm - Verify a 6-digit code against the pending
    // secret and enable TOTP by persisting the secret on the user.
    app.post('/confirm', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const body = await c.req.json().catch(() => ({})) as { code?: string };
        const code = (body.code || '').trim();
        if (!/^\d{6}$/.test(code)) {
            throw new BadRequestError('A 6-digit TOTP code is required');
        }

        const pending = await profileAsync(c, 'totp_confirm_find', () => db.query.cache.findFirst({
            where: and(
                eq(cache.key, `totp:${uid}`),
                eq(cache.type, TOTP_SETUP_TYPE),
            ),
        }));

        if (!pending) {
            throw new BadRequestError('No pending TOTP setup, start a new one first');
        }

        if (pending.expiresAt && (pending.expiresAt as number) < Date.now()) {
            await profileAsync(c, 'totp_confirm_delete_expired', () => db.delete(cache).where(eq(cache.id, pending.id)));
            throw new BadRequestError('TOTP setup expired, start over');
        }

        const valid = await profileAsync(c, 'totp_confirm_verify', () => verifyTOTP(pending.value, code));
        if (!valid) {
            throw new BadRequestError('Invalid TOTP code');
        }

        await profileAsync(c, 'totp_confirm_update', () => db.update(users)
            .set({ totpSecret: pending.value })
            .where(eq(users.id, uid)));

        await profileAsync(c, 'totp_confirm_delete', () => db.delete(cache).where(eq(cache.id, pending.id)));

        return c.json({ success: true, enabled: true });
    });

    // DELETE /user/totp - Disable TOTP for the current user.
    app.delete('/', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const user = await profileAsync(c, 'totp_unbind_lookup', () => db.query.users.findFirst({
            where: eq(users.id, uid),
            columns: { id: true, totpSecret: true },
        }));

        if (!user) {
            throw new NotFoundError('User');
        }

        if (!user.totpSecret) {
            throw new BadRequestError('TOTP is not enabled');
        }

        await profileAsync(c, 'totp_unbind_update', () => db.update(users)
            .set({ totpSecret: null })
            .where(eq(users.id, uid)));

        return c.json({ success: true, enabled: false });
    });

    return app;
}