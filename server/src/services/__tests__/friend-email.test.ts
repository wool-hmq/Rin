import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { createMockDB, cleanupTestDB } from "../../../tests/fixtures";
import { processFriendEmail, EMAIL_OP_APPLY, EMAIL_OP_MODIFY, EMAIL_OP_DELETE, EMAIL_OP_CANCEL, EMAIL_CONFIRM_TRIGGER } from "../friend-email";
import { friends, cache } from "../../db/schema";
import type { DB } from "../../core/hono-types";

interface SentMail {
    to: string;
    subject: string;
    text: string;
    inlineImage?: { imageBase64: string; cid: string };
}

describe("processFriendEmail", () => {
    let db: DB;
    let sqlite: Database;
    let currentTime: number;
    let sent: SentMail[];
    let probeResults: Record<string, number | { status: number; body: string }>;
    let captchaQueue: Array<{ imageBase64: string; text: string; cid: string }>;

    // 默认验证码答案,与 process() 里 generateCaptcha 的返回保持一致
    const CAPTCHA_ANSWER = "AB24";

    beforeEach(() => {
        const mockDB = createMockDB();
        db = mockDB.db as unknown as DB;
        sqlite = mockDB.sqlite;
        currentTime = Date.parse("2026-10-04T00:00:00Z");
        sent = [];
        probeResults = {};
        captchaQueue = [];

        // Admin user required by the friends FK (email-sourced rows use uid=1)
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission)
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
        `);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    function httpGet(url: string): Promise<{ status: number; body: string }> {
        const codeFromUrl = url.match(/\/([A-Za-z0-9]+)\.html$/)?.[1] ?? "";
        if (url in probeResults) {
            const v = probeResults[url];
            if (typeof v === "number") {
                // 旧式写法:只指定状态码,body 沿用路径中的验证码
                return Promise.resolve({ status: v, body: codeFromUrl });
            }
            return Promise.resolve(v);
        }
        // 默认:命中 code.html 时以该路径中的验证码作为 body,模拟用户原样放置的验证文件
        if (codeFromUrl) {
            return Promise.resolve({ status: 200, body: codeFromUrl });
        }
        return Promise.resolve({ status: 404, body: "" });
    }

    async function process(text: string, from = "applicant@example.com", opts?: { withCaptcha?: boolean }) {
        const useCaptcha = opts?.withCaptcha ?? true;
        await processFriendEmail(
            {
                db,
                configGet: async <T>(key: string, defaultValue: T) =>
                    key === "friend_email_apply_enable" ? (true as T) : defaultValue,
                send: async (
                    to: string,
                    subject: string,
                    text: string,
                    inlineImage?: { imageBase64: string; cid: string },
                ) => {
                    sent.push({ to, subject, text, inlineImage });
                },
                httpGet,
                generateCaptcha: useCaptcha
                    ? async () => {
                          const next = captchaQueue.shift();
                          if (next) return next;
                          return { imageBase64: "FAKE_BASE64", text: CAPTCHA_ANSWER, cid: "cid-test-1" };
                      }
                    : undefined,
                now: () => currentTime,
            },
            { from, to: "friend-request@jiaoblog.dpdns.org", text },
        );
    }

    // 发起申请并自动通过验证码环节,让测试聚焦于后续流程。
    async function startApplication(command: string, from = "applicant@example.com") {
        await process(command, from);
        await process(CAPTCHA_ANSWER, from);
    }

    async function captchaRows() {
        return db.select().from(cache).where(eq(cache.type, "friend.email.captcha"));
    }

    async function friendsTable() {
        return db.select().from(friends);
    }

    async function stateRows() {
        return db.select().from(cache).where(eq(cache.type, "friend.email"));
    }

    async function lockRows() {
        return db.select().from(cache).where(eq(cache.type, "friend.email.lock"));
    }

    describe("apply flow", () => {
        it("should complete an application end-to-end", async () => {
            await startApplication(EMAIL_OP_APPLY);
            expect(sent.length).toBe(2);
            expect(sent[0].subject).toContain("人机验证");
            expect(sent[0].inlineImage).toBeDefined();
            expect(sent[1].text).toContain("JSON");

            await process(JSON.stringify({ name: "Friend", url: "https://friend.com", avatar: "https://friend.com/icon.png", desc: "hello" }));
            expect(sent.length).toBe(3);
            expect(sent[2].subject).toContain("站点验证");
            const urlMatch = sent[2].text.match(/https:\/\/friend\.com\/([A-Za-z0-9]+)\.html/);
            expect(urlMatch).not.toBeNull();

            probeResults[`https://friend.com/${urlMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe("Friend");
            expect(rows[0].url).toBe("https://friend.com");
            expect(rows[0].uid).toBe(7);
            expect(rows[0].accepted).toBe(1);

            expect(sent.at(-1)!.subject).toContain("成功");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
            // 验证通过后验证码记录应被清除
            expect((await captchaRows()).length).toBe(0);
        });
    });

    describe("verification strictness", () => {
        // 发起申请并走到站点验证步骤,返回验证码
        async function reachVerify() {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "F", url: "https://friend.com", avatar: "https://friend.com/icon.png", desc: "d" }));
            const urlMatch = sent[2].text.match(/https:\/\/friend\.com\/([A-Za-z0-9]+)\.html/);
            expect(urlMatch).not.toBeNull();
            return urlMatch![1];
        }

        it("should fail when the URL returns 404", async () => {
            const code = await reachVerify();
            probeResults[`https://friend.com/${code}.html`] = { status: 404, body: code };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("验证失败");
            expect((await stateRows()).length).toBe(1);
            expect((await friendsTable()).length).toBe(0);
        });

        it("should fail on non-200 status (403/500)", async () => {
            const code = await reachVerify();
            probeResults[`https://friend.com/${code}.html`] = { status: 403, body: code };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("验证失败");
            expect((await stateRows()).length).toBe(1);
        });

        it("should fail on a redirect-like 3xx", async () => {
            const code = await reachVerify();
            probeResults[`https://friend.com/${code}.html`] = { status: 302, body: "" };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("验证失败");
            expect((await stateRows()).length).toBe(1);
        });

        it("should fail when the body is 200 but content is wrong (SPA fallback)", async () => {
            const code = await reachVerify();
            // 模拟 SPA 回退:200 返回整页 HTML,不包含验证码
            probeResults[`https://friend.com/${code}.html`] = { status: 200, body: `<html><body><div id="app">home</div></body></html>` };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("验证失败");
            expect((await stateRows()).length).toBe(1);
        });

        it("should succeed when the body contains exactly the verification code", async () => {
            const code = await reachVerify();
            probeResults[`https://friend.com/${code}.html`] = { status: 200, body: code };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("成功");
            expect((await stateRows()).length).toBe(0);
            expect((await friendsTable()).length).toBe(1);
        });

        it("should succeed when the code appears alongside framework-injected scripts/styles", async () => {
            const code = await reachVerify();
            // 模拟 Hugo/Hexo/VitePress 等博客框架自动注入的 analytics / 样式脚本
            probeResults[`https://friend.com/${code}.html`] = {
                status: 200,
                body:
                    `<html><head><link rel="stylesheet" href="https://cdn.example.com/app.css"></head>` +
                    `<body><script src="https://cdn.example.com/analytics.js"></script><div class="layout">${code}</div></body></html>`,
            };
            await process(EMAIL_CONFIRM_TRIGGER);
            expect(sent.at(-1)!.subject).toContain("成功");
            expect((await stateRows()).length).toBe(0);
            expect((await friendsTable()).length).toBe(1);
        });

        it("should remind with the full source when the confirm body is missing", async () => {
            const code = await reachVerify();
            await process("hello");
            const remind = sent.at(-1)!;
            expect(remind.subject).toContain("验证提示");
            expect(remind.text).toContain(code);
            expect(remind.text).toContain("原样复制");
            expect(remind.text).toContain("不要增改任何内容");
        });
    });

    describe("modify flow", () => {
        it("should verify old and new URLs with different codes", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', 'https://old.example.com', 1, 1, 0)
            `);

            await startApplication(EMAIL_OP_MODIFY);
            await process(JSON.stringify({ oldUrl: "https://old.example.com", newUrl: "https://new.example.com", avatar: "https://new.example.com/i.png", name: "New", desc: "hi" }));

            expect(sent.length).toBe(3);
            const firstTargetMatch = sent[2].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(firstTargetMatch).not.toBeNull();
            const firstCode = firstTargetMatch![1];

            probeResults[`https://old.example.com/${firstCode}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            // Round 2 prompt for the new URL with a different code
            expect(sent.length).toBe(4);
            const secondTargetMatch = sent[3].text.match(/https:\/\/new\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(secondTargetMatch).not.toBeNull();
            const secondCode = secondTargetMatch![1];
            expect(secondCode).not.toBe(firstCode);

            probeResults[`https://new.example.com/${secondCode}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe("New");
            expect(rows[0].url).toBe("https://new.example.com");
            expect(sent.at(-1)!.subject).toContain("成功");
        });
    });

    describe("delete flow", () => {
        it("should remove the friend after verification", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', 'https://old.example.com', 1, 1, 0)
            `);

            await startApplication(EMAIL_OP_DELETE);
            await process(JSON.stringify({ url: "https://old.example.com" }));

            const targetMatch = sent[2].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();

            probeResults[`https://old.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            expect((await friendsTable()).length).toBe(0);
            expect(sent.at(-1)!.subject).toContain("成功");
        });
    });

    describe("invalid inputs", () => {
        it("should terminate on malformed JSON", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process('{"name": "站点名称", "url":}');

            expect((await friendsTable()).length).toBe(0);
            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await lockRows()).length).toBe(0);
        });

        it("should remind instead of terminating when the body is not a JSON attempt", async () => {
            await startApplication(EMAIL_OP_APPLY);
            // 模拟验证码回复被邮件服务器重复投递:正文无花括号,不是 JSON 尝试
            await process(CAPTCHA_ANSWER);

            expect(sent.at(-1)!.subject).toContain("JSON 模板");
            expect(sent.at(-1)!.text).not.toContain("已终止");
            // 申请依然有效,没有被误终止
            expect((await stateRows()).length).toBe(1);
            expect((await lockRows()).length).toBe(1);
        });

        it("should terminate when the JSON misses required fields", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "OnlyName" }));

            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await stateRows()).length).toBe(0);
        });
    });

    describe("captcha", () => {
        it("should send a captcha image before the JSON template", async () => {
            await process(EMAIL_OP_APPLY);

            expect(sent.length).toBe(1);
            expect(sent[0].subject).toContain("人机验证");
            expect(sent[0].inlineImage).toBeDefined();
            expect(sent[0].inlineImage!.imageBase64).toBe("FAKE_BASE64");
            // 答案不能出现在正文里
            expect(sent[0].text).not.toContain(CAPTCHA_ANSWER);
            // 应处于 awaiting_captcha 阶段,尚未进入 JSON 环节
            expect((await captchaRows()).length).toBe(1);
            expect(sent[0].text).not.toContain("请在回复邮件正文中完整填写");
        });

        it("should advance to the JSON template after the captcha is solved", async () => {
            await process(EMAIL_OP_APPLY);
            await process(CAPTCHA_ANSWER);

            expect(sent.length).toBe(2);
            expect(sent[1].subject).toContain("JSON 模板");
            expect(sent[1].text).toContain("人机验证通过");
            expect((await captchaRows()).length).toBe(0);
        });

        it("should accept the answer regardless of case and surrounding whitespace", async () => {
            await process(EMAIL_OP_APPLY);
            await process(`  ab2-4  `);

            expect(sent.length).toBe(2);
            expect(sent[1].subject).toContain("JSON 模板");
        });

        it("should let the applicant retry after a wrong answer", async () => {
            await process(EMAIL_OP_APPLY);
            await process("WRONG");
            expect(sent.at(-1)!.subject).toContain("验证码错误");
            expect((await captchaRows()).length).toBe(1);

            await process(CAPTCHA_ANSWER);
            expect(sent.at(-1)!.subject).toContain("JSON 模板");
        });

        it("should terminate after too many wrong answers", async () => {
            await process(EMAIL_OP_APPLY);
            for (let i = 0; i < 5; i++) {
                await process("WRONG");
            }

            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
        });

        it("should terminate when the captcha expires", async () => {
            await process(EMAIL_OP_APPLY);
            currentTime += 11 * 60 * 1000; // past the 10-minute captcha window
            await process(CAPTCHA_ANSWER);

            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await stateRows()).length).toBe(0);
        });

        it("should keep only the latest captcha for a concurrent sender", async () => {
            await process(EMAIL_OP_APPLY);
            // 结束当前申请后重新发起,模拟同一邮箱再次申请的场景
            await process(EMAIL_OP_CANCEL);
            captchaQueue.push({ imageBase64: "SECOND", text: "ZZ99", cid: "cid-2" });
            await process(EMAIL_OP_APPLY);

            const rows = await captchaRows();
            expect(rows.length).toBe(1);
            expect(JSON.parse(rows[0].value).answer).toBe("ZZ99");
        });

        it("should skip the captcha when no generator is wired up", async () => {
            await process(EMAIL_OP_APPLY, "applicant@example.com", { withCaptcha: false });

            expect(sent.length).toBe(1);
            expect(sent[0].text).toContain("JSON");
            expect(sent[0].inlineImage).toBeUndefined();
        });

        it("should drop old captcha records when a new application starts", async () => {
            await process(EMAIL_OP_APPLY);
            await process(CAPTCHA_ANSWER);
            expect((await captchaRows()).length).toBe(0);

            // 开始新一轮申请时不应残留旧验证码
            captchaQueue.push({ imageBase64: "NEW", text: "CD35", cid: "cid-3" });
            await process(EMAIL_OP_CANCEL);
            await process(EMAIL_OP_APPLY);
            expect((await captchaRows()).length).toBe(1);
        });
    });

    describe("concurrency", () => {
        it("should reject a second applicant while one is active", async () => {
            await process(EMAIL_OP_APPLY, "first@example.com");
            await process(EMAIL_OP_APPLY, "second@example.com");

            const secondReplies = sent.filter((m) => m.to === "second@example.com");
            expect(secondReplies.length).toBe(1);
            expect(secondReplies[0].text).toContain("20 分钟");
        });
    });

    describe("timeout", () => {
        it("should end an expired application and free the lock", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            currentTime += 11 * 60 * 1000; // past the 10-minute verify deadline
            await process(EMAIL_CONFIRM_TRIGGER);

            expect(sent.at(-1)!.text).toContain("超时");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
        });
    });

    describe("cancel", () => {
        it("should terminate the application on cancel request", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));
            expect((await stateRows()).length).toBe(1);
            expect((await lockRows()).length).toBe(1);

            await process(EMAIL_OP_CANCEL);

            expect(sent.at(-1)!.text).toContain("已结束");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
        });

        it("should allow a new application after cancel", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(EMAIL_OP_CANCEL);
            await startApplication(EMAIL_OP_APPLY);

            expect((await stateRows()).length).toBe(1);
            expect((await lockRows()).length).toBe(1);
        });
    });

    describe("cancel hint", () => {
        it("should append the cancel hint only while the application is in flight", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            // 此时申请仍处于进行中（等待用户回复确认），此前发出的每一封邮件都应带取消提示。
            expect(sent.length).toBeGreaterThan(0);
            for (const m of sent) {
                expect(m.text).toContain("结束本次友链申请");
            }
        });

        it("should not append the cancel hint once the application has ended", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(EMAIL_OP_CANCEL);

            const last = sent.at(-1)!;
            expect(last.text).toContain("已结束");
            // The body says "已结束本次友链申请", so assert on the hint's own wording.
            expect(last.text).not.toContain("如需结束本次申请");
        });

        it("should not append the cancel hint to the success email", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            const targetMatch = sent[2].text.match(/https:\/\/t\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();
            probeResults[`https://t.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const success = sent.at(-1)!;
            expect(success.subject).toContain("成功");
            expect(success.text).not.toContain("如需结束本次申请");
            expect(success.text).not.toContain("————————————");
        });
    });

    describe("reply hint", () => {
        it("should tell applicants to compose a new email to the receiving address", async () => {
            await process(EMAIL_OP_APPLY);

            expect(sent[0].text).toContain("请不要直接使用邮件客户端的回复功能");
            expect(sent[0].text).toContain("friend-request@jiaoblog.dpdns.org");
        });

        it("should keep the reply hint on terminal emails that invite a retry", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(EMAIL_OP_CANCEL);

            const last = sent.at(-1)!;
            expect(last.text).toContain("请不要直接使用邮件客户端的回复功能");
            expect(last.text).toContain("friend-request@jiaoblog.dpdns.org");
        });

        it("should omit the reply hint from the success email", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            const targetMatch = sent[2].text.match(/https:\/\/t\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();
            probeResults[`https://t.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            expect(sent.at(-1)!.text).not.toContain("请不要直接使用邮件客户端的回复功能");
        });
    });

    describe("redirect to param", () => {
        const REDIRECT_URL = "https://link.jiaoblog.dpdns.org/?from=x&to=https://old.example.com&safe=f";

        it("should delete by matching the to param of a redirect link", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', '${REDIRECT_URL}', 1, 1, 0)
            `);

            await startApplication(EMAIL_OP_DELETE);
            await process(JSON.stringify({ url: REDIRECT_URL }));

            const targetMatch = sent[2].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();

            probeResults[`https://old.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            expect((await friendsTable()).length).toBe(0);
        });

        it("should match when the user provides the real URL instead of the redirect link", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', '${REDIRECT_URL}', 1, 1, 0)
            `);

            await startApplication(EMAIL_OP_DELETE);
            await process(JSON.stringify({ url: "https://old.example.com" }));

            const targetMatch = sent[2].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();

            probeResults[`https://old.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            expect((await friendsTable()).length).toBe(0);
        });

        it("should modify by matching the old URL via to param", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', '${REDIRECT_URL}', 1, 1, 0)
            `);

            await startApplication(EMAIL_OP_MODIFY);
            await process(JSON.stringify({ oldUrl: REDIRECT_URL, newUrl: "https://new.example.com", avatar: "i", name: "New", desc: "hi" }));

            const firstTargetMatch = sent[2].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(firstTargetMatch).not.toBeNull();
            probeResults[`https://old.example.com/${firstTargetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const secondTargetMatch = sent[3].text.match(/https:\/\/new\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(secondTargetMatch).not.toBeNull();
            probeResults[`https://new.example.com/${secondTargetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe("New");
            expect(rows[0].url).toBe("https://new.example.com");
        });
    });

    describe("owner uid", () => {
        it("should use the bound account UID when the applicant email matches a user", async () => {
            sqlite.exec(`
                INSERT INTO users (id, username, openid, email, avatar, permission)
                VALUES (42, 'bound', 'gh_bound', 'bound@example.com', 'a.png', 0)
            `);

            await startApplication(EMAIL_OP_APPLY, "bound@example.com");
            await process(JSON.stringify({ name: "B", url: "https://b.example.com", avatar: "i", desc: "d" }), "bound@example.com");

            const targetMatch = sent[2].text.match(/https:\/\/b\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();
            probeResults[`https://b.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER, "bound@example.com");

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].uid).toBe(42);
        });

        it("should fall back to the default UID when no account matches", async () => {
            await startApplication(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            const targetMatch = sent[2].text.match(/https:\/\/t\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();
            probeResults[`https://t.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].uid).toBe(7);
        });
    });
});