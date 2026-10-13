/**
 * 邮件验证码(人机验证)生成工具。
 *
 * 流程: 先拼出一张带干扰线/干扰点/干扰弧的 SVG,再用 @cf-wasm/resvg
 * 渲染成 PNG。QQ 邮箱、Gmail、Outlook 都不渲染 SVG 内联图,必须转成 PNG。
 *
 * 字符以 SVG <path> 轮廓绘制(自带一套极简笔画字形),不依赖任何字体文件,
 * 因此在 Workers 里无需加载系统字体,也能保证渲染结果一致。
 */

// resvg 的 wasm 初始化由 @cf-wasm/resvg/workerd 入口在模块加载时完成,
// Resvg.async() 内部会 initResvg.ensure() 等待就绪,这里绝不能再调 initResvg
// (它只能调一次,重复调用会同步抛错)。
import type { Resvg as ResvgType } from "@cf-wasm/resvg/workerd";

let resvgCtor: Promise<typeof ResvgType> | null = null;

async function ensureResvg(): Promise<typeof ResvgType> {
    if (!resvgCtor) {
        resvgCtor = import("@cf-wasm/resvg/workerd").then((mod) => mod.Resvg);
    }
    return resvgCtor;
}

// 排除易混字符:0/O/1/I/l 等
const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// 每个字形的极简笔画定义。坐标系为 0..100 宽 x 0..100 高,
// 每条笔画是从 (x1,y1) 到 (x2,y2) 的线段,渲染时按笔画宽度描边。
const GLYPHS: Record<string, Array<[number, number, number, number]>> = {
    A: [[15, 85, 50, 15], [50, 15, 85, 85], [28, 60, 72, 60]],
    B: [[15, 15, 15, 85], [15, 15, 62, 15], [62, 15, 72, 27], [72, 27, 62, 40], [62, 40, 15, 40], [15, 40, 60, 40], [60, 40, 72, 53], [72, 53, 60, 67], [60, 67, 15, 67], [15, 67, 15, 85], [15, 85, 60, 85]],
    C: [[78, 25, 60, 15], [60, 15, 40, 15], [40, 15, 22, 30], [22, 30, 15, 50], [15, 50, 22, 70], [22, 70, 40, 85], [40, 85, 60, 85], [60, 85, 78, 75]],
    D: [[15, 15, 15, 85], [15, 15, 55, 15], [55, 15, 75, 28], [75, 28, 80, 50], [80, 50, 75, 72], [75, 72, 55, 85], [55, 85, 15, 85]],
    E: [[80, 15, 20, 15], [20, 15, 20, 85], [20, 50, 68, 50], [20, 85, 80, 85]],
    F: [[80, 15, 20, 15], [20, 15, 20, 85], [20, 50, 68, 50]],
    G: [[78, 25, 60, 15], [60, 15, 40, 15], [40, 15, 22, 30], [22, 30, 15, 50], [15, 50, 22, 70], [22, 70, 40, 85], [40, 85, 62, 85], [62, 85, 80, 72], [80, 72, 80, 50], [80, 50, 58, 50]],
    H: [[20, 15, 20, 85], [80, 15, 80, 85], [20, 50, 80, 50]],
    J: [[72, 15, 72, 62], [72, 62, 64, 78], [64, 78, 50, 85], [50, 85, 36, 78], [36, 78, 28, 62]],
    K: [[22, 15, 22, 85], [78, 15, 22, 48], [78, 85, 22, 52]],
    L: [[22, 15, 22, 85], [22, 85, 78, 85]],
    M: [[15, 85, 15, 18], [15, 18, 50, 50], [50, 50, 85, 18], [85, 18, 85, 85]],
    N: [[18, 85, 18, 15], [18, 15, 82, 85], [82, 85, 82, 15]],
    P: [[20, 85, 20, 15], [20, 15, 60, 15], [60, 15, 74, 27], [74, 27, 60, 40], [60, 40, 20, 40]],
    Q: [[78, 40, 68, 22], [68, 22, 50, 15], [50, 15, 32, 22], [32, 22, 22, 40], [22, 40, 22, 60], [22, 60, 32, 78], [32, 78, 50, 85], [50, 85, 68, 78], [68, 78, 78, 60], [78, 60, 78, 40], [58, 62, 82, 86]],
    R: [[20, 85, 20, 15], [20, 15, 60, 15], [60, 15, 74, 27], [74, 27, 60, 40], [60, 40, 20, 40], [20, 40, 55, 55], [55, 55, 80, 85]],
    S: [[76, 27, 62, 15], [62, 15, 42, 15], [42, 15, 28, 25], [28, 25, 38, 38], [38, 38, 62, 44], [62, 44, 74, 55], [74, 55, 62, 85], [62, 85, 40, 85], [40, 85, 26, 74]],
    T: [[12, 15, 88, 15], [50, 15, 50, 85]],
    U: [[18, 15, 18, 62], [18, 62, 28, 78], [28, 78, 50, 85], [50, 85, 72, 78], [72, 78, 82, 62], [82, 62, 82, 15]],
    V: [[15, 15, 50, 85], [50, 85, 85, 15]],
    W: [[12, 15, 30, 85], [30, 85, 50, 48], [50, 48, 70, 85], [70, 85, 88, 15]],
    X: [[18, 15, 82, 85], [82, 15, 18, 85]],
    Y: [[15, 15, 50, 48], [85, 15, 50, 48], [50, 48, 50, 85]],
    Z: [[18, 15, 82, 15], [82, 15, 18, 85], [18, 85, 82, 85]],
    "2": [[22, 30, 34, 15], [34, 15, 58, 15], [58, 15, 74, 28], [74, 28, 66, 42], [66, 42, 22, 78], [22, 78, 22, 85], [22, 85, 78, 85]],
    "3": [[20, 28, 36, 15], [36, 15, 60, 15], [60, 15, 76, 30], [76, 30, 60, 46], [60, 46, 38, 46], [60, 54, 76, 66], [76, 66, 60, 85], [60, 85, 34, 85], [34, 85, 20, 72]],
    "4": [[68, 15, 26, 60], [26, 60, 82, 60], [68, 15, 68, 85]],
    "5": [[76, 15, 26, 15], [26, 15, 26, 46], [26, 46, 58, 46], [58, 46, 76, 60], [76, 60, 60, 85], [60, 85, 30, 85], [30, 85, 20, 74]],
    "6": [[74, 24, 58, 15], [58, 15, 40, 22], [40, 22, 26, 42], [26, 42, 22, 66], [22, 66, 34, 82], [34, 82, 56, 85], [56, 85, 74, 72], [74, 72, 74, 54], [74, 54, 58, 48], [58, 48, 40, 52]],
    "7": [[18, 15, 82, 15], [82, 15, 50, 85]],
    "8": [[50, 15, 36, 22], [36, 22, 30, 34], [30, 34, 40, 45], [40, 45, 60, 45], [60, 45, 70, 34], [70, 34, 64, 22], [64, 22, 50, 15], [38, 52, 28, 64], [28, 64, 34, 78], [34, 78, 50, 85], [50, 85, 66, 78], [66, 78, 72, 64], [72, 64, 62, 52], [62, 52, 38, 52]],
    "9": [[62, 48, 44, 54], [44, 54, 28, 68], [28, 68, 34, 82], [34, 82, 56, 85], [56, 85, 74, 72], [74, 72, 78, 48], [78, 48, 66, 26], [66, 26, 50, 15], [50, 15, 36, 22], [36, 22, 30, 40], [30, 40, 38, 45], [38, 45, 60, 45]],
};

export interface CaptchaImage {
    /** PNG 字节 */
    png: Uint8Array;
    /** 用户应输入的答案(大写) */
    text: string;
    /** 供邮件内嵌用的唯一 cid */
    cid: string;
}

const IMAGE_WIDTH = 320;
const IMAGE_HEIGHT = 110;

function randomInt(min: number, max: number): number {
    const r = crypto.getRandomValues(new Uint8Array(1))[0] / 255;
    return Math.floor(min + r * (max - min + 1));
}

function randomColor(): string {
    const h = randomInt(0, 360);
    const s = randomInt(45, 80);
    const l = randomInt(30, 55);
    return `hsl(${h},${s}%,${l}%)`;
}

function randomLightColor(): string {
    const h = randomInt(0, 360);
    const s = randomInt(30, 60);
    const l = randomInt(82, 94);
    return `hsl(${h},${s}%,${l}%)`;
}

function buildCaptchaSvg(text: string): string {
    const charCount = text.length;
    const cellWidth = IMAGE_WIDTH / charCount;

    const parts: string[] = [];
    parts.push(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">`,
    );
    // 背景用浅色块,降低 OCR 对比度
    parts.push(`<rect width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" fill="${randomLightColor()}"/>`);

    // 干扰弧
    for (let i = 0; i < 3; i++) {
        const x1 = randomInt(0, 80);
        const y1 = randomInt(10, IMAGE_HEIGHT - 10);
        const x2 = randomInt(IMAGE_WIDTH - 80, IMAGE_WIDTH);
        const y2 = randomInt(10, IMAGE_HEIGHT - 10);
        const cx = randomInt(IMAGE_WIDTH * 0.3, IMAGE_WIDTH * 0.7);
        const cy = randomInt(-30, IMAGE_HEIGHT + 30);
        parts.push(
            `<path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="${randomColor()}" stroke-width="${randomInt(2, 4)}" fill="none" opacity="0.55"/>`,
        );
    }

    // 干扰线
    for (let i = 0; i < 4; i++) {
        const x1 = randomInt(0, 60);
        const y1 = randomInt(0, IMAGE_HEIGHT);
        const x2 = randomInt(IMAGE_WIDTH - 60, IMAGE_WIDTH);
        const y2 = randomInt(0, IMAGE_HEIGHT);
        parts.push(
            `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${randomColor()}" stroke-width="${randomInt(1, 3)}" opacity="0.5"/>`,
        );
    }

    // 逐字绘制:每个字有自己的旋转角度、垂直偏移和颜色
    for (let i = 0; i < charCount; i++) {
        const ch = text[i];
        const glyph = GLYPHS[ch];
        if (!glyph) continue;

        const centerX = cellWidth * i + cellWidth / 2;
        const centerY = IMAGE_HEIGHT / 2 + randomInt(-10, 10);
        const scale = (cellWidth / 100) * randomInt(78, 92) / 100;
        const rotate = randomInt(-22, 22);
        const color = randomColor();

        const strokes = glyph
            .map(([x1, y1, x2, y2]) => `M${x1} ${y1} L${x2} ${y2}`)
            .join(" ");

        parts.push(
            `<g transform="translate(${centerX} ${centerY}) rotate(${rotate}) scale(${scale})" stroke="${color}" stroke-width="${randomInt(9, 13)}" stroke-linecap="round" fill="none">`,
        );
        parts.push(`<path d="${strokes}"/>`);
        // 描边内层加一条浅色细线,增加噪点感
        parts.push(
            `<path d="${strokes}" stroke="${randomLightColor()}" stroke-width="2.5" opacity="0.7"/>`,
        );
        parts.push(`</g>`);
    }

    // 干扰点
    for (let i = 0; i < 40; i++) {
        const x = randomInt(0, IMAGE_WIDTH);
        const y = randomInt(0, IMAGE_HEIGHT);
        const r = randomInt(1, 3);
        parts.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="${randomColor()}" opacity="${randomInt(30, 70) / 100}"/>`);
    }

    parts.push(`</svg>`);
    return parts.join("");
}

/**
 * 生成一张验证码图片。
 *
 * @param length 字符个数,默认 4
 * @returns PNG 字节、正确答案(大写)和内嵌 cid
 */
export async function generateCaptchaImage(length = 4): Promise<CaptchaImage> {
    let text = "";
    for (let i = 0; i < length; i++) {
        text += CAPTCHA_CHARS[randomInt(0, CAPTCHA_CHARS.length - 1)];
    }

    const svg = buildCaptchaSvg(text);
    const Resvg = await ensureResvg();
    const resvg = await Resvg.async(svg, {
        fitTo: { mode: "original" },
        background: "#ffffff",
    });
    const png = resvg.render().asPng();

    const cidBytes = crypto.getRandomValues(new Uint8Array(12));
    const cid = Array.from(cidBytes, (b) => b.toString(16).padStart(2, "0")).join("");

    return { png, text, cid };
}

/** 将 PNG 字节编码为 base64,用于通过 JSON body 传给发件中继 */
export function pngToBase64(png: Uint8Array): string {
    let binary = "";
    const chunkSize = 0x8000;
    for (let i = 0; i < png.length; i += chunkSize) {
        const chunk = png.subarray(i, Math.min(i + chunkSize, png.length));
        binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
}
