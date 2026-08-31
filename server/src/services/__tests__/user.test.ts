import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { UserService } from '../user';
import { Hono } from "hono";
import { createMiddleware } from "hono/factory";
import type { Variables, JWTUtils, OAuth2Utils } from "../../core/hono-types";
import { setupTestApp, TestCacheImpl, cleanupTestDB, createMockEnv } from '../../../tests/fixtures';
import { createJWT } from '../../utils/jwt';
import type { Database } from 'bun:sqlite';

describe('UserService', () => {
    let db: any;
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(UserService);
        db = ctx.db;
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;
        
        // Add error handler
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
        await seedTestData(sqlite);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    async function seedTestData(sqlite: Database) {
        sqlite.exec(`
            INSERT INTO users (id, username, avatar, permission, openid) VALUES 
                (1, 'user1', 'avatar1.png', 0, 'gh_123'),
                (2, 'admin', 'admin.png', 1, 'gh_456')
        `);
    }

    describe('GET /github - Initiate GitHub OAuth', () => {
        it('should redirect to GitHub OAuth', async () => {
            const res = await app.request('/github', {
                method: 'GET',
                headers: { 'Referer': 'http://localhost:5173/' }
            }, env);
            
            expect(res.status).toBe(302);
            const location = res.headers.get('Location');
            expect(location).toContain('github.com');
            expect(location).toContain('state=');
            expect(location).toContain('redirect_uri=');
            expect(decodeURIComponent(location || '')).toContain('/api/user/github/callback');
        });

        it('should require referer header', async () => {
            const res = await app.request('/github', { method: 'GET' }, env);
            
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Referer header is required');
        });

        it('should return 400 if OAuth not configured', async () => {
            const envNoOAuth = createMockEnv({
                RIN_GITHUB_CLIENT_ID: '',
                RIN_GITHUB_CLIENT_SECRET: '',
            });
            
            const appNoOAuth = new Hono<{ Bindings: Env; Variables: Variables }>();
            appNoOAuth.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
                c.set('db', db);
                c.set('cache', new TestCacheImpl());
                c.set('serverConfig', new TestCacheImpl());
                c.set('clientConfig', new TestCacheImpl());
                c.set('jwt', {
                    sign: async (payload: any) => `mock_token_${payload.id}`,
                    verify: async (token: string) => null,
                } as JWTUtils);
                c.set('oauth2', undefined);
                c.set('env', envNoOAuth);
                await next();
            }));
            appNoOAuth.route('/', UserService());
            
            // Error handler for appNoOAuth
            appNoOAuth.onError((err, c) => {
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
            
            const res = await appNoOAuth.request('/github', {
                method: 'GET',
                headers: { 'Referer': 'http://localhost:5173/' }
            }, envNoOAuth);
            
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('GitHub OAuth is not configured');
        });

        it('should set redirect_to cookie', async () => {
            const res = await app.request('/github', {
                method: 'GET',
                headers: { 'Referer': 'http://localhost:5173/feed/123' }
            }, env);
            
            expect(res.status).toBe(302);
            const setCookie = res.headers.get('Set-Cookie');
            expect(setCookie).toContain('redirect_to');
        });
    });

    describe('GET /gitee - Initiate Gitee OAuth', () => {
        it('should redirect to Gitee OAuth with redirect_uri', async () => {
            const res = await app.request('/gitee', {
                method: 'GET',
                headers: { 'Referer': 'http://localhost:5173/' }
            }, env);

            expect(res.status).toBe(302);
            const location = res.headers.get('Location');
            expect(location).toContain('gitee.com');
            expect(location).toContain('state=');
            expect(location).toContain('redirect_uri=');
            expect(decodeURIComponent(location || '')).toContain('/api/user/gitee/callback');
        });

        it('should require referer header', async () => {
            const res = await app.request('/gitee', { method: 'GET' }, env);

            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Referer header is required');
        });
    });

    describe('GET /gitee/callback - Gitee OAuth callback', () => {
        it('should authenticate existing user', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 'gh_123',
                    login: 'gitee_user',
                    name: 'Gitee User',
                    avatar_url: 'https://gitee.com/avatar.png'
                }), { status: 200 });
            };

            try {
                const res = await app.request('/gitee/callback?code=valid_code&state=mock_state', {
                    method: 'GET',
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                }, env);

                expect(res.status).toBe(302);
                const location = res.headers.get('Location');
                expect(location).toContain('/callback');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should reject invalid state', async () => {
            const res = await app.request('/gitee/callback?code=valid_code&state=wrong_state', {
                method: 'GET',
                headers: {
                    'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                }
            }, env);

            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Invalid state parameter');
        });
    });

    describe('GET /github/callback - GitHub OAuth callback', () => {
        it('should authenticate existing user', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 'gh_123',
                    login: 'user1',
                    name: 'User One',
                    avatar_url: 'https://github.com/avatar.png'
                }), { status: 200 });
            };

            try {
                const res = await app.request('/github/callback?code=valid_code&state=mock_state', {
                    method: 'GET',
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                }, env);
                
                expect(res.status).toBe(302);
                const location = res.headers.get('Location');
                expect(location).toContain('/callback');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should not overwrite the existing username on re-login', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 'gh_123',
                    login: 'github_handle',
                    name: 'GitHub Handle',
                    avatar_url: 'https://github.com/new_avatar.png'
                }), { status: 200 });
            };

            try {
                await app.request('/github/callback?code=valid_code&state=mock_state', {
                    method: 'GET',
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                }, env);

                const row = sqlite.prepare("SELECT username, avatar FROM users WHERE id = 1").get() as any;
                expect(row.username).toBe('user1');
                expect(row.avatar).toBe('https://github.com/new_avatar.png');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('should reject invalid state', async () => {
            const res = await app.request('/github/callback?code=valid_code&state=wrong_state', {
                method: 'GET',
                headers: {
                    'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                }
            }, env);
            
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Invalid state parameter');
        });
    });

    describe('GET /xinyueqq - Xinyue QQ OAuth', () => {
        function buildQQApp(overrides: Partial<Env> = {}) {
            const env = createMockEnv({
                RIN_QQ_TOKEN: 'qq_token_123',
                RIN_QQ_CALLBACK_URL: 'https://jiaoblog.dpdns.org/api/user/xinyueqq/callback',
                ...overrides,
            });
            const a = new Hono<{ Bindings: Env; Variables: Variables }>();
            a.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
                c.set('db', db);
                c.set('cache', new TestCacheImpl());
                c.set('serverConfig', new TestCacheImpl());
                c.set('clientConfig', new TestCacheImpl());
                c.set('jwt', {
                    sign: async (payload: any) => `mock_token_${payload.id ?? 'reg'}`,
                    verify: async () => null,
                } as JWTUtils);
                c.set('oauth2', undefined);
                c.set('env', env);
                await next();
            }));
            a.route('/', UserService());
            a.onError((err, c) => {
                const error = err as any;
                if (error.code && error.statusCode) {
                    return c.json({ success: false, error: { code: error.code, message: error.message, details: error.details } }, error.statusCode as any);
                }
                return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'An unexpected error occurred' } }, 500);
            });
            return { app: a, env };
        }

        it('should redirect to 心月互联 with token, state (msg) and display', async () => {
            const { app: a, env } = buildQQApp();
            const res = await a.request('/xinyueqq', {
                method: 'GET',
                headers: {
                    'Referer': 'http://localhost:5173/login',
                    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1'
                }
            }, env);

            expect(res.status).toBe(302);
            const location = res.headers.get('Location') || '';
            expect(location).toContain('qq.wch666.com/api/qq.php');
            expect(location).toContain('token=qq_token_123');
            expect(location).toContain('display=mobile');
            expect(location).toContain('msg=');
            expect(res.headers.get('Set-Cookie')).toContain('qq_state');
        });

        it('should require referer header', async () => {
            const { app: a, env } = buildQQApp();
            const res = await a.request('/xinyueqq', { method: 'GET' }, env);
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Referer header is required');
        });

        it('should return 400 if QQ login is not configured', async () => {
            const { app: a, env } = buildQQApp({ RIN_QQ_TOKEN: '', RIN_QQ_CALLBACK_URL: '' });
            const res = await a.request('/xinyueqq', {
                method: 'GET',
                headers: { 'Referer': 'http://localhost:5173/' }
            }, env);
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('QQ login is not configured');
        });

        it('callback should log in an existing QQ user and refresh avatar only', async () => {
            sqlite.exec(`INSERT INTO users (id, username, avatar, permission, openid) VALUES (3, 'oldqq', 'old.png', 0, 'qq:qq_abc')`);
            const originalFetch = global.fetch;
            global.fetch = async () => new Response(
                JSON.stringify({ openid: 'qq_abc', nickname: 'QQUser', avatar: 'https://x/y.png' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );

            try {
                const { app: a, env } = buildQQApp();
                const r1 = await a.request('/xinyueqq', {
                    method: 'GET',
                    headers: { 'Referer': 'http://localhost:5173/login' }
                }, env);
                const setCookie = r1.headers.get('Set-Cookie') || '';
                const state = decodeURIComponent((setCookie.match(/qq_state=([^;]+)/) || [])[1] || '');
                expect(state).toBeTruthy();

                const res = await a.request(`/xinyueqq/callback?code=zzz&msg=${encodeURIComponent(state)}`, {
                    method: 'GET',
                    headers: { Cookie: `qq_state=${state}; redirect_to=http://localhost:5173/callback` }
                }, env);

                expect(res.status).toBe(302);
                expect(res.headers.get('Location')).toContain('token=');
                const row = sqlite.prepare("SELECT username, avatar FROM users WHERE openid = 'qq:qq_abc'").get() as any;
                expect(row.username).toBe('oldqq');
                expect(row.avatar).toBe('https://x/y.png');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('callback should redirect a new QQ user to the register page', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => new Response(
                JSON.stringify({ openid: 'qq_new', nickname: 'NewQQ', avatar: 'https://x/z.png' }),
                { status: 200, headers: { 'Content-Type': 'application/json' } }
            );

            try {
                const { app: a, env } = buildQQApp();
                const r1 = await a.request('/xinyueqq', {
                    method: 'GET',
                    headers: { 'Referer': 'http://localhost:5173/login' }
                }, env);
                const setCookie = r1.headers.get('Set-Cookie') || '';
                const state = decodeURIComponent((setCookie.match(/qq_state=([^;]+)/) || [])[1] || '');

                const res = await a.request(`/xinyueqq/callback?code=zzz&msg=${encodeURIComponent(state)}`, {
                    method: 'GET',
                    headers: { Cookie: `qq_state=${state}; redirect_to=http://localhost:5173/callback` }
                }, env);

                expect(res.status).toBe(302);
                const location = res.headers.get('Location') || '';
                expect(location).toContain('/register');
                expect(location).toContain('token=');
            } finally {
                global.fetch = originalFetch;
            }
        });

        it('callback should reject an invalid state', async () => {
            const { app: a, env } = buildQQApp();
            const res = await a.request('/xinyueqq/callback?code=zzz&msg=forged', {
                method: 'GET',
                headers: { Cookie: 'qq_state=legit' }
            }, env);
            expect(res.status).toBe(400);
            const data = await res.json() as { error: { message: string } };
            expect(data.error.message).toBe('Invalid state parameter');
        });
    });

    describe('GET /profile - Get user profile', () => {
        it('should return user profile', async () => {
            const res = await app.request('/profile', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_1' }
            }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.id).toBe(1);
            expect(data.username).toBe('user1');
            expect(data.avatar).toBe('avatar1.png');
            expect(data.permission).toBe(false);
        });

        it('should return admin permission for admin user', async () => {
            const res = await app.request('/profile', {
                method: 'GET',
                headers: { 'Authorization': 'Bearer mock_token_2' }
            }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.permission).toBe(true);
        });

        it('should require authentication', async () => {
            const res = await app.request('/profile', { method: 'GET' }, env);
            
            expect(res.status).toBe(403);
        });
    });

    describe('PUT /profile - Update profile', () => {
        it('should update username', async () => {
            const res = await app.request('/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username: 'newname' }),
            }, env);
            
            expect(res.status).toBe(200);
            
            // Verify update
            const dbResult = sqlite.prepare(`SELECT username FROM users WHERE id = 1`).all() as any[];
            expect(dbResult[0]?.username).toBe('newname');
        });

        it('should update avatar', async () => {
            const res = await app.request('/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ avatar: 'https://new-avatar.png' }),
            }, env);
            
            expect(res.status).toBe(200);
            
            const dbResult = sqlite.prepare(`SELECT avatar FROM users WHERE id = 1`).all() as any[];
            expect(dbResult[0]?.avatar).toBe('https://new-avatar.png');
        });

        it('should require authentication', async () => {
            const res = await app.request('/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'test' }),
            }, env);
            
            expect(res.status).toBe(403);
        });

        it('should require at least one field', async () => {
            const res = await app.request('/profile', {
                method: 'PUT',
                headers: {
                    'Authorization': 'Bearer mock_token_1',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({}),
            }, env);
            
            expect(res.status).toBe(400);
        });
    });

    describe('GET /check-username - Username availability', () => {
        it('should return available:false for empty username', async () => {
            const res = await app.request('/check-username?username=', { method: 'GET' }, env);
            expect(res.status).toBe(200);
            const data = await res.json() as { available: boolean };
            expect(data.available).toBe(false);
        });

        it('should return available:true for an unused username', async () => {
            const res = await app.request('/check-username?username=freshname', { method: 'GET' }, env);
            expect(res.status).toBe(200);
            const data = await res.json() as { available: boolean };
            expect(data.available).toBe(true);
        });

        it('should return available:false for a taken username', async () => {
            const res = await app.request('/check-username?username=user1', { method: 'GET' }, env);
            expect(res.status).toBe(200);
            const data = await res.json() as { available: boolean };
            expect(data.available).toBe(false);
        });
    });

    describe('GET /gitee/callback - new user redirect', () => {
        it('should redirect new OAuth user to /register with a token', async () => {
            const originalFetch = global.fetch;
            global.fetch = async () => {
                return new Response(JSON.stringify({
                    id: 999,
                    login: 'brand_new',
                    name: 'Brand New',
                    avatar_url: 'https://gitee.com/new.png'
                }), { status: 200 });
            };

            try {
                const res = await app.request('/gitee/callback?code=valid_code&state=mock_state', {
                    method: 'GET',
                    headers: {
                        'Cookie': 'state=mock_state; redirect_to=http://localhost:5173/callback'
                    }
                }, env);

                expect(res.status).toBe(302);
                const location = res.headers.get('Location') || '';
                expect(location).toContain('/register');
                expect(location).toContain('token=');
            } finally {
                global.fetch = originalFetch;
            }
        });
    });

    describe('POST /register - complete registration', () => {
        function buildAppWithRealJwt() {
            const appReal = new Hono<{ Bindings: Env; Variables: Variables }>();
            appReal.use(createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
                c.set('db', db);
                c.set('cache', new TestCacheImpl());
                c.set('serverConfig', new TestCacheImpl());
                c.set('clientConfig', new TestCacheImpl());
                c.set('jwt', createJWT('test-jwt-secret'));
                c.set('oauth2', undefined);
                c.set('env', env);
                await next();
            }));
            appReal.route('/', UserService());
            appReal.onError((err, c) => {
                const error = err as any;
                if (error.code && error.statusCode) {
                    return c.json({
                        success: false,
                        error: { code: error.code, message: error.message, details: error.details }
                    }, error.statusCode as any);
                }
                return c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message || 'error' } }, 500);
            });
            return appReal;
        }

        function makeRegToken(openid: string, username: string) {
            const jwt = createJWT('test-jwt-secret');
            return jwt.sign({
                type: 'register',
                openid,
                avatar: 'https://example.com/a.png',
                platform: 'github',
                suggestedUsername: username,
                exp: Math.floor(Date.now() / 1000) + 600,
            });
        }

        it('should reject request without token', async () => {
            const appReal = buildAppWithRealJwt();
            const res = await appReal.request('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: 'someone' }),
            }, env);
            expect(res.status).toBe(403);
        });

        it('should create a user with a unique username', async () => {
            const appReal = buildAppWithRealJwt();
            const token = await makeRegToken('gh_brandnew', 'brandnew');
            const res = await appReal.request('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, username: 'brandnew' }),
            }, env);
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.token).toBeTruthy();
            expect(data.user.username).toBe('brandnew');

            const row = sqlite.prepare("SELECT username, openid, permission FROM users WHERE openid = 'gh_brandnew'").get() as any;
            expect(row).toBeDefined();
            expect(row.username).toBe('brandnew');
            expect(row.permission).toBe(0);
        });

        it('should set permission=1 for the first registered user', async () => {
            sqlite.exec('DELETE FROM users');
            const appReal = buildAppWithRealJwt();
            const token = await makeRegToken('gh_first', 'firstuser');
            const res = await appReal.request('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, username: 'firstuser' }),
            }, env);
            expect(res.status).toBe(200);
            const row = sqlite.prepare("SELECT permission FROM users WHERE openid = 'gh_first'").get() as any;
            expect(row.permission).toBe(1);
        });

        it('should return 409 for a taken username', async () => {
            const appReal = buildAppWithRealJwt();
            const token = await makeRegToken('gh_other', 'otheruser');
            const res = await appReal.request('/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, username: 'user1' }),
            }, env);
            expect(res.status).toBe(409);
        });
    });

    describe('POST /logout - Logout', () => {
        it('should clear token cookie', async () => {
            const res = await app.request('/logout', { method: 'POST' }, env);
            
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data).toBeDefined();
        });
    });
});
