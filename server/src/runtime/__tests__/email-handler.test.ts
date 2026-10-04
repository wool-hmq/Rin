import { describe, it, expect } from "bun:test";
import { parseIncoming } from "../email-handler";

function makeMessage(raw: string, from = "test@example.com"): ForwardableEmailMessage {
    const bytes = new TextEncoder().encode(raw);
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });
    return {
        from,
        to: "friend-request@jiaoblog.dpdns.org",
        raw: stream,
        rawSize: bytes.length,
        headers: new Headers(),
    } as unknown as ForwardableEmailMessage;
}

describe("parseIncoming", () => {
    it("extracts the plain-text body", async () => {
        const raw = [
            "Message-ID: <a@b.com>",
            "From: test@example.com",
            "To: friend-request@jiaoblog.dpdns.org",
            "Subject: hi",
            "Content-Type: text/plain; charset=UTF-8",
            "Content-Transfer-Encoding: base64",
            "",
            Buffer.from("友链申请", "utf8").toString("base64"),
            "",
        ].join("\r\n");
        const mail = await parseIncoming(makeMessage(raw));
        expect(mail.from).toBe("test@example.com");
        expect(mail.text.trim()).toBe("友链申请");
    });

    it("strips HTML tags from an HTML-only email", async () => {
        const raw = [
            "Message-ID: <a@b.com>",
            "From: test@example.com",
            "To: friend-request@jiaoblog.dpdns.org",
            "Content-Type: text/html; charset=UTF-8",
            "",
            "<html><body><p>友链申请</p></body></html>",
            "",
        ].join("\r\n");
        const mail = await parseIncoming(makeMessage(raw));
        expect(mail.text.trim()).toBe("友链申请");
    });

    it("handles multipart/alternative and prefers text/plain", async () => {
        const boundary = "abc123";
        const raw = [
            "Message-ID: <a@b.com>",
            "From: test@example.com",
            "To: friend-request@jiaoblog.dpdns.org",
            `Content-Type: multipart/alternative; boundary="${boundary}"`,
            "",
            `--${boundary}`,
            "Content-Type: text/plain; charset=UTF-8",
            "",
            "友链申请",
            `--${boundary}`,
            "Content-Type: text/html; charset=UTF-8",
            "",
            "<p>友链申请</p>",
            `--${boundary}--`,
            "",
        ].join("\r\n");
        const mail = await parseIncoming(makeMessage(raw));
        expect(mail.text.trim()).toBe("友链申请");
    });
});
