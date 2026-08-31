import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { setJWTCookie } from "../core/hono-middleware";
import { users } from "../db/schema";
import {
    BadRequestError,
    ConflictError,
    ForbiddenError,
    InternalServerError,
    NotFoundError
} from "../errors";

function generateRandomState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function UserService(): Hono {
    const app = new Hono();

    // GET /user/github - Redirect to GitHub OAuth
    app.get("/github", async (c: AppContext) => {
        const oauth2 = c.get('oauth2');

        if (!oauth2) {
            throw new BadRequestError('GitHub OAuth is not configured');
        }

        const referer = c.req.header('referer');

        if (!referer) {
            throw new BadRequestError('Referer header is required');
        }

        // Build callback URL from referer
        const refererUrl = new URL(referer);
        const callbackUrl = new URL('/callback', refererUrl.origin);

        setCookie(c, 'redirect_to', callbackUrl.toString(), {
            path: '/',
        });

        const genState = await profileAsync(c, 'user_oauth_state', () => Promise.resolve(oauth2.generateState()));
        setCookie(c, 'state', genState, {
            path: '/',
        });

        const redirectUri = new URL('/api/user/github/callback', refererUrl.origin).toString();
        return c.redirect(oauth2.createRedirectUrl(genState, "GitHub", redirectUri), 302);
    });

    // GET /user/github/callback - GitHub OAuth callback
    app.get("/github/callback", async (c: AppContext) => {
        const oauth2 = c.get('oauth2');
        const jwt = c.get('jwt');
        const db = c.get('db');

        if (!oauth2) {
            throw new BadRequestError('GitHub OAuth is not configured');
        }

        const query = c.req.query();
        const stateCookie = getCookie(c, 'state');

        console.log('param_state', query.state);
        console.log('cookie_state', stateCookie);

        // Verify state to prevent CSRF attacks
        if (query.state !== stateCookie) {
            throw new BadRequestError('Invalid state parameter');
        }

        // Clear state cookie
        deleteCookie(c, 'state');

        // Exchange code for access token
        const gh_token = await profileAsync(c, 'user_oauth_authorize', () => oauth2.authorize("GitHub", query.code, new URL('/api/user/github/callback', new URL(c.req.url).origin).toString()));
        if (!gh_token) {
            throw new BadRequestError('Failed to authorize with GitHub');
        }

        // Request https://api.github.com/user for user info
        const response = await profileAsync(c, 'user_github_fetch', () => fetch("https://api.github.com/user", {
            headers: {
                Authorization: `Bearer ${gh_token.accessToken}`,
                Accept: "application/json",
                "User-Agent": "rin"
            },
        }));

        const user: any = await profileAsync(c, 'user_github_parse', () => response.json());
        const profile: {
            openid: string;
            username: string;
            avatar: string;
            permission: number | null;
        } = {
            openid: user.id,
            username: user.name || user.login,
            avatar: user.avatar_url,
            permission: 0
        };

        let authToken: string | undefined;

        // Check if user exists
        const existingUser = await profileAsync(c, 'user_existing_lookup', () => db.query.users.findFirst({
            where: eq(users.openid, profile.openid)
        }));

        if (existingUser) {
            profile.permission = existingUser.permission;
            // Only refresh the avatar. Never overwrite the user-chosen username.
            await profileAsync(c, 'user_existing_update', () => db.update(users).set({ avatar: profile.avatar }).where(eq(users.id, existingUser.id)));
            authToken = await profileAsync(c, 'user_existing_token', () => jwt.sign({ id: existingUser.id }));
            setJWTCookie(c, authToken);
            // Store token in cookie for frontend to read (not HttpOnly)
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });
        } else {
            const regToken = await profileAsync(c, 'user_github_reg_token', () => jwt.sign({
                type: 'register',
                openid: profile.openid,
                avatar: profile.avatar,
                platform: 'github',
                suggestedUsername: profile.username,
                exp: Math.floor(Date.now() / 1000) + 600,
            }));
            const redirectTo = getCookie(c, 'redirect_to');
            const regUrl = new URL(redirectTo || '/');
            regUrl.pathname = '/register';
            regUrl.searchParams.set('token', regToken);
            return c.redirect(regUrl.toString(), 302);
        }

        const redirectTo = getCookie(c, 'redirect_to');
        const redirect_url = new URL(redirectTo || '/');
        // Add token to URL for frontend to store (for cross-domain auth)
        if (authToken) {
            redirect_url.searchParams.set('token', authToken);
        }
        return c.redirect(redirect_url.toString(), 302);
    });

    // GET /user/gitee - Redirect to Gitee OAuth
    app.get("/gitee", async (c: AppContext) => {
        const oauth2 = c.get('oauth2');

        if (!oauth2) {
            throw new BadRequestError('Gitee OAuth is not configured');
        }

        const referer = c.req.header('referer');

        if (!referer) {
            throw new BadRequestError('Referer header is required');
        }

        // Build callback URL from referer
        const refererUrl = new URL(referer);
        const callbackUrl = new URL('/callback', refererUrl.origin);

        setCookie(c, 'redirect_to', callbackUrl.toString(), {
            path: '/',
        });

        const genState = await profileAsync(c, 'user_oauth_state_gitee', () => Promise.resolve(oauth2.generateState()));
        setCookie(c, 'state', genState, {
            path: '/',
        });

        const redirectUri = new URL('/api/user/gitee/callback', refererUrl.origin).toString();
        return c.redirect(oauth2.createRedirectUrl(genState, "Gitee", redirectUri), 302);
    });

    // GET /user/gitee/callback - Gitee OAuth callback
    app.get("/gitee/callback", async (c: AppContext) => {
        const oauth2 = c.get('oauth2');
        const jwt = c.get('jwt');
        const db = c.get('db');

        if (!oauth2) {
            throw new BadRequestError('Gitee OAuth is not configured');
        }

        const query = c.req.query();
        const stateCookie = getCookie(c, 'state');

        console.log('gitee param_state', query.state);
        console.log('gitee cookie_state', stateCookie);

        // Verify state to prevent CSRF attacks
        if (query.state !== stateCookie) {
            throw new BadRequestError('Invalid state parameter');
        }

        // Clear state cookie
        deleteCookie(c, 'state');

        // Exchange code for access token
        const gitee_token = await profileAsync(c, 'user_gitee_authorize', () => oauth2.authorize("Gitee", query.code, new URL('/api/user/gitee/callback', new URL(c.req.url).origin).toString()));
        if (!gitee_token) {
            throw new BadRequestError('Failed to authorize with Gitee');
        }

        // Request https://gitee.com/api/v5/user for user info
        const response = await profileAsync(c, 'user_gitee_fetch', () => fetch("https://gitee.com/api/v5/user", {
            headers: {
                Authorization: `Bearer ${gitee_token.accessToken}`,
                Accept: "application/json",
            },
        }));

        const user: any = await profileAsync(c, 'user_gitee_parse', () => response.json());
        const profile: {
            openid: string;
            username: string;
            avatar: string;
            permission: number | null;
        } = {
            openid: String(user.id),
            username: user.name || user.login,
            avatar: user.avatar_url,
            permission: 0
        };

        let authToken: string | undefined;

        // Check if user exists
        const existingUser = await profileAsync(c, 'user_gitee_existing_lookup', () => db.query.users.findFirst({
            where: eq(users.openid, profile.openid)
        }));

        if (existingUser) {
            profile.permission = existingUser.permission;
            // Only refresh the avatar. Never overwrite the user-chosen username.
            await profileAsync(c, 'user_gitee_existing_update', () => db.update(users).set({ avatar: profile.avatar }).where(eq(users.id, existingUser.id)));
            authToken = await profileAsync(c, 'user_gitee_existing_token', () => jwt.sign({ id: existingUser.id }));
            setJWTCookie(c, authToken);
            // Store token in cookie for frontend to read (not HttpOnly)
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });
        } else {
            const regToken = await profileAsync(c, 'user_gitee_reg_token', () => jwt.sign({
                type: 'register',
                openid: profile.openid,
                avatar: profile.avatar,
                platform: 'gitee',
                suggestedUsername: profile.username,
                exp: Math.floor(Date.now() / 1000) + 600,
            }));
            const redirectTo = getCookie(c, 'redirect_to');
            const regUrl = new URL(redirectTo || '/');
            regUrl.pathname = '/register';
            regUrl.searchParams.set('token', regToken);
            return c.redirect(regUrl.toString(), 302);
        }

        const redirectTo = getCookie(c, 'redirect_to');
        const redirect_url = new URL(redirectTo || '/');
        // Add token to URL for frontend to store (for cross-domain auth)
        if (authToken) {
            redirect_url.searchParams.set('token', authToken);
        }
        return c.redirect(redirect_url.toString(), 302);
    });

    // GET /user/xinyueqq - Redirect to 心月互联 (Xinyue) QQ OAuth
    // 心月互联 proxies QQ login: we redirect to its gateway with our token, and it
    // redirects back to RIN_QQ_CALLBACK_URL (configured per-token in 心月互联) carrying ?code=&msg=.
    app.get("/xinyueqq", async (c: AppContext) => {
        const token = c.env.RIN_QQ_TOKEN;
        const callbackUrl = c.env.RIN_QQ_CALLBACK_URL;
        if (!token || !callbackUrl) {
            throw new BadRequestError('QQ login is not configured');
        }

        const referer = c.req.header('referer');
        if (!referer) {
            throw new BadRequestError('Referer header is required');
        }

        const ua = c.req.header('user-agent') || '';
        const display = /Mobile|Android|iPhone|iPad|iPod/i.test(ua) ? 'mobile' : 'pc';

        // CSRF protection: carry a one-time state in msg (心月互联 echoes it back).
        const state = generateRandomState();
        setCookie(c, 'qq_state', state, { path: '/' });

        const refererUrl = new URL(referer);
        setCookie(c, 'redirect_to', new URL('/callback', refererUrl.origin).toString(), { path: '/' });

        const qqUrl = new URL('https://qq.wch666.com/api/qq.php');
        qqUrl.searchParams.set('token', token);
        qqUrl.searchParams.set('msg', state);
        qqUrl.searchParams.set('display', display);

        return c.redirect(qqUrl.toString(), 302);
    });

    // GET /user/xinyueqq/callback - 心月互联 QQ OAuth callback
    app.get("/xinyueqq/callback", async (c: AppContext) => {
        const jwt = c.get('jwt');
        const db = c.get('db');

        const query = c.req.query();
        const stateCookie = getCookie(c, 'qq_state');

        if (!query.msg || query.msg !== stateCookie) {
            throw new BadRequestError('Invalid state parameter');
        }
        deleteCookie(c, 'qq_state');

        const code = query.code;
        if (!code) {
            throw new BadRequestError('Missing code parameter');
        }

        const infoResp = await profileAsync(c, 'user_qq_fetch', () => fetch(`https://qq.wch666.com/api/get_user_info.php?code=${encodeURIComponent(code)}`));
        const infoText = await profileAsync(c, 'user_qq_parse', () => infoResp.text());
        let info: any;
        try {
            info = JSON.parse(infoText);
        } catch {
            throw new BadRequestError('Failed to parse QQ user info');
        }
        if (!info) {
            throw new BadRequestError('Failed to get QQ user info');
        }
        // 心月互联 returns { ret: 0, msg: '', open_id: '...' } on success.
        if (typeof info.ret !== 'undefined' && Number(info.ret) !== 0) {
            throw new BadRequestError(info.msg || 'Failed to get QQ user info');
        }
        if (!info.open_id) {
            throw new BadRequestError('Failed to get QQ user info');
        }

        const profile: {
            openid: string;
            username: string;
            avatar: string;
            permission: number | null;
        } = {
            // Namespace to avoid colliding with GitHub/Gitee openids.
            openid: `qq:${String(info.open_id)}`,
            username: info.nickname || `qq_${String(info.open_id)}`,
            avatar: info.figureurl_qq || info.figureurl_1 || info.figureurl_2 || info.figureurl || '',
            permission: 0,
        };

        let authToken: string | undefined;

        const existingUser = await profileAsync(c, 'user_qq_existing_lookup', () => db.query.users.findFirst({
            where: eq(users.openid, profile.openid),
        }));

        if (existingUser) {
            profile.permission = existingUser.permission;
            // Only refresh the avatar. Never overwrite the user-chosen username.
            await profileAsync(c, 'user_qq_existing_update', () => db.update(users).set({ avatar: profile.avatar }).where(eq(users.id, existingUser.id)));
            authToken = await profileAsync(c, 'user_qq_existing_token', () => jwt.sign({ id: existingUser.id }));
            setJWTCookie(c, authToken);
            setCookie(c, 'auth_token', authToken, {
                expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
                path: '/',
                sameSite: 'Lax',
            });
        } else {
            const regToken = await profileAsync(c, 'user_qq_reg_token', () => jwt.sign({
                type: 'register',
                openid: profile.openid,
                avatar: profile.avatar,
                platform: 'xinyueqq',
                suggestedUsername: profile.username,
                exp: Math.floor(Date.now() / 1000) + 600,
            }));
            const redirectTo = getCookie(c, 'redirect_to');
            const regUrl = new URL(redirectTo || '/');
            regUrl.pathname = '/register';
            regUrl.searchParams.set('token', regToken);
            return c.redirect(regUrl.toString(), 302);
        }

        const redirectTo = getCookie(c, 'redirect_to');
        const redirect_url = new URL(redirectTo || '/');
        if (authToken) {
            redirect_url.searchParams.set('token', authToken);
        }
        return c.redirect(redirect_url.toString(), 302);
    });

    // GET /user/profile - Get user profile
    app.get('/profile', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const user = await profileAsync(c, 'user_profile_lookup', () => db.query.users.findFirst({ where: eq(users.id, uid) }));
        if (!user) {
            throw new NotFoundError('User');
        }

        return c.json({
            id: user.id,
            username: user.username,
            avatar: user.avatar,
            permission: user.permission === 1,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        });
    });

    // GET /user/check-username - Check username availability
    app.get('/check-username', async (c: AppContext) => {
        const db = c.get('db');
        const username = (c.req.query('username') || '').trim();
        if (!username) {
            return c.json({ available: false });
        }
        const existing = await profileAsync(c, 'user_check_username', () => db.query.users.findFirst({
            where: eq(users.username, username),
        }));
        return c.json({ available: !existing });
    });

    // POST /user/register - Complete OAuth registration with a unique username
    app.post('/register', async (c: AppContext) => {
        const db = c.get('db');
        const jwt = c.get('jwt');
        const body = await c.req.json().catch(() => ({})) as { token?: string; username?: string };

        const payload = await jwt.verify(body.token ?? "");
        if (!payload || payload.type !== 'register') {
            throw new ForbiddenError('Invalid or expired registration token');
        }

        const cleanName = (body.username || '').trim();
        if (!cleanName) {
            throw new BadRequestError('Username is required');
        }

        const existing = await profileAsync(c, 'user_register_lookup', () => db.query.users.findFirst({
            where: eq(users.username, cleanName),
        }));
        if (existing) {
            throw new ConflictError('Username already taken');
        }

        const anyUserCheck = await profileAsync(c, 'user_register_first_lookup', () => db.query.users.findMany({ limit: 1 }));
        const permission = anyUserCheck.length === 0 ? 1 : 0;

        let result: { insertedId: number }[];
        try {
            result = await profileAsync(c, 'user_register_insert', () => db.insert(users).values({
                openid: payload.openid,
                username: cleanName,
                avatar: payload.avatar,
                permission,
            }).returning({ insertedId: users.id }));
        } catch (e: any) {
            if (String(e?.message ?? '').includes('UNIQUE constraint failed')) {
                throw new ConflictError('Username already taken');
            }
            throw e;
        }

        if (!result || result.length === 0) {
            throw new InternalServerError('Failed to register user');
        }

        const authToken = await profileAsync(c, 'user_register_token', () => jwt.sign({ id: result[0].insertedId }));
        setJWTCookie(c, authToken);
        setCookie(c, 'auth_token', authToken, {
            expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
            path: '/',
            sameSite: 'Lax',
        });

        return c.json({
            token: authToken,
            user: {
                id: result[0].insertedId,
                username: cleanName,
                avatar: payload.avatar,
                permission: permission === 1,
            },
        });
    });

    // POST /user/logout - Logout user
    app.post('/logout', async (c: AppContext) => {
        deleteCookie(c, 'token', {
            path: '/',
            httpOnly: true,
            secure: true,
            sameSite: 'Lax',
        });
        deleteCookie(c, 'auth_token', {
            path: '/',
            sameSite: 'Lax',
        });
        return c.json({ success: true });
    });

    // PUT /user/profile - Update user profile
    app.put('/profile', async (c: AppContext) => {
        const uid = c.get('uid');
        const db = c.get('db');
        const body = await profileAsync(c, 'user_profile_parse', () => c.req.json());

        if (!uid) {
            throw new ForbiddenError('Authentication required');
        }

        const { username, avatar } = body as { username?: string; avatar?: string };

        if (!username && !avatar) {
            throw new BadRequestError('At least one field (username or avatar) is required');
        }

        const updateData: { username?: string; avatar?: string } = {};
        if (username) updateData.username = username;
        if (avatar) updateData.avatar = avatar;

        await profileAsync(c, 'user_profile_update', () => db.update(users).set(updateData).where(eq(users.id, uid)));

        return c.json({ success: true });
    });

    return app;
}
