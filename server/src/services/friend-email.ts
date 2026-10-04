import { and, eq } from "drizzle-orm";
import { cache, friends } from "../db/schema";
import type { DB } from "../core/hono-types";
import { extractTargetUrl } from "../utils/url";

// ---- Supported operations (exact body) ----
export const EMAIL_OP_APPLY = "友链申请";
export const EMAIL_OP_MODIFY = "友链修改";
export const EMAIL_OP_DELETE = "友链删除";
export const EMAIL_OP_CANCEL = "结束本次友链申请";
export const EMAIL_CONFIRM_TRIGGER = "请你进行下一步验证";

// ---- Storage types in `cache` table ----
const STATE_TYPE = "friend.email";
const LOCK_TYPE = "friend.email.lock";
const LOCK_KEY = "global";

// Email-sourced friend links are owned by the admin account.
const EMAIL_OWNER_UID = 1;

// Domain verification must finish within 10 minutes of the last instruction.
const VERIFY_TIMEOUT_MS = 10 * 60 * 1000;
// An application must finish within 30 minutes overall.
const APPLICATION_TIMEOUT_MS = 30 * 60 * 1000;
// Outbound fetch timeout for the verification probe.
const PROBE_TIMEOUT_MS = 8 * 1000;

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789abcdefghijkmnpqrstuvwxyz";

interface FriendEmailState {
    stage: "awaiting_json" | "verifying";
    op: "apply" | "modify" | "delete";
    payload: Record<string, unknown>;
    // Remaining URLs to verify. Each entry carries its own 8-char code.
    verifyTargets: Array<{ url: string; code: string }>;
    expiresAt: number;
    deadline: number;
    sender: string;
}

interface FriendEmailDeps {
    db: DB;
    configGet: <T>(key: string, defaultValue: T) => Promise<T>;
    send: (to: string, subject: string, text: string) => Promise<void>;
    httpGet: (url: string) => Promise<number>;
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

const CANCEL_HINT = `\n\n————————————\n如需结束本次申请，可回复正文：${EMAIL_OP_CANCEL}`;

function notify(deps: FriendEmailDeps, to: string, subject: string, text: string): Promise<void> {
    return deps.send(to, subject, text + CANCEL_HINT).catch(() => {});
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
): Promise<void> {
    if (state) {
        await deleteState(deps.db, sender);
    }
    await releaseLock(deps.db);
    await notify(deps, sender, "友链申请已终止", message);
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

async function applyDbChange(db: DB, op: "apply" | "modify" | "delete", payload: Record<string, unknown>): Promise<void> {
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
            uid: EMAIL_OWNER_UID,
            accepted: 1,
            sort_order: 0,
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
            uid: EMAIL_OWNER_UID,
            accepted: 1,
            sort_order: 0,
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
            await notify(deps, sender, "友链申请处理中", "当前有另一位申请者正在处理中，请 20 分钟后再试。");
            return;
        }

        const newState: FriendEmailState = {
            stage: "awaiting_json",
            op,
            payload: {},
            verifyTargets: [],
            expiresAt: applicationExpiresAt,
            deadline: applicationExpiresAt,
            sender,
        };
        await saveState(deps.db, sender, newState);
        await notify(
            deps,
            sender,
            "友链申请 - 请回复 JSON 模板",
            `收到你的${command === EMAIL_OP_APPLY ? "友链申请" : command === EMAIL_OP_MODIFY ? "友链修改" : "友链删除"}请求。\n\n` +
                `请在回复邮件正文中完整填写下面的 JSON 模板（不要包含任何其他内容），回复后系统将进入站点验证：\n\n` +
                jsonTemplateFor(op) +
                `\n\n说明：\n- 友链申请：站点URL、站点图标URL、站点名称、站点简介\n- 友链修改：旧站点URL、新站点URL、站点图标URL、站点名称、站点简介\n- 友链删除：站点URL`,
        );
        return;
    }

    // ---- Awaiting the JSON payload ----
    if (state.stage === "awaiting_json") {
        const payload = extractJson(body);
        if (!payload) {
            console.log("[friend-email] JSON extraction failed, terminating");
            await terminate(
                deps,
                sender,
                state,
                "回复的 JSON 无效或不是完整的 JSON，本次申请已终止。请重新发起申请。",
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
        state.stage = "verifying";
        state.deadline = now + VERIFY_TIMEOUT_MS;
        await saveState(deps.db, sender, state);
        console.log(`[friend-email] JSON accepted, op=${state.op} targets=${targets.map(t => t.url).join(",")}`);

        const first = targets[0];
        await notify(
            deps,
            sender,
            "友链申请 - 站点验证",
            `请在站点 ${first.url} 的根目录创建文件 ${first.code}.html（文件内容随意），使以下地址可访问：\n\n${first.url}/${first.code}.html\n\n` +
                `创建完成后，回复本邮件，正文必须为：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
                `验证码 ${first.code} 将在 10 分钟内有效。`,
        );
        return;
    }

    // ---- Verifying domain ownership ----
    if (state.stage === "verifying") {
        if (firstLine(body) !== EMAIL_CONFIRM_TRIGGER) {
            console.log("[friend-email] verifying stage but body is not the confirm trigger");
            await notify(
                deps,
                sender,
                "友链申请 - 验证提示",
                `当前正在进行站点验证。请在站点根目录创建对应的 .html 验证文件后，回复正文为：\n\n${EMAIL_CONFIRM_TRIGGER}`,
            );
            return;
        }

        const target = state.verifyTargets[0];
        if (!target) {
            await terminate(deps, sender, state, "验证信息缺失，本次申请已终止。");
            return;
        }

        const probeUrl = `${target.url}/${target.code}.html`;
        let status = 0;
        try {
            status = await deps.httpGet(probeUrl);
        } catch {
            status = 0;
        }
        console.log(`[friend-email] probing ${probeUrl} status=${status}`);

        // Anything other than 404 (including 200/30x) proves the applicant controls the domain.
        if (status === 404 || status === 0) {
            console.log("[friend-email] verification probe failed");
            await notify(
                deps,
                sender,
                "友链申请 - 验证失败",
                `无法访问 ${probeUrl}（当前状态 ${status === 0 ? "网络错误/超时" : "404"}）。\n\n` +
                    `请确认已创建 ${target.code}.html 文件后，重新回复：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
                    `验证码将在 10 分钟内有效，超时后申请自动结束。`,
            );
            return;
        }

        // This target passed; move on or finish.
        state.verifyTargets.shift();
        if (state.verifyTargets.length > 0) {
            const next = state.verifyTargets[0];
            state.deadline = now + VERIFY_TIMEOUT_MS;
            await saveState(deps.db, sender, state);
            console.log(`[friend-email] first target passed, moving to ${next.url}`);
            await notify(
                deps,
                sender,
                "友链申请 - 站点验证（下一步）",
                `第一个站点验证通过。\n\n请在站点 ${next.url} 的根目录创建文件 ${next.code}.html（文件内容随意），使以下地址可访问：\n\n${next.url}/${next.code}.html\n\n` +
                    `创建完成后，回复正文为：\n\n${EMAIL_CONFIRM_TRIGGER}\n\n` +
                    `验证码 ${next.code} 将在 10 分钟内有效。`,
            );
            return;
        }

        console.log("[friend-email] all targets verified, applying DB change");
        try {
            await applyDbChange(deps.db, state.op, state.payload);
        } catch (err: any) {
            await terminate(deps, sender, state, `无法完成数据库变更：${err.message}`);
            return;
        }

        const opLabel = state.op === "apply" ? "友链申请" : state.op === "modify" ? "友链修改" : "友链删除";
        await deps.notifyOwner?.(state.op, state.payload, sender).catch(() => {});
        await deleteState(deps.db, sender);
        await releaseLock(deps.db);
        await notify(deps, sender, "友链申请 - 成功", `「${opLabel}」已成功完成。`);
        return;
    }
}
