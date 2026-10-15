// ============================================================================
// TOTP (RFC 6238) utilities, WebCrypto-based (no external deps)
// Works in Cloudflare Workers and Bun test environments.
// ============================================================================

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

/**
 * Generate a random TOTP secret (20 bytes) encoded as standard Base32,
 * without padding. This is what the user types into their authenticator app.
 */
export function generateTOTPSecret(bytes = 20): string {
    const random = new Uint8Array(bytes);
    crypto.getRandomValues(random);
    return base32Encode(random);
}

/**
 * Encode raw bytes to standard Base32 (RFC 4648), without padding.
 */
export function base32Encode(bytes: Uint8Array): string {
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of bytes) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
        value &= (1 << bits) - 1;
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}

/**
 * Decode standard Base32. Accepts lowercase input and ignores padding
 * characters ('=') as well as whitespace.
 */
export function base32Decode(input: string): Uint8Array {
    const cleaned = input
        .toUpperCase()
        .replace(/[^A-Z2-7]/g, "");
    const bytes: number[] = [];
    let bits = 0;
    let value = 0;
    for (const char of cleaned) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) continue;
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            bytes.push((value >>> (bits - 8)) & 0xff);
            bits -= 8;
        }
        value &= (1 << bits) - 1;
    }
    return new Uint8Array(bytes);
}

function intToBigEndianBytes(value: number, length = 8): Uint8Array<ArrayBuffer> {
    const bytes = new Uint8Array(new ArrayBuffer(length));
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = value & 0xff;
        value = Math.floor(value / 256);
    }
    return bytes;
}

function dynamicTruncate(hash: Uint8Array<ArrayBuffer>): number {
    const offset = hash[hash.length - 1] & 0x0f;
    const binary =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff);
    return binary % 1_000_000;
}

/**
 * Generate a 6-digit TOTP code for the given secret and point in time.
 */
export async function generateTOTP(secret: string, timeSeconds: number): Promise<string> {
    const key = base32Decode(secret);
    const counter = Math.floor(timeSeconds / 30);

    const cryptoKey = await crypto.subtle.importKey(
        "raw",
        key.buffer as ArrayBuffer,
        { name: "HMAC", hash: "SHA-1" },
        false,
        ["sign"],
    );

    const sig = await crypto.subtle.sign(
        "HMAC",
        cryptoKey,
        intToBigEndianBytes(counter),
    );
    const code = dynamicTruncate(new Uint8Array(sig));
    return code.toString().padStart(6, "0");
}

// Allowed time steps (30s each) on either side of the current window.
// A window of 1 accepts codes from the previous and next 30s periods.
export const TOTP_WINDOW_STEPS = 1;

/**
 * Verify a 6-digit TOTP code against a secret. Accepts a small time skew
 * window (one 30s step on each side). Returns true if the code matches.
 */
export async function verifyTOTP(
    secret: string,
    code: string | undefined | null,
    timeSeconds: number = Math.floor(Date.now() / 1000),
): Promise<boolean> {
    const candidate = (code || "").trim();
    if (!/^\d{6}$/.test(candidate)) return false;

    const nowStep = Math.floor(timeSeconds / 30);
    for (let offset = -TOTP_WINDOW_STEPS; offset <= TOTP_WINDOW_STEPS; offset++) {
        const expected = await generateTOTP(secret, (nowStep + offset) * 30);
        if (expected === candidate) return true;
    }
    return false;
}