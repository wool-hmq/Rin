// Email verification code storage (in-memory, TTL 5 min)
export const emailCodeStore = new Map<string, { code: string; expires: number }>();

export function cleanExpiredCodes(): void {
    const now = Date.now();
    for (const [key, value] of emailCodeStore.entries()) {
        if (value.expires < now) {
            emailCodeStore.delete(key);
        }
    }
}
