import { and, eq } from "drizzle-orm";
import { cache, friends, users } from "../db/schema";
import type { DB } from "../core/hono-types";
import { extractTargetUrl } from "../utils/url";

// ---- Supported operations (exact body) ----
export const EMAIL_OP_APPLY = "友链申请";
export const EMAIL_OP_MODIFY = "友链修改";
export const EMAIL_OP_DELETE = "友链删除";
export const EMAIL_OP_CANCEL = "结束本次友链申请";
export const EMAIL_CONFIRM_TRIGGER = "请你进行下一步验证";

// Default owner UID for self-service friend links when the applicant's email
// is not bound to any account. Override via the `friend_email_owner_uid`
// server config key, or change this constant.
const DEFAULT_EMAIL_OWNER_UID = 7;

// ---- Storage types in `cache` table ----
const STATE_TYPE = "friend.email";
const LOCK_TYPE = "friend.email.lock";
const LOCK_KEY = "global";
// 人机验证码答案单独存放,与申请状态分开管理
const CAPTCHA_TYPE = "friend.email.captcha";

// Domain verification must finish within 10 minutes of the last instruction.
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;
// DNS TXT record name used by the DNS verification method.
const DNS_RECORD_NAME = "_jiaofriend";

type VerifyMethod = "dns" | "file";
// An application must finish within 30 minutes overall.
const APPLICATION_TIMEOUT_MS = 30 * 60 * 1000;
// Outbound fetch timeout for the verification probe.
const PROBE_TIMEOUT_MS = 8 * 1000;
// Captcha must be solved within 10 minutes.
const CAPTCHA_TIMEOUT_MS = 10 * 60 * 1000;
// Allow the applicant a few mistypes before the captcha resets.
const CAPTCHA_MAX_ATTEMPTS = 5;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";

interface FriendEmailState {
    stage: "awaiting_captcha" | "awaiting_json" | "awaiting_method_choice" | "awaiting_verification" | "verifying";
    op: "apply" | "modify" | "delete";
    payload: Record<string, unknown>;
    // Remaining URLs to verify. Each entry carries its own 8-char code.
    verifyTargets: Array<{ url: string; code: string }>;
    // Verification method chosen by the applicant for the current target.
    verifyMethod?: VerifyMethod;
    expiresAt: number;
    deadline: number;
    sender: string;
}

interface CaptchaRecord {
    /** 用户应输入的答案(大写) */
    answer: string;
    /** 已尝试次数 */
    attempts: number;
    /** 过期时间戳 */
    expiresAt: number;
}

interface FriendEmailDeps {
    db: DB;
    configGet: <T>(key: string, defaultValue: T) => Promise<T>;
    send: (to: string, subject: string, text: string, inlineImage?: { imageBase64: string; cid: string }) => Promise<void>;
    httpGet: (url: string) => Promise<ProbeResult>;
    /** 查询 TXT 记录,返回记录值列表(DNS 验证方式使用) */
    resolveTxt?: (name: string) => Promise<string[]>;
    /** 生成验证码图片;返回 PNG 的 base64、正确答案与内嵌 cid */
    generateCaptcha?: () => Promise<{ imageBase64: string; text: string; cid: string }>;
    notifyOwner?: (op: "apply" | "modify" | "delete", payload: Record<string, unknown>, sender: string) => Promise<void>;
    now?: () => number;
}

function generateCode(length = 8): string {
    let code = "";
    const random = crypto.getRandomValues(new Uint8Array(length));
    for (let i = 0; i < length; i++) {
        code += CODE_CHARS[random[i] % CODE_CHARS.length];
    }
    return code;
}

// Result of a domain-ownership probe: HTTP status plus the response body.
// The probe now reads the body so the verifier can require an exact content
// match (guarding against SPA fallbacks and custom 404 pages that return 200).
interface ProbeResult {
    status: number;
    body: string;
}

// Extract the visible text inside <body>, stripping tags/scripts/styles and
// collapsing all whitespace. Used to search for the verification code so a SPA
// or custom 404 page (which returns 200 + arbitrary HTML) fails, while tolerant
// of analytics/Live2D/CDN code that frameworks inject into the page.
function extractBodyText(html: string): string {
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    const content = bodyMatch ? bodyMatch[1] : html;
    return content
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, "");
}

// The minimal HTML snippet the applicant must save verbatim as `<code>.html`.
// Its <body> contains the verification code so the probe finds it when the
// applicant truly placed the file (not a SPA fallback).
function verifyHtmlSource(code: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
</head>
<body>
${code}
</body>
</html>`;
}

// Verification instruction email body: ask the applicant to place the exact
// HTML source into `<code>.html` so the served <body> matches the code.
function verifyInstruction(target: { url: string; code: string }): string {
    return (
        `请在站点 ${target.url} 的根目录创建文件 ${target.code}.html，并将下面的源码原样复制到该文件（不要增改任何内容）：\n\n` +
        `————————————————————————\n` +
        verifyHtmlSource(target.code) +
        `\n————————————————————————\n\n` +
        `创建完成后，请确保 ${target.url}/${target.code}.html 通过 GET 请求返回 200，且页面 <body> 中包含验证码 ${target.code}。\n\n` +
        `随后回复本邮件，正文必须为：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
        `验证码 ${target.code} 将在 10 分钟内有效。`
    );
}

const CANCEL_HINT = `如需结束本次申请，请新建一封邮件，并将正文设为：${EMAIL_OP_CANCEL}`;

// Hostname of the site being verified (TXT records are attached to a domain,
// not to a full URL).
function targetDomain(url: string): string {
    try {
        return new URL(url).hostname.toLowerCase();
    } catch {
        return "";
    }
}

// Ask the applicant to pick a verification method for the current target.
function methodChoiceInstruction(target: { url: string; code: string }): string {
    const domain = targetDomain(target.url) || target.url;
    return (
        `您的友链申请信息已收到！为了验证您对站点 ${domain} 的所有权，请选择一种验证方式：\n\n` +
        `1. 方案一：DNS TXT 记录验证（强烈推荐，无需改动网站文件）\n` +
        `2. 方案二：上传 HTML 文件验证（适合熟悉服务器部署的站长）\n\n` +
        `请直接回复数字 1 或 2。`
    );
}

// Tutorial for the DNS TXT method: tell the applicant the exact record to add.
function dnsVerifyInstruction(target: { url: string; code: string }): string {
    const domain = targetDomain(target.url) || target.url;
    return (
        `您已选择【方案一：DNS TXT 记录验证】。\n\n` +
        `请前往您的域名解析后台（如阿里云、腾讯云、Cloudflare），为域名 ${domain} 添加以下记录：\n\n` +
        `· 主机记录：${DNS_RECORD_NAME}\n` +
        `· 记录类型：TXT\n` +
        `· 记录值：${target.code}\n\n` +
        `如果解析后台要求填写完整域名，主机记录请填写：${DNS_RECORD_NAME}.${domain}\n\n` +
        `保存后请等待解析生效（通常几分钟内），然后新建邮件并回复正文：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
        `验证码 ${target.code} 将在 10 分钟内有效。`
    );
}

function methodInstruction(method: VerifyMethod, target: { url: string; code: string }): string {
    return method === "dns" ? dnsVerifyInstruction(target) : verifyInstruction(target);
}

function methodLabel(method: VerifyMethod): string {
    return method === "dns" ? "DNS TXT 记录验证" : "上传 HTML 文件验证";
}

// Parse the reply to the method-choice mail. Tolerates the common variants:
// 1 / 一 / 方案一 / 方案1 / 方法一, and 2 / 二 / 方案二 / 方案2 / 方法二.
function parseMethodChoice(raw: string): VerifyMethod | null {
    const first = firstLine(cleanBody(raw));
    const cleaned = first.replace(/[\s\r\n\t，。！!.,:：、]/g, "");
    if (!cleaned) return null;
    if (/^(1|一|方案1|方案一|方法1|方法一)$/.test(cleaned)) return "dns";
    if (/^(2|二|方案2|方案二|方法2|方法二)$/.test(cleaned)) return "file";
    return null;
}

// Applicants tend to hit "Reply" in their mail client, which sends to the
// outbound address instead of the worker's receiving address. Remind them to
// compose a new email to the address that actually reaches the system.
function replyHint(address: string): string {
    if (!address) return "";
    return `温馨提示：请不要直接使用邮件客户端的回复功能，请新建一封邮件，并往 ${address} 发送邮件。`;
}

function buildFooter(active: boolean, expectReply: boolean, address: string): string {
    const parts: string[] = [];
    if (expectReply) {
        const hint = replyHint(address);
        if (hint) parts.push(hint);
    }
    if (active) parts.push(CANCEL_HINT);
    if (parts.length === 0) return "";
    return `\n\n————————————\n${parts.join("\n")}`;
}

const NO_REPLY_PREFIX = "[请勿直接回复]";

function noReplyWarning(address: string): string {
    if (!address) return "";
    return (
        `🛑 请勿直接点击"回复"按钮！\n\n` +
        `> 该邮件仅作示例，请勿直接回复。\n` +
        `> 由于系统网关限制，直接回复会被拦截。\n` +
        `> 请点击「新建邮件」或「写邮件」，收件人填写：${address}\n\n`
    );
}

function notify(
    deps: FriendEmailDeps,
    to: string,
    subject: string,
    text: string,
    // Whether an application is still in flight (controls the cancel hint).
    active = true,
    // Whether the recipient is expected to send another email (controls the
    // "compose a new email" hint). Terminal/success mails expect nothing.
    expectReply = true,
    address = "",
    inlineImage?: { imageBase64: string; cid: string },
): Promise<void> {
    const finalSubject = expectReply ? `${NO_REPLY_PREFIX} ${subject}` : subject;
    const finalText = expectReply
        ? noReplyWarning(address) + text + buildFooter(active, expectReply, address)
        : text + buildFooter(active, expectReply, address);
    return deps
        .send(to, finalSubject, finalText, inlineImage)
        .catch(() => {});
}

function normalizeUrl(raw: string): string | null {
    let value = (raw || "").trim();
    if (!value) return null;
    if (!/^https?:\/\//i.test(value)) {
        value = `https://${value}`;
    }
    try {
        const parsed = new URL(value);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
        if (!parsed.hostname) return null;
        // If this is a redirect link (e.g. https://link.example.com/?...&to=https://real.com),
        // extract the real target from the `to` param.
        const target = extractTargetUrl(value);
        const targetParsed = new URL(target);
        return (targetParsed.origin + targetParsed.pathname).replace(/\/+$/, "");
    } catch {
        return null;
    }
}

// strip quoted/forwarded lines so we only look at what the user actually typed
function cleanBody(raw: string): string {
    return raw
        .split(/\r?\n/)
        .filter((line) => !line.trimStart().startsWith(">"))
        .map((line) => line.trim())
        .join("\n")
        .trim();
}

function firstLine(body: string): string {
    const line = body.split(/\n/).find((l) => l.trim().length > 0);
    return (line || "").trim();
}

// Try to locate a JSON object anywhere in the cleaned body.
function extractJson(body: string): Record<string, unknown> | null {
    const cleaned = cleanBody(body);
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) return null;
    const candidate = cleaned.slice(start, end + 1);
    try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            return parsed as Record<string, unknown>;
        }
    } catch {
        // fall through
    }
    return null;
}

function validateApply(payload: Record<string, unknown>): boolean {
    return (
        typeof payload.name === "string" && payload.name.length > 0 &&
        typeof payload.url === "string" && normalizeUrl(payload.url) !== null &&
        typeof payload.avatar === "string" && payload.avatar.length > 0 &&
        typeof payload.desc === "string" && payload.desc.length > 0
    );
}

function validateModify(payload: Record<string, unknown>): boolean {
    const oldUrl = typeof payload.oldUrl === "string" ? normalizeUrl(payload.oldUrl) : null;
    const newUrl = typeof payload.newUrl === "string" ? normalizeUrl(payload.newUrl) : null;
    if (!oldUrl || !newUrl) return false;
    if (oldUrl === newUrl) return false;
    return (
        typeof payload.name === "string" && payload.name.length > 0 &&
        typeof payload.avatar === "string" && payload.avatar.length > 0 &&
        typeof payload.desc === "string" && payload.desc.length > 0
    );
}

function validateDelete(payload: Record<string, unknown>): boolean {
    return typeof payload.url === "string" && normalizeUrl(payload.url) !== null;
}

function loadState(db: DB, sender: string): Promise<FriendEmailState | null> {
    return db
        .select({ value: cache.value })
        .from(cache)
        .where(and(eq(cache.key, sender), eq(cache.type, STATE_TYPE)))
        .then((rows) => {
            if (!rows || rows.length === 0) return null;
            try {
                return JSON.parse(rows[0].value) as FriendEmailState;
            } catch {
                return null;
            }
        });
}

async function saveState(db: DB, sender: string, state: FriendEmailState): Promise<void> {
    await db
        .insert(cache)
        .values({
            key: sender,
            value: JSON.stringify(state),
            type: STATE_TYPE,
            expiresAt: state.expiresAt,
        })
        .onConflictDoUpdate({
            target: [cache.key, cache.type],
            set: {
                value: JSON.stringify(state),
                expiresAt: state.expiresAt,
                updatedAt: new Date(),
            },
        });
}

async function deleteState(db: DB, sender: string): Promise<void> {
    await db
        .delete(cache)
        .where(and(eq(cache.key, sender), eq(cache.type, STATE_TYPE)));
}

async function loadCaptcha(db: DB, sender: string): Promise<CaptchaRecord | null> {
    const rows = await db
        .select({ value: cache.value })
        .from(cache)
        .where(and(eq(cache.key, sender), eq(cache.type, CAPTCHA_TYPE)));
    if (!rows || rows.length === 0) return null;
    try {
        return JSON.parse(rows[0].value) as CaptchaRecord;
    } catch {
        return null;
    }
}

// 同一邮箱并发请求时先删除旧记录,确保只有最新一条验证码有效。
async function saveCaptcha(db: DB, sender: string, record: CaptchaRecord): Promise<void> {
    await db
        .delete(cache)
        .where(and(eq(cache.key, sender), eq(cache.type, CAPTCHA_TYPE)));
    await db.insert(cache).values({
        key: sender,
        value: JSON.stringify(record),
        type: CAPTCHA_TYPE,
        expiresAt: record.expiresAt,
    });
}

async function deleteCaptcha(db: DB, sender: string): Promise<void> {
    await db
        .delete(cache)
        .where(and(eq(cache.key, sender), eq(cache.type, CAPTCHA_TYPE)));
}

async function loadLock(db: DB): Promise<{ owner: string; expiresAt: number } | null> {
    const rows = await db
        .select({ value: cache.value })
        .from(cache)
        .where(and(eq(cache.key, LOCK_KEY), eq(cache.type, LOCK_TYPE)));
    if (!rows || rows.length === 0) return null;
    try {
        return JSON.parse(rows[0].value) as { owner: string; expiresAt: number };
    } catch {
        return null;
    }
}

async function acquireLock(db: DB, sender: string, expiresAt: number, now: number): Promise<boolean> {
    // clear an expired lock first so a stale program cannot block new applicants
    const existing = await loadLock(db);
    if (existing) {
        if (existing.owner === sender) return true;
        if (existing.expiresAt > now) return false;
        await db
            .delete(cache)
            .where(and(eq(cache.key, LOCK_KEY), eq(cache.type, LOCK_TYPE)));
    }
    const inserted = await db
        .insert(cache)
        .values({
            key: LOCK_KEY,
            value: JSON.stringify({ owner: sender, expiresAt }),
            type: LOCK_TYPE,
            expiresAt,
        })
        .onConflictDoNothing({ target: [cache.key, cache.type] })
        .returning({ id: cache.id });
    return inserted.length > 0;
}

async function releaseLock(db: DB): Promise<void> {
    await db
        .delete(cache)
        .where(and(eq(cache.key, LOCK_KEY), eq(cache.type, LOCK_TYPE)));
}

async function terminate(
    deps: FriendEmailDeps,
    sender: string,
    state: FriendEmailState | null,
    message: string,
    address: string,
): Promise<void> {
    if (state) {
        await deleteState(deps.db, sender);
    }
    await releaseLock(deps.db);
    // The application has ended, so no cancel hint; the reply hint stays since
    // these messages invite the applicant to start over.
    await notify(deps, sender, "友链申请已终止", message, false, true, address);
}

function jsonTemplateFor(op: "apply" | "modify" | "delete"): string {
    if (op === "apply") {
        return JSON.stringify({ name: "站点名称", url: "站点URL", avatar: "站点图标URL", desc: "站点简介" });
    }
    if (op === "modify") {
        return JSON.stringify({ oldUrl: "旧站点URL", newUrl: "新站点URL", avatar: "站点图标URL", name: "站点名称", desc: "站点简介" });
    }
    return JSON.stringify({ url: "站点URL" });
}

function jsonTemplateInstruction(op: "apply" | "modify" | "delete"): string {
    return (
        `请在回复邮件正文中完整填写下面的 JSON 模板（不要包含任何其他内容），回复后系统会请你选择验证方式：\n\n` +
        jsonTemplateFor(op) +
        `\n\n说明：\n- 友链申请：站点URL、站点图标URL、站点名称、站点简介\n- 友链修改：旧站点URL、新站点URL、站点图标URL、站点名称、站点简介\n- 友链删除：站点URL`
    );
}

// Match a friend by its normalized URL, so redirect links stored in the DB
// (e.g. https://link.example.com/?...&to=https://real.com) still match the
// real target extracted from the `to` param.
async function findFriendByUrl(db: DB, url: string) {
    const normalized = normalizeUrl(url);
    if (!normalized) return null;
    const all = await db.select().from(friends);
    for (const row of all) {
        if (normalizeUrl(row.url) === normalized) return row;
    }
    return null;
}

// Resolve the owner UID for a self-service friend link:
// - If the applicant's email is bound to an account, use that account's UID.
// - Otherwise, use the configured default (a dedicated self-service account).
async function resolveOwnerUid(db: DB, configGet: FriendEmailDeps["configGet"], sender: string): Promise<number> {
    const bound = await db.select({ id: users.id }).from(users).where(eq(users.email, sender)).limit(1);
    if (bound && bound.length > 0) {
        return bound[0].id;
    }
    const configured = await configGet("friend_email_owner_uid", DEFAULT_EMAIL_OWNER_UID);
    return typeof configured === "number" ? configured : DEFAULT_EMAIL_OWNER_UID;
}

async function applyDbChange(
    db: DB,
    configGet: FriendEmailDeps["configGet"],
    op: "apply" | "modify" | "delete",
    payload: Record<string, unknown>,
    sender: string,
): Promise<void> {
    const uid = await resolveOwnerUid(db, configGet, sender);
    if (op === "apply") {
        const url = normalizeUrl(String(payload.url))!;
        const existing = await findFriendByUrl(db, url);
        if (existing) {
            throw new Error("友链已存在");
        }
        await db.insert(friends).values({
            name: String(payload.name),
            desc: String(payload.desc),
            avatar: String(payload.avatar),
            url,
            uid,
            accepted: 1,
            sort_order: 0,
            group: "",
        });
    } else if (op === "modify") {
        const oldUrl = normalizeUrl(String(payload.oldUrl))!;
        const newUrl = normalizeUrl(String(payload.newUrl))!;
        const existing = await findFriendByUrl(db, oldUrl);
        if (existing) {
            await db.delete(friends).where(eq(friends.id, existing.id));
        }
        await db.insert(friends).values({
            name: String(payload.name),
            desc: String(payload.desc),
            avatar: String(payload.avatar),
            url: newUrl,
            uid,
            accepted: 1,
            sort_order: 0,
            group: "",
        });
    } else {
        const url = normalizeUrl(String(payload.url))!;
        const existing = await findFriendByUrl(db, url);
        if (existing) {
            await db.delete(friends).where(eq(friends.id, existing.id));
        }
    }
}

export async function processFriendEmail(
    deps: FriendEmailDeps,
    mail: { from: string; to: string; text: string },
): Promise<void> {
    const now = deps.now ? deps.now() : Date.now();
    const sender = (mail.from || "").trim().toLowerCase();
    if (!sender) return;

    const enable = await deps.configGet("friend_email_apply_enable", true).catch(() => true);
    console.log(`[friend-email] sender=${sender} enable=${enable} bodyLen=${(mail.text || "").length}`);
    if (!enable) return;

    const body = cleanBody(mail.text || "");
    if (!body) {
        console.log("[friend-email] empty body after cleaning, ignoring");
        return;
    }

    // The address that reaches this worker. Shown in the "compose a new email"
    // hint because the outbound address differs and replies get lost.
    const applyAddress = (mail.to || "").trim();

    const state = await loadState(deps.db, sender);
    console.log(`[friend-email] state=${state ? `${state.op}/${state.stage}` : "none"}`);

    // Any staged application that passed its deadlines is ended here.
    if (state) {
        const expired = state.expiresAt <= now || state.deadline <= now;
        if (expired) {
            console.log("[friend-email] state expired, terminating");
            await terminate(
                deps,
                sender,
                state,
                "本次友链申请已超时自动结束，请重新发送「友链申请 / 友链修改 / 友链删除」发起新的申请。",
                applyAddress,
            );
            return;
        }

        // Force-terminate on explicit cancel request.
        if (firstLine(body) === EMAIL_OP_CANCEL) {
            console.log("[friend-email] cancel requested, terminating");
            await terminate(
                deps,
                sender,
                state,
                "已结束本次友链申请。如需重新申请，请重新发送「友链申请 / 友链修改 / 友链删除」。",
                applyAddress,
            );
            return;
        }
    }

    // ---- Idle: begin a new application ----
    if (!state) {
        const command = firstLine(body);
        const op =
            command === EMAIL_OP_APPLY ? "apply"
            : command === EMAIL_OP_MODIFY ? "modify"
            : command === EMAIL_OP_DELETE ? "delete"
            : null;
        if (!op) {
            console.log(`[friend-email] no matching op for command=${JSON.stringify(command)}`);
            return;
        }
        console.log(`[friend-email] starting op=${op}`);

        const applicationExpiresAt = now + APPLICATION_TIMEOUT_MS;
        const acquired = await acquireLock(deps.db, sender, applicationExpiresAt, now);
        if (!acquired) {
            await notify(deps, sender, "友链申请处理中", "当前有另一位申请者正在处理中，请 20 分钟后再试。", false, true, applyAddress);
            return;
        }

        const newState: FriendEmailState = {
            stage: "awaiting_captcha",
            op,
            payload: {},
            verifyTargets: [],
            expiresAt: applicationExpiresAt,
            deadline: applicationExpiresAt,
            sender,
        };
        await saveState(deps.db, sender, newState);

        // 先做简单人机验证,防止自动化滥用;通过后才进入 JSON 模板环节。
        if (!deps.generateCaptcha) {
            // 未接入验证码生成能力时,直接进入 JSON 环节(保持向后兼容)。
            newState.stage = "awaiting_json";
            await saveState(deps.db, sender, newState);
            await notify(
                deps,
                sender,
                "友链申请 - 请回复 JSON 模板",
                `收到你的${command === EMAIL_OP_APPLY ? "友链申请" : command === EMAIL_OP_MODIFY ? "友链修改" : "友链删除"}请求。\n\n` +
                    jsonTemplateInstruction(op),
                true,
                true,
                applyAddress,
            );
            return;
        }

        const captcha = await deps.generateCaptcha();
        await saveCaptcha(deps.db, sender, {
            answer: captcha.text,
            attempts: 0,
            expiresAt: now + CAPTCHA_TIMEOUT_MS,
        });
        console.log(`[friend-email] captcha issued for ${sender}, awaiting answer`);

        await notify(
            deps,
            sender,
            "友链申请 - 请先完成人机验证",
            `收到你的${command === EMAIL_OP_APPLY ? "友链申请" : command === EMAIL_OP_MODIFY ? "友链修改" : "友链删除"}请求。\n\n` +
                `为防止滥用，请先识别下方验证码图片中的字符，并在新邮件正文中只发送这 4 位字符作为回复。验证通过后系统会发送 JSON 模板给你。\n\n` +
                `[验证码图片已内嵌，请在邮件中查看]` +
                `\n\n验证码 10 分钟内有效。`,
            true,
            true,
            applyAddress,
            captcha,
        );
        return;
    }

    // ---- Awaiting the captcha answer (human check before JSON) ----
    if (state.stage === "awaiting_captcha") {
        const captcha = await loadCaptcha(deps.db, sender);
        if (!captcha) {
            console.log("[friend-email] captcha record missing, terminating");
            await terminate(deps, sender, state, "验证码已失效，本次申请已终止。请重新发起申请。", applyAddress);
            return;
        }
        if (captcha.expiresAt <= now) {
            console.log("[friend-email] captcha expired, terminating");
            await terminate(deps, sender, state, "验证码已超时，本次申请已终止。请重新发起申请。", applyAddress);
            return;
        }

        const answer = firstLine(body).toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (!answer) {
            await notify(
                deps,
                sender,
                "友链申请 - 验证提示",
                `请识别验证码图片中的 4 位字符，并在新邮件正文中只发送这 4 位字符。`,
                true,
                true,
                applyAddress,
            );
            return;
        }

        if (answer !== captcha.answer) {
            captcha.attempts += 1;
            if (captcha.attempts >= CAPTCHA_MAX_ATTEMPTS) {
                console.log(`[friend-email] captcha failed ${captcha.attempts} times, terminating`);
                await terminate(
                    deps,
                    sender,
                    state,
                    "验证码连续输入错误，本次申请已终止。请重新发起申请。",
                    applyAddress,
                );
                return;
            }
            await saveCaptcha(deps.db, sender, captcha);
            await notify(
                deps,
                sender,
                "友链申请 - 验证码错误",
                `验证码不正确（已尝试 ${captcha.attempts}/${CAPTCHA_MAX_ATTEMPTS} 次）。请重新识别验证码图片中的 4 位字符后再回复。`,
                true,
                true,
                applyAddress,
            );
            return;
        }

        // 验证通过,进入 JSON 环节。
        console.log("[friend-email] captcha passed, awaiting JSON");
        await deleteCaptcha(deps.db, sender);
        state.stage = "awaiting_json";
        await saveState(deps.db, sender, state);
        await notify(
            deps,
            sender,
            "友链申请 - 请回复 JSON 模板",
            `人机验证通过。\n\n` + jsonTemplateInstruction(state.op),
            true,
            true,
            applyAddress,
        );
        return;
    }

    // ---- Awaiting the JSON payload ----
    if (state.stage === "awaiting_json") {
        const payload = extractJson(body);
        if (!payload) {
            // 正文中根本没有花括号,说明这不是一次 JSON 尝试(常见于验证码回复被
            // 邮件服务器重复投递,或用户误发了别的内容)。此时只提醒模板,不终止
            // 整个申请——否则一次重复投递就会毁掉已经通过人机验证的申请。
            if (!body.includes("{") || !body.includes("}")) {
                console.log("[friend-email] body is not a JSON attempt, reminding instead of terminating");
                await notify(
                    deps,
                    sender,
                    "友链申请 - 请回复 JSON 模板",
                    `当前正在等待你填写 JSON 模板。\n\n` + jsonTemplateInstruction(state.op),
                    true,
                    true,
                    applyAddress,
                );
                return;
            }

            console.log("[friend-email] JSON extraction failed, terminating");
            await terminate(
                deps,
                sender,
                state,
                "回复的 JSON 无效或不是完整的 JSON，本次申请已终止。请重新发起申请。",
                applyAddress,
            );
            return;
        }

        const valid =
            state.op === "apply" ? validateApply(payload)
            : state.op === "modify" ? validateModify(payload)
            : validateDelete(payload);
        if (!valid) {
            console.log("[friend-email] JSON validation failed, terminating");
            await terminate(
                deps,
                sender,
                state,
                "JSON 中的站点 URL 无效或字段不完整，本次申请已终止。请重新发起申请。",
                applyAddress,
            );
            return;
        }

        const targets: Array<{ url: string; code: string }> = [];
        if (state.op === "apply") {
            targets.push({ url: normalizeUrl(String(payload.url))!, code: generateCode() });
        } else if (state.op === "modify") {
            targets.push({ url: normalizeUrl(String(payload.oldUrl))!, code: generateCode() });
            targets.push({ url: normalizeUrl(String(payload.newUrl))!, code: generateCode() });
        } else {
            targets.push({ url: normalizeUrl(String(payload.url))!, code: generateCode() });
        }

        state.payload = payload;
        state.verifyTargets = targets;
        state.stage = "awaiting_method_choice";
        state.verifyMethod = undefined;
        state.deadline = now + VERIFY_TIMEOUT_MS;
        await saveState(deps.db, sender, state);
        console.log(`[friend-email] JSON accepted, op=${state.op} targets=${targets.map(t => t.url).join(",")}`);

        const first = targets[0];
        await notify(
            deps,
            sender,
            "友链申请 - 请选择验证方式",
            methodChoiceInstruction(first),
            true,
            true,
            applyAddress,
        );
        return;
    }

    // ---- Choosing a verification method ----
    if (state.stage === "awaiting_method_choice") {
        const target = state.verifyTargets[0];
        if (!target) {
            await terminate(deps, sender, state, "验证信息缺失，本次申请已终止。", applyAddress);
            return;
        }

        const method = parseMethodChoice(body);
        if (!method) {
            console.log("[friend-email] awaiting method choice but reply is not 1/2");
            await notify(
                deps,
                sender,
                "友链申请 - 请选择验证方式",
                "请选择一种验证方式后再回复。\n\n" + methodChoiceInstruction(target),
                true,
                true,
                applyAddress,
            );
            return;
        }

        state.verifyMethod = method;
        state.stage = "awaiting_verification";
        state.deadline = now + VERIFY_TIMEOUT_MS;
        await saveState(deps.db, sender, state);
        console.log(`[friend-email] method=${method} selected for ${target.url}`);
        await notify(
            deps,
            sender,
            method === "dns" ? "友链申请 - DNS TXT 验证" : "友链申请 - 站点验证",
            methodInstruction(method, target),
            true,
            true,
            applyAddress,
        );
        return;
    }

    // ---- Verifying domain ownership ----
    // `verifying` is kept for states created before the method-choice upgrade;
    // those applications fall back to the original file-based check.
    if (state.stage === "awaiting_verification" || state.stage === "verifying") {
        const target = state.verifyTargets[0];
        if (!target) {
            await terminate(deps, sender, state, "验证信息缺失，本次申请已终止。", applyAddress);
            return;
        }

        const method: VerifyMethod = state.verifyMethod ?? "file";

        if (!body.includes(EMAIL_CONFIRM_TRIGGER)) {
            console.log("[friend-email] verifying stage but body is missing the confirm trigger");
            await notify(
                deps,
                sender,
                "友链申请 - 验证提示",
                `当前正在进行${methodLabel(method)}。\n\n` + methodInstruction(method, target),
                true,
                true,
                applyAddress,
            );
            return;
        }

        let passed = false;
        let failureDetail = "";
        if (method === "dns") {
            const recordName = `${DNS_RECORD_NAME}.${targetDomain(target.url)}`;
            let records: string[] = [];
            try {
                records = deps.resolveTxt ? await deps.resolveTxt(recordName) : [];
            } catch {
                records = [];
            }
            passed = records.some((value) => value.includes(target.code));
            console.log(`[friend-email] dns lookup ${recordName} records=${records.length} match=${passed}`);
            failureDetail = `未在 ${recordName} 的 TXT 记录中找到验证码`;
        } else {
            const probeUrl = `${target.url}/${target.code}.html`;
            let probe: ProbeResult | null = null;
            try {
                probe = await deps.httpGet(probeUrl);
            } catch {
                probe = null;
            }
            const status = probe?.status ?? 0;
            const bodyText = extractBodyText(probe?.body ?? "");
            const bodyMatches = bodyText.includes(target.code);
            console.log(`[friend-email] probing ${probeUrl} status=${status} bodyMatch=${bodyMatches}`);

            // Strict verification: the URL must return 200 AND the <body> text must
            // contain the verification code (after stripping tags/scripts/styles and
            // collapsing whitespace). This defeats SPA fallbacks, custom 404 pages,
            // 403/500 responses and followed redirects, all of which used to pass
            // the old "anything but 404" check. A plain contains() (not exact
            // equality) tolerates analytics/Live2D/CDN injection while still
            // requiring the code to be actually present in the served page.
            passed = status === 200 && bodyMatches;
            failureDetail = status === 0
                ? "网络错误/超时"
                : status !== 200
                    ? `HTTP 状态码 ${status}（需要 200）`
                    : "页面 <body> 中未找到验证码";
        }

        if (!passed) {
            console.log("[friend-email] verification failed");
            await notify(
                deps,
                sender,
                "友链申请 - 验证失败",
                `验证失败（${methodLabel(method)}）。\n\n原因：${failureDetail}\n\n` +
                    `请按下面的说明完成验证后，重新回复：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
                    methodInstruction(method, target) +
                    `\n\n验证码将在 10 分钟内有效，超时后申请自动结束。`,
                true,
                true,
                applyAddress,
            );
            return;
        }

        // This target passed; move on or finish.
        state.verifyTargets.shift();
        if (state.verifyTargets.length > 0) {
            const next = state.verifyTargets[0];
            state.stage = "awaiting_method_choice";
            state.verifyMethod = undefined;
            state.deadline = now + VERIFY_TIMEOUT_MS;
            await saveState(deps.db, sender, state);
            console.log(`[friend-email] first target passed, moving to ${next.url}`);
            await notify(
                deps,
                sender,
                "友链申请 - 请选择验证方式（下一步）",
                `第一个站点验证通过。\n\n` + methodChoiceInstruction(next),
                true,
                true,
                applyAddress,
            );
            return;
        }

        console.log("[friend-email] all targets verified, applying DB change");
        try {
            await applyDbChange(deps.db, deps.configGet, state.op, state.payload, sender);
        } catch (err: any) {
            await terminate(deps, sender, state, `无法完成数据库变更：${err.message}`, applyAddress);
            return;
        }

        const opLabel = state.op === "apply" ? "友链申请" : state.op === "modify" ? "友链修改" : "友链删除";
        await deps.notifyOwner?.(state.op, state.payload, sender).catch(() => {});
        await deleteState(deps.db, sender);
        await releaseLock(deps.db);
        // Final success: no cancel hint and no reply hint — nothing left to do.
        await notify(deps, sender, "友链申请 - 成功", `「${opLabel}」已成功完成。`, false, false, applyAddress);
        return;
    }
}
