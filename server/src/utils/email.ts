/**
 * 邮件发送工具。
 *
 * 优先使用新的 MailPort 发件服务:
 * - `EMAIL_SEND_URLS`:JSON 数组,填写完整的发件接口地址(可多个)
 * - `EMAIL_SEND_KEYS`:对应的 API 密钥,与 URL 按顺序一一匹配
 * 多组地址按顺序轮询,任一成功即返回,全部失败时抛出最后一个错误。
 *
 * 未配置新变量时,回退到旧的 `EMAIL_RESEND_URL` / `EMAIL_RESEND_PASS`(Rin-Email)。
 */

type MailportEndpoint = {
    mode: "mailport";
    url: string;
    key: string;
};

type LegacyEndpoint = {
    mode: "legacy";
    url: string;
    pass: string;
};

type Endpoint = MailportEndpoint | LegacyEndpoint;

function parseStringList(raw: string, name: string): string[] {
    const trimmed = raw.trim();
    let parsed: unknown;
    try {
        parsed = JSON.parse(trimmed);
    } catch {
        // 非法 JSON 时把整个值当作单个条目,方便只配置一个地址/密钥的场景
        return [trimmed];
    }
    if (typeof parsed === "string") return [parsed];
    if (Array.isArray(parsed) && parsed.every((v) => typeof v === "string")) return parsed;
    throw new Error(`${name} must be a string or a JSON array of strings`);
}

/** 解析出可用的发件端点:新的 MailPort 优先,没有则回退到旧的 Rin-Email */
export function resolveEndpoints(env: Env): Endpoint[] {
    const urlsRaw = (env.EMAIL_SEND_URLS ?? "").trim();
    if (urlsRaw) {
        const urls = parseStringList(urlsRaw, "EMAIL_SEND_URLS").filter(Boolean);
        if (urls.length === 0) {
            throw new Error("EMAIL_SEND_URLS is set but contains no URLs");
        }
        const keysRaw = (env.EMAIL_SEND_KEYS ?? "").trim();
        if (!keysRaw) {
            throw new Error("EMAIL_SEND_KEYS is required when EMAIL_SEND_URLS is set");
        }
        const keys = parseStringList(keysRaw, "EMAIL_SEND_KEYS").filter(Boolean);
        if (keys.length === 1 && urls.length > 1) {
            return urls.map((url) => ({ mode: "mailport" as const, url, key: keys[0] }));
        }
        if (keys.length !== urls.length) {
            throw new Error(
                `EMAIL_SEND_URLS has ${urls.length} entries but EMAIL_SEND_KEYS has ${keys.length}; ` +
                    "they must match one-to-one (or provide a single key shared by all URLs)",
            );
        }
        return urls.map((url, i) => ({ mode: "mailport" as const, url, key: keys[i] }));
    }

    const legacyUrl = (env.EMAIL_RESEND_URL ?? "").trim();
    const legacyPass = (env.EMAIL_RESEND_PASS ?? "").trim();
    if (legacyUrl && legacyPass) {
        return [{ mode: "legacy", url: legacyUrl, pass: legacyPass }];
    }
    return [];
}

/** 是否已配置任一发件方式(供接口层做前置校验,不会抛错) */
export function isEmailConfigured(env: Env): boolean {
    if ((env.EMAIL_SEND_URLS ?? "").trim()) return true;
    return !!(env.EMAIL_RESEND_URL ?? "").trim() && !!(env.EMAIL_RESEND_PASS ?? "").trim();
}

async function postToEndpoint(endpoint: Endpoint, to: string, subject: string, text: string): Promise<void> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const body: Record<string, unknown> = { to, subject, text };
    if (endpoint.mode === "mailport") {
        headers["Authorization"] = `Bearer ${endpoint.key}`;
    } else {
        body.pass = endpoint.pass;
    }

    const resp = await fetch(endpoint.url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => "");
        throw new Error(`Email service error ${resp.status}: ${errText}`);
    }
}

export async function sendEmail(env: Env, to: string, subject: string, text: string): Promise<void> {
    const endpoints = resolveEndpoints(env);
    if (endpoints.length === 0) {
        throw new Error(
            "Email service is not configured: set EMAIL_SEND_URLS and EMAIL_SEND_KEYS " +
                "(or the legacy EMAIL_RESEND_URL and EMAIL_RESEND_PASS)",
        );
    }

    let lastError: unknown = null;
    for (const endpoint of endpoints) {
        try {
            await postToEndpoint(endpoint, to, subject, text);
            return;
        } catch (err) {
            lastError = err;
            const message = err instanceof Error ? err.message : String(err);
            console.warn(`[email] send via ${endpoint.url} failed: ${message}; trying next endpoint`);
        }
    }

    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new Error(`All email endpoints failed. Last error: ${message}`);
}
