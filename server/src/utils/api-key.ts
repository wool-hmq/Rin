// 24 random bytes render as exactly 32 base64url characters.
const KEY_BYTES = 24;

function toBase64Url(bytes: Uint8Array): string {
    let binary = "";
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// 32-character API key: 24 random bytes rendered as base64url without padding.
export function generateApiKey(): string {
    const bytes = new Uint8Array(new ArrayBuffer(KEY_BYTES));
    crypto.getRandomValues(bytes);
    return toBase64Url(bytes);
}

export async function hashApiKey(key: string): Promise<string> {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
}

async function deriveEncryptionKey(secret: string): Promise<CryptoKey> {
    const material = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secret),
        "PBKDF2",
        false,
        ["deriveKey"],
    );
    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: new TextEncoder().encode("rin-api-key-encryption"),
            iterations: 100000,
            hash: "SHA-256",
        },
        material,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"],
    );
}

export async function encryptApiKey(key: string, secret: string): Promise<string> {
    const cryptoKey = await deriveEncryptionKey(secret);
    const iv = new Uint8Array(new ArrayBuffer(12));
    crypto.getRandomValues(iv);
    const cipher = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        new TextEncoder().encode(key),
    );
    return `${toBase64Url(iv)}.${toBase64Url(new Uint8Array(cipher))}`;
}

export async function decryptApiKey(payload: string, secret: string): Promise<string | null> {
    const [ivPart, cipherPart] = payload.split(".");
    if (!ivPart || !cipherPart) {
        return null;
    }
    try {
        const cryptoKey = await deriveEncryptionKey(secret);
        const plain = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: fromBase64Url(ivPart) },
            cryptoKey,
            fromBase64Url(cipherPart),
        );
        return new TextDecoder().decode(plain);
    } catch {
        return null;
    }
}
