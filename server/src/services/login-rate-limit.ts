// ============================================================================
// Login attempt throttling for password / TOTP logins.
//
// Two independent limits:
//   - Per IP:  15 consecutive failed attempts -> locked for 15 minutes.
//   - Per username (account): 5 consecutive failed attempts -> locked for 15 minutes.
//
// Third-party (OAuth) and email logins are not throttled. When only 1 or 2
// tries remain, the response carries a warning so the client can tell the
// user how many attempts are left before a cooldown kicks in.
// ============================================================================

import { and, eq } from "drizzle-orm";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { cache } from "../db/schema";
import { RateLimitError } from "../errors";

const TYPE = "login_rate";

export const IP_MAX_ATTEMPTS = 15;
export const USER_MAX_ATTEMPTS = 5;
export const COOLDOWN_MS = 15 * 60 * 1000;

// Attempts that still remain before the cooldown warning should be shown.
const WARN_REMAINING_THRESHOLD = 2;

interface RateEntry {
    count: number;
    windowStart: number;
    lockedUntil: number;
}

function entryKey(scope: "ip" | "user", value: string): string {
    return `${scope}:${value}`;
}

function parseEntry(value: string | null): RateEntry | null {
    if (!value) return null;
    try {
        const parsed = JSON.parse(value) as RateEntry;
        if (typeof parsed.count === "number") return parsed;
    } catch {
        return null;
    }
    return null;
}

function serializeEntry(entry: RateEntry): string {
    return JSON.stringify(entry);
}

async function getEntry(c: AppContext, scope: "ip" | "user", value: string): Promise<RateEntry | null> {
    const db = c.get("db");
    const key = entryKey(scope, value);
    const row = await profileAsync(c, `login_rate_get_${scope}`, () => db.query.cache.findFirst({
        where: and(eq(cache.key, key), eq(cache.type, TYPE)),
    }));
    if (!row) return null;
    return parseEntry(row.value);
}

async function setEntry(c: AppContext, scope: "ip" | "user", value: string, entry: RateEntry): Promise<void> {
    const db = c.get("db");
    const key = entryKey(scope, value);
    const now = new Date();
    const existing = await profileAsync(c, `login_rate_find_${scope}`, () => db.query.cache.findFirst({
        where: and(eq(cache.key, key), eq(cache.type, TYPE)),
    }));
    const expiresAt = Math.floor((entry.lockedUntil || Date.now() + COOLDOWN_MS) / 1000);
    if (existing) {
        await profileAsync(c, `login_rate_update_${scope}`, () => db.update(cache)
            .set({ value: serializeEntry(entry), type: TYPE, expiresAt, updatedAt: now })
            .where(eq(cache.id, existing.id)));
    } else {
        await profileAsync(c, `login_rate_insert_${scope}`, () => db.insert(cache).values({
            key,
            value: serializeEntry(entry),
            type: TYPE,
            expiresAt,
            createdAt: now,
            updatedAt: now,
        }));
    }
}

/**
 * Check whether a login attempt from this IP / for this account is allowed.
 * Returns a message when blocked, otherwise null. Does not mutate state.
 */
export async function checkLoginRateLimit(
    c: AppContext,
    scope: "ip" | "user",
    value: string,
): Promise<{
    blocked: boolean;
    message?: string;
    remaining?: number;
    cooldownMs?: number;
}> {
    const entry = await getEntry(c, scope, value);
    if (!entry) return { blocked: false };

    const now = Date.now();
    if (entry.lockedUntil > now) {
        const remainingMs = entry.lockedUntil - now;
        const mins = Math.max(1, Math.ceil(remainingMs / 60000));
        return {
            blocked: true,
            message: `${scope === "ip" ? "IP" : "Account"} is locked for ${mins} minute(s) due to too many failed attempts`,
            cooldownMs: remainingMs,
        };
    }

    // The lock expired; a fresh window starts on the next failure.
    return { blocked: false };
}

/**
 * Record a failed login attempt for the given scope. Returns the rate-limit
 * state: the remaining attempts before cooldown, whether this failure just
 * triggered the lock, and a warning message when 1 or 2 attempts remain.
 */
export async function recordLoginFailure(
    c: AppContext,
    scope: "ip" | "user",
    value: string,
    max: number,
): Promise<{
    remaining: number;
    locked: boolean;
    warning?: string;
}> {
    const now = Date.now();
    const existing = await getEntry(c, scope, value);

    // If a previous lock is still active, keep it (caller should have blocked).
    if (existing && existing.lockedUntil > now) {
        return { remaining: 0, locked: true };
    }

    // Start a new window if the old one expired long ago.
    const inWindow = !!(existing && now - existing.windowStart < COOLDOWN_MS);
    const count = inWindow ? existing.count + 1 : 1;
    const remaining = Math.max(0, max - count);
    const locked = count >= max;
    const entry: RateEntry = {
        count,
        windowStart: inWindow ? existing.windowStart : now,
        lockedUntil: locked ? now + COOLDOWN_MS : 0,
    };
    await setEntry(c, scope, value, entry);

    const subject = scope === "ip" ? "IP" : "Account";
    let warning: string | undefined;
    if (locked) {
        warning = `${subject} has been locked for 15 minutes after too many failed attempts`;
    } else if (remaining > 0 && remaining <= WARN_REMAINING_THRESHOLD) {
        warning = `${subject} has ${remaining} attempt(s) left before a 15-minute cooldown`;
    }
    return { remaining, locked, warning };
}

/**
 * Clear the rate-limit record for a username after a successful login.
 */
export async function clearLoginRateLimit(
    c: AppContext,
    scope: "ip" | "user",
    value: string,
): Promise<void> {
    const db = c.get("db");
    const key = entryKey(scope, value);
    const row = await profileAsync(c, `login_rate_clear_find_${scope}`, () => db.query.cache.findFirst({
        where: and(eq(cache.key, key), eq(cache.type, TYPE)),
    }));
    if (row) {
        await profileAsync(c, `login_rate_clear_${scope}`, () => db.delete(cache).where(eq(cache.id, row.id)));
    }
}

export { RateLimitError };