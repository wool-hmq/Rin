// ============================================================================
// TOTP recovery codes. Each code is 8 digits, presented as XXXX-XXXX.
// Only the SHA-256 hash is stored, so codes can be shown exactly once and
// verified later without keeping plaintext anywhere.
// ============================================================================

import { hashApiKey } from "./api-key";

/** Number of recovery codes issued when TOTP is enabled. */
export const RECOVERY_CODE_COUNT = 4;

// Use the existing SHA-256 hashing from api-key utils. Recovery codes are
// verified by re-hashing the submitted value and comparing to the stored one.
export async function hashRecoveryCode(code: string): Promise<string> {
    return hashApiKey(code);
}

/** Strips separators/spaces/letters so XXXX-XXXX and XXXXXXXXX parse the same. */
export function normalizeRecoveryCode(input: string): string {
    return (input || "").replace(/[^0-9]/g, "").slice(0, 8);
}

/** Render 8 digits as XXXX-XXXX. */
export function formatRecoveryCode(digits: string): string {
    const clean = normalizeRecoveryCode(digits);
    return clean.length === 8 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

/** Generates a random 8-digit recovery code as a string of digits. */
function generateRecoveryCodeDigits(): string {
    const bytes = new Uint8Array(new ArrayBuffer(8));
    crypto.getRandomValues(bytes);
    let digits = "";
    for (const byte of bytes) {
        digits += String(byte % 10);
    }
    return digits;
}

/**
 * Generate a set of distinct recovery codes. Returns the plaintext digit
 * strings (to be hashed and stored) and the formatted XXXX-XXXX display
 * strings (to be shown to the user exactly once).
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): {
    plaintext: string[];
    display: string[];
} {
    const plaintext: string[] = [];
    const display: string[] = [];
    const seen = new Set<string>();
    while (plaintext.length < count) {
        const digits = generateRecoveryCodeDigits();
        if (seen.has(digits)) continue;
        seen.add(digits);
        plaintext.push(digits);
        display.push(formatRecoveryCode(digits));
    }
    return { plaintext, display };
}