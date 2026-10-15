import PostalMimeModule from "postal-mime";
import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";
import { sendEmail } from "../utils/email";
import { generateCaptchaImage, pngToBase64 } from "../utils/captcha";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "../services/config-helpers";
import { processFriendEmail } from "../services/friend-email";

// postal-mime's UMD factory returns { default: PostalMime }, and bundlers wrap
// that again, so the class can sit at `.default` or `.default.default` depending
// on the runtime's CJS/ESM interop. Resolve it defensively so it works both in
// bun (tests) and in the esbuild-bundled Worker.
const PostalMime = (PostalMimeModule as any)?.default?.default
    ?? (PostalMimeModule as any)?.default
    ?? PostalMimeModule;

const PROBE_TIMEOUT_MS = 8 * 1000;

interface ProbeResult {
    status: number;
    body: string;
}

async function probeUrl(url: string): Promise<ProbeResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const resp = await fetch(url, {
            method: "GET",
            // 伪装成真实浏览器 UA,避免被 WAF / 云盾 / 宝塔防火墙拦截（如 403）。
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            },
            signal: controller.signal,
            redirect: "manual",
        });
        // 3xx is not a plain 200 response; do not follow it.
        if (resp.status >= 300 && resp.status < 400) {
            return { status: resp.status, body: "" };
        }
        const body = await resp.text();
        return { status: resp.status, body };
    } catch {
        return { status: 0, body: "" };
    } finally {
        clearTimeout(timer);
    }
}

// Read the raw MIME stream exactly once and parse it.
export async function parseIncoming(message: ForwardableEmailMessage): Promise<{
    from: string;
    to: string;
    text: string;
    subject: string;
    headers: Record<string, string>;
}> {
    console.log("[friend-email] parseIncoming: reading raw stream");
    let buffer: ArrayBuffer;
    try {
        buffer = await new Response(message.raw).arrayBuffer();
    } catch (err: any) {
        console.error("[friend-email] failed to read raw stream:", err?.name, err?.message);
        throw err;
    }
    console.log(`[friend-email] parseIncoming: read ${buffer.byteLength} bytes`);

    let parsed: { text?: string; html?: string; subject?: string; headers?: Array<{ key?: string; name?: string; value?: unknown }> };
    try {
        const parser = new PostalMime();
        parsed = await parser.parse(buffer);
    } catch (err: any) {
        console.error("[friend-email] postal-mime parse failed:", err?.name, err?.message);
        const snippet = new TextDecoder("utf-8", { fatal: false }).decode(buffer).slice(0, 600);
        console.log("[friend-email] raw snippet:", JSON.stringify(snippet));
        // Fallback: naive extraction so the flow can still proceed.
        const fallback = fallbackExtractText(buffer);
        console.log("[friend-email] using fallback extraction, length=", fallback.length);
        return { from: message.from, to: message.to, text: fallback, subject: "", headers: {} };
    }

    let text = parsed.text || parsed.html || "";
    // HTML-only email: strip tags so keyword matching still works.
    if (/<[a-z][\s\S]*>/i.test(text)) {
        text = stripHtml(text);
    }
    // Extract subject + headers from the raw MIME for reply detection.
    // postal-mime's header parsing is inconsistent, so we parse headers directly.
    const { subject, headers } = parseHeaders(buffer);
    return { from: message.from, to: message.to, text, subject, headers };
}

// Detect whether the inbound email is a reply or forward by subject prefix
// (Re/答复/回复/转发/Fwd/Fw) or by In-Reply-To / References headers. Such
// messages land in the outbound mailbox (e.g. personal QQ mail) and are
// auto-forwarded here, so they can never reach the worker's receiving
// address. Reply with a reminder and skip the state machine entirely.
export function detectReplyOrForward(
    subject: string,
    headers: Record<string, string>,
): boolean {
    if (/^(re|答复|回复|转发|fwd|fw)\s*[:：]/i.test(subject.trim())) return true;
    for (const key of ["In-Reply-To", "References"]) {
        if (headers[key]) return true;
    }
    return false;
}

function stripHtml(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|tr|li|h[1-6]|table)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&lt;/gi, "<")
        .replace(/&gt;/gi, ">")
        .replace(/&amp;/gi, "&")
        .replace(/&quot;/gi, '"')
        .replace(/&#39;/gi, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

// Parse subject and headers from raw MIME buffer for reply detection.
function parseHeaders(buffer: ArrayBuffer): { subject: string; headers: Record<string, string> } {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const headerEnd = raw.search(/\r?\n\r?\n/);
    const headerBlock = headerEnd === -1 ? raw : raw.slice(0, headerEnd);
    const headers: Record<string, string> = {};
    let subject = "";
    for (const line of headerBlock.split(/\r?\n/)) {
        const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
        if (match) {
            const key = match[1];
            const value = match[2].trim();
            headers[key] = value;
            if (key.toLowerCase() === "subject") subject = value;
        }
    }
    return { subject, headers };
}

// Naive MIME text extraction used only when postal-mime throws.
function fallbackExtractText(buffer: ArrayBuffer): string {
    const raw = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
    const headerEnd = raw.search(/\r?\n\r?\n/);
    const headers = headerEnd === -1 ? "" : raw.slice(0, headerEnd);
    let body = headerEnd === -1 ? raw : raw.slice(headerEnd + 2);

    // If multipart, prefer the text/plain part.
    const boundaryMatch = headers.match(/boundary="?([^"\s;]+)"?/i);
    if (boundaryMatch) {
        const boundary = boundaryMatch[1];
        const parts = raw.split(`--${boundary}`);
        for (const part of parts) {
            if (/content-type:\s*text\/plain/i.test(part)) {
                const idx = part.search(/\r?\n\r?\n/);
                if (idx !== -1) {
                    body = part.slice(idx + 2);
                    break;
                }
            }
        }
    }

    const isBase64 = /content-transfer-encoding:\s*base64/i.test(headers);
    const isQp = /content-transfer-encoding:\s*quoted-printable/i.test(headers);
    if (isBase64) {
        try {
            const decoded = atob(body.replace(/\s/g, ""));
            body = new TextDecoder("utf-8", { fatal: false }).decode(
                Uint8Array.from(decoded, (c) => c.charCodeAt(0)),
            );
        } catch {
            // keep raw
        }
    } else if (isQp) {
        body = body
            .replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16)))
            .replace(/=\r?\n/g, "");
    }

    return body.trim();
}

export async function handleEmail(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
): Promise<void> {
    console.log(`[friend-email] email handler invoked from=${message.from} to=${message.to} rawSize=${message.rawSize}`);
    let mail: { from: string; to: string; text: string; subject: string; headers: Record<string, string> };
    try {
        mail = await parseIncoming(message);
    } catch (err: any) {
        console.error("[friend-email] failed to parse incoming email", err);
        return;
    }

    if (!mail.from) {
        console.log("[friend-email] no sender address, ignoring");
        return;
    }

    // Reply / forward detection happens before any state-machine work: a user
    // who hits "Reply" in their mail client sends to the outbound address
    // (e.g. personal QQ mail), not the worker's receiving address. We detect
    // it here and fire a single reminder, leaving any in-flight state untouched.
    if (detectReplyOrForward(mail.subject, mail.headers)) {
        console.log(`[friend-email] reply/forward detected from=${mail.from} subject=${JSON.stringify(mail.subject)}`);
        try {
            await sendEmail(
                env,
                mail.from,
                "⚠️ 系统提醒：请勿直接回复或转发",
                `您好，系统检测到您使用了「回复」或「转发」功能。\n\n` +
                    `由于邮件网关限制，这种方式会导致申请中途受阻。\n\n` +
                    `请务必：\n` +
                    `1. 点击「新建邮件」或「写邮件」。\n` +
                    `2. 收件人填写：${message.to}\n` +
                    `3. 正文填写：${"请你进行下一步验证"}\n\n` +
                    `您的申请状态目前仍在倒计时中，请尽快新建邮件发送。`,
            );
        } catch (err: any) {
            console.error("[friend-email] failed to send reply-reminder", err);
        }
        return;
    }

    const preview = (mail.text || "").replace(/\s+/g, " ").slice(0, 120);
    console.log(`[friend-email] parsed textLen=${mail.text.length} preview=${JSON.stringify(preview)}`);

    try {
        const schema = await import("../db/schema");
        const db = drizzle(env.DB, { schema });
        const clientConfig = new CacheImpl(db, env, "client.config", "database");
        const serverConfig = new CacheImpl(db, env, "server.config", "database");

        await processFriendEmail(
            {
                db,
                configGet: (key, defaultValue) => serverConfig.getOrDefault(key, defaultValue),
                send: (to, subject, text, inlineImage) => sendEmail(env, to, subject, text, inlineImage),
                httpGet: probeUrl,
                generateCaptcha: async () => {
                    const image = await generateCaptchaImage(4);
                    return { imageBase64: pngToBase64(image.png), text: image.text, cid: image.cid };
                },
                notifyOwner: async (op, payload, sender) => {
                    const {
                        webhookUrl,
                        webhookMethod,
                        webhookContentType,
                        webhookHeaders,
                        webhookBodyTemplate,
                    } = await resolveWebhookConfig(serverConfig, env);
                    if (!webhookUrl) return;
                    const event =
                        op === "apply" ? "friend.email.created"
                        : op === "modify" ? "friend.email.updated"
                        : "friend.email.deleted";
                    const label = op === "apply" ? "申请友链" : op === "modify" ? "修改友链" : "删除友链";
                    await notify(
                        webhookUrl,
                        {
                            event,
                            message: `邮件${label}: ${payload.name || payload.url}`,
                            title: String(payload.name || payload.url || ""),
                            url: String(payload.url || payload.newUrl || ""),
                            username: sender,
                            content: JSON.stringify(payload),
                            description: String(payload.desc || ""),
                        },
                        {
                            method: webhookMethod,
                            contentType: webhookContentType,
                            headers: webhookHeaders,
                            bodyTemplate: webhookBodyTemplate,
                        },
                    );
                },
            },
            mail,
        );
    } catch (err: any) {
        console.error("[friend-email] handler failed", err);
        // Best effort: inform the applicant something went wrong.
        try {
            await sendEmail(
                env,
                mail.from,
                "友链申请处理出错",
                `系统处理您的申请时出错：${err.message}`,
            );
        } catch {
            // ignore
        }
    }
}