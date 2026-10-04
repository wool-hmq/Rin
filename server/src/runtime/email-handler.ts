import PostalMimeModule from "postal-mime";
import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";
import { sendEmail } from "../utils/email";
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

async function probeUrl(url: string): Promise<number> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
    try {
        const resp = await fetch(url, {
            method: "GET",
            headers: { "User-Agent": "Rin-Friend-Verify/1.0" },
            signal: controller.signal,
            redirect: "follow",
        });
        return resp.status;
    } catch {
        return 0;
    } finally {
        clearTimeout(timer);
    }
}

// Read the raw MIME stream exactly once and parse it.
export async function parseIncoming(message: ForwardableEmailMessage): Promise<{
    from: string;
    to: string;
    text: string;
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

    let parsed: { text?: string; html?: string; attachments?: unknown[] };
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
        return { from: message.from, to: message.to, text: fallback };
    }

    let text = parsed.text || parsed.html || "";
    // HTML-only email: strip tags so keyword matching still works.
    if (/<[a-z][\s\S]*>/i.test(text)) {
        text = stripHtml(text);
    }
    return { from: message.from, to: message.to, text };
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
    let mail: { from: string; to: string; text: string };
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
                send: (to, subject, text) => sendEmail(env, to, subject, text),
                httpGet: probeUrl,
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