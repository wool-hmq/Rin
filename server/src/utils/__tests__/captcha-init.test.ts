import { describe, it, expect, mock } from "bun:test";

// 复现 workerd 入口的行为:模块加载时调用一次 initResvg,之后再调会同步抛错。
// generateCaptchaImage 只能依赖 Resvg.async,不能自己再调 initResvg。
let initCalls = 0;

const fakeResvg = {
    async async(_svg: string) {
        return {
            render() {
                // 1x1 PNG
                return { asPng: () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]) };
            },
        };
    },
};

mock.module("@cf-wasm/resvg/workerd", () => {
    initCalls += 1;
    // 模拟 workerd.js 顶层的一次性初始化:再次调用必须抛错
    const initResvg = mock(() => {
        throw new Error(
            "(@cf-wasm/resvg): Function already called. The `initResvg()` function can be used only once.",
        );
    });
    return {
        Resvg: fakeResvg,
        initResvg,
        resvgWasmModule: "fake-wasm",
    };
});

describe("captcha resvg init", () => {
    it("should not call initResvg itself; Resvg.async handles readiness", async () => {
        const { generateCaptchaImage } = await import("../captcha");
        const img = await generateCaptchaImage(4);

        expect(img.png.length).toBeGreaterThan(0);
        expect(img.text).toHaveLength(4);
        expect(img.cid).toHaveLength(24);
        // workerd 入口只加载一次,后续调用都复用已就绪的 Resvg
        expect(initCalls).toBe(1);
    });

    it("should work across repeated calls without re-initializing", async () => {
        const { generateCaptchaImage } = await import("../captcha");
        const first = await generateCaptchaImage(4);
        const second = await generateCaptchaImage(4);

        expect(first.text).toHaveLength(4);
        expect(second.text).toHaveLength(4);
        expect(initCalls).toBe(1);
    });
});
