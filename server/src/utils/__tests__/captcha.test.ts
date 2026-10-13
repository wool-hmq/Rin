import { describe, it, expect } from "bun:test";
import { pngToBase64 } from "../captcha";

describe("pngToBase64", () => {
    it("should encode a PNG bytes to standard base64 without a data: prefix", () => {
        // 1x1 透明 PNG
        const png = Uint8Array.from([
            0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
            0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
            0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
            0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
            0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41,
            0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
            0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
            0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae,
            0x42, 0x60, 0x82,
        ]);
        const encoded = pngToBase64(png);
        expect(encoded).not.toContain("data:");
        // 可往返解码回原始字节
        const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        expect(decoded.length).toBe(png.length);
        for (let i = 0; i < png.length; i++) {
            expect(decoded[i]).toBe(png[i]);
        }
    });

    it("should handle large buffers without String.fromCharCode range errors", () => {
        // 超过 0x8000 分块大小的输入
        const png = new Uint8Array(20000).fill(0x41);
        const encoded = pngToBase64(png);
        const decoded = Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0));
        expect(decoded.length).toBe(20000);
    });
});
