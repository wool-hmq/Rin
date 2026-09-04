import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { users, linkedAccounts } from "../db/schema";
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
            const stored = (c.env as any).emailCodeStore?.get(key);

            if (!stored || stored.code !== code || stored.expires < Date.now()) {
                throw new BadRequestError('Invalid or expired verification code');
            }

            (c.env as any).emailCodeStore?.delete(key);

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

        // For OAuth providers (github, gitee, qq), the binding is done during OAuth callback
        // This endpoint just returns a message indicating the user should use OAuth flow
        return c.json({
            success: true,
            provider,
            message: `Please complete the ${provider} OAuth flow to bind your account`,
            bindUrl: `/api/user/${provider}?bind=true`,
        });
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
