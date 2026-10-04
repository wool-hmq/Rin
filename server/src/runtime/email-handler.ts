import PostalMime from "postal-mime";
import { drizzle } from "drizzle-orm/d1";
import { CacheImpl } from "../utils/cache";
import { sendEmail } from "../utils/email";
import { notify } from "../utils/webhook";
import { resolveWebhookConfig } from "../services/config-helpers";
import { processFriendEmail } from "../services/friend-email";

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
async function parseIncoming(message: ForwardableEmailMessage): Promise<{
    from: string;
    to: string;
    text: string;
}> {
    const buffer = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(buffer);
    return {
        from: message.from,
        to: message.to,
        text: parsed.text || parsed.html || "",
    };
}

export async function handleEmail(
    message: ForwardableEmailMessage,
    env: Env,
    ctx: ExecutionContext,
): Promise<void> {
    let mail: { from: string; to: string; text: string };
    try {
        mail = await parseIncoming(message);
    } catch (err: any) {
        console.error("[friend-email] failed to parse incoming email", err);
        return;
    }

    if (!mail.from) {
        return;
    }

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