import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { LinkedAccountsService } from '../linked-accounts';
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Variables, JWTUtils } from "../../core/hono-types";
import { setupTestApp, TestCacheImpl, cleanupTestDB, createMockEnv } from '../../../tests/fixtures';
import { eq, and } from "drizzle-orm";
import { users, linkedAccounts } from "../../db/schema";

describe('LinkedAccountsService', () => {
    let db: any;
    let sqlite: any;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(LinkedAccountsService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;

        app.onError((err, c) => {
            const error = err as any;
            if (error.code && error.statusCode) {
                return c.json({
                    success: false,
                    error: {
                        code: error.code,
                        message: error.message,
                        details: error.details,
                    },
                }, error.statusCode as any);
            }
            return c.json({
                success: false,
                error: {
                    code: 'INTERNAL_ERROR',
                    message: err.message || 'An unexpected error occurred',
                },
            }, 500);
        });

        // Seed test data
        sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid) VALUES 
                (1, 'user1', 'avatar1.png', 0, 'gh_123'),
                (2, 'user2', 'avatar2.png', 0, 'gh_456')
        `);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    describe('GET /linked-accounts', () => {
        it('should return linked accounts for authenticated user', async () => {
            // Add linked account for user 1
            sqlite.exec(`
                INSERT INTO linked_accounts (user_id, provider, provider_id, linked_at) VALUES 
                    (1, 'github', 'gh_123', 1700000000),
                    (1, 'qq', 'qq:abc123', 1700000001)
            `);

            const res = await app.request('/linked-accounts', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as { accounts: any[] };
            expect(data.accounts).toHaveLength(2);
            expect(data.accounts[0].provider).toBe('github');
            expect(data.accounts[1].provider).toBe('qq');
        });

        it('should return empty array for user with no linked accounts', async () => {
            const res = await app.request('/linked-accounts', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as { accounts: any[] };
            expect(data.accounts).toHaveLength(0);
        });

        it('should require authentication', async () => {
            const res = await app.request('/linked-accounts', {
                method: 'GET'
            }, env);

            expect(res.status).toBe(403);
        });
    });

    describe('POST /bind/:provider', () => {
        it('should bind email with valid verification code', async () => {
            // Setup email code store in env
            const emailCodeStore = new Map<string, { code: string; expires: number }>();
            const envWithStore = {
                ...env,
                emailCodeStore: {
                    get: (key: string) => emailCodeStore.get(key),
                    set: (key: string, value: any) => emailCodeStore.set(key, value),
                    delete: (key: string) => emailCodeStore.delete(key),
                }
            };

            // Pre-store a verification code
            emailCodeStore.set('email_code:test@example.com', { code: '123456', expires: Date.now() + 300000 });

            const res = await app.request('/bind/email', {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: 'test@example.com', code: '123456' })
            }, envWithStore);

            expect(res.status).toBe(200);
            const data = await res.json() as { success: boolean; provider: string };
            expect(data.success).toBe(true);
            expect(data.provider).toBe('email');

            // Verify link was created
            const links = await db.query.linkedAccounts.findMany();
            expect(links).toHaveLength(1);
            expect(links[0].provider).toBe('email');
            expect(links[0].providerId).toBe('test@example.com');
        });

        it('should reject binding email already bound to another user', async () => {
            const emailCodeStore = new Map<string, { code: string; expires: number }>();
            const envWithStore = {
                ...env,
                emailCodeStore: {
                    get: (key: string) => emailCodeStore.get(key),
                    set: (key: string, value: any) => emailCodeStore.set(key, value),
                    delete: (key: string) => emailCodeStore.delete(key),
                }
            };

            // User 2 already has this email
            sqlite.exec(`
                INSERT INTO users (id, username, avatar, permission, openid, email) VALUES 
                    (3, 'user3', 'avatar3.png', 0, 'gh_789', 'existing@example.com')
            `);

            emailCodeStore.set('email_code:existing@example.com', { code: '123456', expires: Date.now() + 300000 });

            const res = await app.request('/bind/email', {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email: 'existing@example.com', code: '123456' })
            }, envWithStore);

            expect(res.status).toBe(409);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toContain('already bound');
        });

        it('should reject invalid provider', async () => {
            const res = await app.request('/bind/invalid', {
                method: 'POST',
                headers: { 
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json'
                }
            }, env);

            expect(res.status).toBe(400);
        });

        it('should require authentication', async () => {
            const res = await app.request('/bind/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }, env);

            expect(res.status).toBe(403);
        });
    });

    describe('DELETE /unbind/:provider', () => {
        it('should unbind a linked account when user has other login methods', async () => {
            // User 1 has password (other login method)
            sqlite.exec(`
                UPDATE users SET password = 'hashed_password' WHERE id = 1
            `);
            sqlite.exec(`
                INSERT INTO linked_accounts (user_id, provider, provider_id, linked_at) VALUES 
                    (1, 'github', 'gh_123', 1700000000)
            `);

            const res = await app.request('/unbind/github', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);

            expect(res.status).toBe(200);
            const data = await res.json() as { success: boolean; provider: string };
            expect(data.success).toBe(true);
            expect(data.provider).toBe('github');

            // Verify link was deleted
            const links = await db.query.linkedAccounts.findMany();
            expect(links).toHaveLength(0);
        });

        it('should reject unbinding the only login method', async () => {
            // User 1 only has GitHub linked and no password
            sqlite.exec(`
                INSERT INTO linked_accounts (user_id, provider, provider_id, linked_at) VALUES 
                    (1, 'github', 'gh_123', 1700000000)
            `);

            const res = await app.request('/unbind/github', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);

            expect(res.status).toBe(403);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toContain('only login method');
        });

        it('should reject unbinding non-existent linked account', async () => {
            const res = await app.request('/unbind/github', {
                method: 'DELETE',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);

            expect(res.status).toBe(404);
        });

        it('should require authentication', async () => {
            const res = await app.request('/unbind/github', {
                method: 'DELETE'
            }, env);

            expect(res.status).toBe(403);
        });
    });
});
