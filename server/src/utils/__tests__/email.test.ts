import { afterEach, describe, expect, it, mock } from "bun:test";
import { isEmailConfigured, resolveEndpoints, sendEmail } from "../email";

const originalFetch = globalThis.fetch;

afterEach(() => {
    globalThis.fetch = originalFetch;
});

function env(values: Record<string, string>): Env {
    return values as unknown as Env;
}

function mockFetchSequence(responses: Array<{ status: number; body: string }>) {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    let index = 0;
    globalThis.fetch = mock(async (url: string | URL | Request, init?: RequestInit) => {
        calls.push({ url: url.toString(), init: init as RequestInit });
        const res = responses[Math.min(index, responses.length - 1)];
        index += 1;
        return new Response(res.body, { status: res.status });
    });
    return calls;
}

describe("resolveEndpoints", () => {
    it("parses a single MailPort URL and key", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_SEND_URLS: '["https://mailport.vercel.app/api/abc/send"]',
                EMAIL_SEND_KEYS: "secret-key",
            }),
        );
        expect(endpoints).toEqual([
            { mode: "mailport", url: "https://mailport.vercel.app/api/abc/send", key: "secret-key" },
        ]);
    });

    it("pairs multiple URLs with multiple keys in order", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_SEND_URLS: '["https://a.vercel.app/api/one/send", "https://b.vercel.app/api/two/send"]',
                EMAIL_SEND_KEYS: '["key-one", "key-two"]',
            }),
        );
        expect(endpoints).toEqual([
            { mode: "mailport", url: "https://a.vercel.app/api/one/send", key: "key-one" },
            { mode: "mailport", url: "https://b.vercel.app/api/two/send", key: "key-two" },
        ]);
    });

    it("reuses a single key for all URLs", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_SEND_URLS: '["https://a/send", "https://b/send"]',
                EMAIL_SEND_KEYS: "shared-key",
            }),
        );
        expect(endpoints).toHaveLength(2);
        expect(endpoints.every((e) => e.mode === "mailport" && e.key === "shared-key")).toBe(true);
    });

    it("accepts a bare URL that is not JSON", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_SEND_URLS: "https://mailport.vercel.app/api/abc/send",
                EMAIL_SEND_KEYS: "secret-key",
            }),
        );
        expect(endpoints).toHaveLength(1);
    });

    it("throws when URL and key counts do not match", () => {
        expect(() =>
            resolveEndpoints(
                env({
                    EMAIL_SEND_URLS: '["https://a/send", "https://b/send"]',
                    EMAIL_SEND_KEYS: '["k1", "k2", "k3"]',
                }),
            ),
        ).toThrow(/one-to-one/);
    });

    it("throws when URLs are set but keys are missing", () => {
        expect(() => resolveEndpoints(env({ EMAIL_SEND_URLS: '["https://a/send"]' }))).toThrow(
            /EMAIL_SEND_KEYS is required/,
        );
    });

    it("falls back to the legacy resend vars when the new ones are absent", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send",
                EMAIL_RESEND_PASS: "legacy-pass",
            }),
        );
        expect(endpoints).toEqual([
            { mode: "legacy", url: "https://rin-email.vercel.app/api/send", pass: "legacy-pass" },
        ]);
    });

    it("prefers the new vars over the legacy ones", () => {
        const endpoints = resolveEndpoints(
            env({
                EMAIL_SEND_URLS: '["https://mailport.vercel.app/api/abc/send"]',
                EMAIL_SEND_KEYS: "secret-key",
                EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send",
                EMAIL_RESEND_PASS: "legacy-pass",
            }),
        );
        expect(endpoints).toHaveLength(1);
        expect(endpoints[0].mode).toBe("mailport");
    });

    it("returns nothing when email is not configured", () => {
        expect(resolveEndpoints(env({}))).toEqual([]);
    });
});

describe("isEmailConfigured", () => {
    it("is true when the new vars are set", () => {
        expect(isEmailConfigured(env({ EMAIL_SEND_URLS: '["https://a/send"]', EMAIL_SEND_KEYS: "k" }))).toBe(true);
    });

    it("is true when only the legacy vars are set", () => {
        expect(isEmailConfigured(env({ EMAIL_RESEND_URL: "https://a/send", EMAIL_RESEND_PASS: "p" }))).toBe(true);
    });

    it("is false when neither is set", () => {
        expect(isEmailConfigured(env({}))).toBe(false);
    });
});

describe("sendEmail", () => {
    it("sends via MailPort with a bearer key", async () => {
        const calls = mockFetchSequence([{ status: 200, body: '{"success":true}' }]);
        await sendEmail(
            env({ EMAIL_SEND_URLS: '["https://mailport.vercel.app/api/abc/send"]', EMAIL_SEND_KEYS: "secret-key" }),
            "to@example.com",
            "Subject",
            "body",
        );
        expect(calls).toHaveLength(1);
        expect(calls[0].url).toBe("https://mailport.vercel.app/api/abc/send");
        expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer secret-key" });
        expect(JSON.parse(calls[0].init.body as string)).toMatchObject({
            to: "to@example.com",
            subject: "Subject",
            text: "body",
        });
    });

    it("sends via the legacy service with a pass field", async () => {
        const calls = mockFetchSequence([{ status: 200, body: "" }]);
        await sendEmail(
            env({ EMAIL_RESEND_URL: "https://rin-email.vercel.app/api/send", EMAIL_RESEND_PASS: "legacy-pass" }),
            "to@example.com",
            "Subject",
            "body",
        );
        expect(calls[0].url).toBe("https://rin-email.vercel.app/api/send");
        expect(JSON.parse(calls[0].init.body as string)).toMatchObject({ pass: "legacy-pass" });
        expect(calls[0].init.headers).not.toHaveProperty("Authorization");
    });

    it("polls endpoints in order until one succeeds", async () => {
        const calls = mockFetchSequence([
            { status: 500, body: "down" },
            { status: 200, body: '{"success":true}' },
        ]);
        await sendEmail(
            env({
                EMAIL_SEND_URLS: '["https://first/send", "https://second/send"]',
                EMAIL_SEND_KEYS: '["k1", "k2"]',
            }),
            "to@example.com",
            "Subject",
            "body",
        );
        expect(calls.map((c) => c.url)).toEqual(["https://first/send", "https://second/send"]);
        expect(calls[0].init.headers).toMatchObject({ Authorization: "Bearer k1" });
        expect(calls[1].init.headers).toMatchObject({ Authorization: "Bearer k2" });
    });

    it("throws when every endpoint fails", async () => {
        mockFetchSequence([
            { status: 500, body: "down" },
            { status: 502, body: "bad gateway" },
        ]);
        await expect(
            sendEmail(
                env({
                    EMAIL_SEND_URLS: '["https://first/send", "https://second/send"]',
                    EMAIL_SEND_KEYS: '["k1", "k2"]',
                }),
                "to@example.com",
                "Subject",
                "body",
            ),
        ).rejects.toThrow(/All email endpoints failed/);
    });

    it("throws a clear error when nothing is configured", async () => {
        await expect(sendEmail(env({}), "to@example.com", "Subject", "body")).rejects.toThrow(
            /EMAIL_SEND_URLS and EMAIL_SEND_KEYS/,
        );
    });
});
