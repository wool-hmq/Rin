import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import type { Database } from "bun:sqlite";
import { eq } from "drizzle-orm";
import { createMockDB, cleanupTestDB } from "../../../tests/fixtures";
import { processFriendEmail, EMAIL_OP_APPLY, EMAIL_OP_MODIFY, EMAIL_OP_DELETE, EMAIL_CONFIRM_TRIGGER } from "../friend-email";
import { friends, cache } from "../../db/schema";
import type { DB } from "../../core/hono-types";

interface SentMail {
    to: string;
    subject: string;
    text: string;
}

describe("processFriendEmail", () => {
    let db: DB;
    let sqlite: Database;
    let currentTime: number;
    let sent: SentMail[];
    let probeResults: Record<string, number>;

    beforeEach(() => {
        const mockDB = createMockDB();
        db = mockDB.db as unknown as DB;
        sqlite = mockDB.sqlite;
        currentTime = Date.parse("2026-10-04T00:00:00Z");
        sent = [];
        probeResults = {};

        // Admin user required by the friends FK (email-sourced rows use uid=1)
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission)
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
        `);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    function httpGet(url: string): Promise<number> {
        if (url in probeResults) return Promise.resolve(probeResults[url]);
        return Promise.resolve(404);
    }

    async function process(text: string, from = "applicant@example.com") {
        await processFriendEmail(
            {
                db,
                configGet: async <T>(key: string, defaultValue: T) =>
                    key === "friend_email_apply_enable" ? (true as T) : defaultValue,
                send: async (to: string, subject: string, text: string) => {
                    sent.push({ to, subject, text });
                },
                httpGet,
                now: () => currentTime,
            },
            { from, to: "friend-request@jiaoblog.dpdns.org", text },
        );
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
            await process(EMAIL_OP_APPLY);
            expect(sent.length).toBe(1);
            expect(sent[0].text).toContain("JSON");

            await process(JSON.stringify({ name: "Friend", url: "https://friend.com", avatar: "https://friend.com/icon.png", desc: "hello" }));
            expect(sent.length).toBe(2);
            expect(sent[1].subject).toContain("站点验证");
            const urlMatch = sent[1].text.match(/https:\/\/friend\.com\/([A-Za-z0-9]+)\.html/);
            expect(urlMatch).not.toBeNull();

            probeResults[`https://friend.com/${urlMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            const rows = await friendsTable();
            expect(rows.length).toBe(1);
            expect(rows[0].name).toBe("Friend");
            expect(rows[0].url).toBe("https://friend.com");
            expect(rows[0].uid).toBe(1);
            expect(rows[0].accepted).toBe(1);

            expect(sent.at(-1)!.subject).toContain("成功");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
        });
    });

    describe("modify flow", () => {
        it("should verify old and new URLs with different codes", async () => {
            sqlite.exec(`
                INSERT INTO friends (name, desc, avatar, url, uid, accepted, sort_order)
                VALUES ('Old', 'd', 'icon', 'https://old.example.com', 1, 1, 0)
            `);

            await process(EMAIL_OP_MODIFY);
            await process(JSON.stringify({ oldUrl: "https://old.example.com", newUrl: "https://new.example.com", avatar: "https://new.example.com/i.png", name: "New", desc: "hi" }));

            expect(sent.length).toBe(2);
            const firstTargetMatch = sent[1].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(firstTargetMatch).not.toBeNull();
            const firstCode = firstTargetMatch![1];

            probeResults[`https://old.example.com/${firstCode}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            // Round 2 prompt for the new URL with a different code
            expect(sent.length).toBe(3);
            const secondTargetMatch = sent[2].text.match(/https:\/\/new\.example\.com\/([A-Za-z0-9]+)\.html/);
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

            await process(EMAIL_OP_DELETE);
            await process(JSON.stringify({ url: "https://old.example.com" }));

            const targetMatch = sent[1].text.match(/https:\/\/old\.example\.com\/([A-Za-z0-9]+)\.html/);
            expect(targetMatch).not.toBeNull();

            probeResults[`https://old.example.com/${targetMatch![1]}.html`] = 200;
            await process(EMAIL_CONFIRM_TRIGGER);

            expect((await friendsTable()).length).toBe(0);
            expect(sent.at(-1)!.subject).toContain("成功");
        });
    });

    describe("invalid inputs", () => {
        it("should terminate on invalid JSON", async () => {
            await process(EMAIL_OP_APPLY);
            await process("这不是 JSON 也不是模板");

            expect((await friendsTable()).length).toBe(0);
            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await lockRows()).length).toBe(0);
        });

        it("should terminate when the JSON misses required fields", async () => {
            await process(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "OnlyName" }));

            expect(sent.at(-1)!.text).toContain("已终止");
            expect((await stateRows()).length).toBe(0);
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
            await process(EMAIL_OP_APPLY);
            await process(JSON.stringify({ name: "T", url: "https://t.example.com", avatar: "x", desc: "d" }));

            currentTime += 11 * 60 * 1000; // past the 10-minute verify deadline
            await process(EMAIL_CONFIRM_TRIGGER);

            expect(sent.at(-1)!.text).toContain("超时");
            expect((await stateRows()).length).toBe(0);
            expect((await lockRows()).length).toBe(0);
        });
    });
});