import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { users, linkedAccounts, cache } from "../db/schema";
import { emailCodeStore, cleanExpiredCodes } from "./email-code-store";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    NotFoundError,
    InternalServerError,
} from "../errors";

export function LinkedAccountsService(): Hono {
    const app = new Hono();

    // GET /user/linked-accounts - Get current user's linked accounts
    app.get('/linked-accounts', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const accounts = await profileAsync(c, 'linked_accounts_list', () => db.query.linkedAccounts.findMany({
            where: eq(linkedAccounts.userId, uid),
            columns: {
                id: false,
                userId: false,
            },
        }));

        return c.json({ accounts });
    });

    // POST /user/bind/:provider - Bind a third-party account to current user
    app.post('/bind/:provider', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');
        const provider = c.req.param('provider');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const validProviders = ['github', 'gitee', 'qq', 'email'];
        if (!validProviders.includes(provider)) {
            throw new BadRequestError('Invalid provider');
        }

        // For email binding, require email verification code
        if (provider === 'email') {
            const body = await c.req.json().catch(() => ({})) as { email?: string; code?: string };
            const { email, code } = body;

            if (!email || !code) {
                throw new BadRequestError('Email and verification code are required');
            }

            const cleanEmail = email.toLowerCase().trim();
            const key = `email_code:${cleanEmail}`;
            cleanExpiredCodes();
            const stored = emailCodeStore.get(key);

            if (!stored || stored.code !== code || stored.expires < Date.now()) {
                throw new BadRequestError('Invalid or expired verification code');
            }

            emailCodeStore.delete(key);

            // Check if email is already bound to another user
            const existingEmailUser = await profileAsync(c, 'bind_email_lookup', () => db.query.users.findFirst({
                where: eq(users.email, cleanEmail),
            }));

            if (existingEmailUser && existingEmailUser.id !== uid) {
                throw new ConflictError('This email is already bound to another user');
            }

            // Check if this email is already linked to current user
            const existingLink = await profileAsync(c, 'bind_email_link_check', () => db.query.linkedAccounts.findFirst({
                where: and(
                    eq(linkedAccounts.userId, uid),
                    eq(linkedAccounts.provider, 'email'),
                    eq(linkedAccounts.providerId, cleanEmail)
                ),
            }));

            if (existingLink) {
                return c.json({ success: true, provider: 'email', linked: true });
            }

            // Create link
            await profileAsync(c, 'bind_email_insert', () => db.insert(linkedAccounts).values({
                userId: uid,
                provider: 'email',
                providerId: cleanEmail,
                linkedAt: Date.now(),
            }));

            // Update user email if not set
            const currentUser = await profileAsync(c, 'bind_email_user_lookup', () => db.query.users.findFirst({
                where: eq(users.id, uid),
            }));

            if (currentUser && !currentUser.email) {
                await profileAsync(c, 'bind_email_user_update', () => db.update(users).set({ email: cleanEmail }).where(eq(users.id, uid)));
            }

            return c.json({ success: true, provider: 'email', linked: true });
        }

        // For OAuth providers, return bind URL for redirect flow
        return c.json({
            success: true,
            provider,
            bindUrl: `/api/user/${provider}?bind=true`,
        });
    });

    // POST /user/verify-bind-code - Verify bind code and link OAuth account
    app.post('/verify-bind-code', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const body = await c.req.json().catch(() => ({})) as { code?: string };
        const code = (body.code || '').trim().toUpperCase();

        if (!code) {
            throw new BadRequestError('Bind code is required');
        }

        // Find bind code
        const bindRecord = await profileAsync(c, 'bind_code_lookup', () => db.query.cache.findFirst({
            where: and(
                eq(cache.key, code),
                eq(cache.type, 'bind_code'),
            ),
        }));

        if (!bindRecord) {
            throw new BadRequestError('Invalid or expired bind code');
        }

        // Check expiration
        if (bindRecord.expiresAt && bindRecord.expiresAt < Math.floor(Date.now() / 1000)) {
            await profileAsync(c, 'bind_code_delete_expired', () => db.delete(cache).where(eq(cache.id, bindRecord.id)));
            throw new BadRequestError('Bind code has expired');
        }

        let provider: string;
        let providerId: string;
        try {
            const payload = JSON.parse(bindRecord.value) as { provider: string; providerId: string };
            provider = payload.provider;
            providerId = payload.providerId;
        } catch {
            throw new BadRequestError('Invalid bind code data');
        }

        const validProviders = ['github', 'gitee', 'qq'];
        if (!validProviders.includes(provider)) {
            throw new BadRequestError('Invalid provider in bind code');
        }

        // Check if this provider account is already linked to another user
        const existingLink = await profileAsync(c, 'verify_bind_existing_link', () => db.query.linkedAccounts.findFirst({
            where: and(
                eq(linkedAccounts.provider, provider),
                eq(linkedAccounts.providerId, providerId),
            ),
        }));

        if (existingLink && existingLink.userId !== uid) {
            throw new ConflictError('This account is already bound to another user');
        }

        // Check if already linked to current user
        const currentLink = await profileAsync(c, 'verify_bind_current_link', () => db.query.linkedAccounts.findFirst({
            where: and(
                eq(linkedAccounts.userId, uid),
                eq(linkedAccounts.provider, provider),
                eq(linkedAccounts.providerId, providerId),
            ),
        }));

        if (!currentLink) {
            await profileAsync(c, 'verify_bind_insert', () => db.insert(linkedAccounts).values({
                userId: uid,
                provider,
                providerId,
                linkedAt: Date.now(),
            }));
        }

        // Delete used bind code
        await profileAsync(c, 'bind_code_delete', () => db.delete(cache).where(eq(cache.id, bindRecord.id)));

        return c.json({ success: true, provider });
    });

    // DELETE /user/unbind/:provider - Unbind a third-party account from current user
    app.delete('/unbind/:provider', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');
        const provider = c.req.param('provider');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const validProviders = ['github', 'gitee', 'qq', 'email'];
        if (!validProviders.includes(provider)) {
            throw new BadRequestError('Invalid provider');
        }

        // Get current user
        const currentUser = await profileAsync(c, 'unbind_user_lookup', () => db.query.users.findFirst({
            where: eq(users.id, uid),
        }));

        if (!currentUser) {
            throw new NotFoundError('User');
        }

        // Find the linked account
        const linkedAccount = await profileAsync(c, 'unbind_link_lookup', () => db.query.linkedAccounts.findFirst({
            where: and(
                eq(linkedAccounts.userId, uid),
                eq(linkedAccounts.provider, provider)
            ),
        }));

        if (!linkedAccount) {
            throw new NotFoundError('Linked account');
        }

        // Determine if this is the primary login method (users.openid matches)
        const isPrimaryLogin = currentUser.openid === linkedAccount.providerId;

        // Check if user has other login methods
        const hasPassword = !!currentUser.password;
        const otherLinks = await profileAsync(c, 'unbind_other_links', () => db.query.linkedAccounts.findMany({
            where: and(
                eq(linkedAccounts.userId, uid),
                eq(linkedAccounts.provider, provider)
            ),
        }));

        const otherProviders = otherLinks.filter(link => link.provider !== provider);

        // If unbinding primary login method and no other methods exist, reject
        if (isPrimaryLogin && !hasPassword && otherProviders.length === 0) {
            throw new ForbiddenError('Cannot unbind the only login method');
        }

        // Delete the link
        await profileAsync(c, 'unbind_delete', () => db.delete(linkedAccounts).where(eq(linkedAccounts.id, linkedAccount.id)));

        // If this was the primary login method, update users.openid to another method
        if (isPrimaryLogin) {
            let newOpenid = linkedAccount.providerId;
            
            // Try to use another linked account as primary
            if (otherProviders.length > 0) {
                newOpenid = otherProviders[0].providerId;
            } else if (hasPassword) {
                // For password-only users, use a special openid
                newOpenid = 'admin';
            }

            await profileAsync(c, 'unbind_update_openid', () => db.update(users).set({ openid: newOpenid }).where(eq(users.id, uid)));
        }

        return c.json({ success: true, provider });
    });

    return app;
}
