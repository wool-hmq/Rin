import { describe, it, expect } from "bun:test";
import {
  base32Decode,
  base32Encode,
  generateTOTP,
  generateTOTPSecret,
  verifyTOTP,
} from "../totp";

// RFC 6238 Appendix B test vectors (SHA-1, 8-digit) adapted to 6 digits.
// Secret "12345678901234567890" in Base32 is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// RFC vectors are 8-digit; derive the 6-digit equivalent by mod 1e6.
const RFC_VECTORS: Array<{ time: number; eightDigit: string }> = [
  { time: 59, eightDigit: "94287082" },
  { time: 1111111109, eightDigit: "07081804" },
  { time: 1111111111, eightDigit: "14050471" },
  { time: 1234567890, eightDigit: "89005924" },
  { time: 2000000000, eightDigit: "69279037" },
  { time: 20000000000, eightDigit: "65353130" },
];

describe("totp utils", () => {
  it("matches RFC 6238 SHA-1 test vectors", async () => {
    for (const { time, eightDigit } of RFC_VECTORS) {
      const code = await generateTOTP(RFC_SECRET, time);
      expect(code).toBe(String(parseInt(eightDigit) % 1_000_000).padStart(6, "0"));
    }
  });

  it("round-trips base32 encoding", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 251, 252, 253, 254, 255, 77]);
    const encoded = base32Encode(bytes);
    expect(encoded).toMatch(/^[A-Z2-7]+$/);
    expect(Array.from(base32Decode(encoded))).toEqual(Array.from(bytes));
  });

  it("decodes lowercase and padded input", () => {
    expect(Array.from(base32Decode("mzxw6ytb"))).toEqual(
      Array.from(base32Decode("MZXW6YTB====")),
    );
  });

  it("generates a valid base32 secret", () => {
    const secret = generateTOTPSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret).length).toBe(20);
  });

  it("verifies the current code and rejects others", async () => {
    const secret = generateTOTPSecret();
    const now = Math.floor(Date.now() / 1000);
    const code = await generateTOTP(secret, now);

    expect(await verifyTOTP(secret, code, now)).toBe(true);
    expect(await verifyTOTP(secret, " ".repeat(0) + code, now)).toBe(true);

    // A code outside the +/-1 step window must fail.
    const stale = await generateTOTP(secret, now - 5 * 30);
    expect(await verifyTOTP(secret, stale, now)).toBe(false);
  });

  it("rejects malformed codes", async () => {
    const secret = generateTOTPSecret();
    expect(await verifyTOTP(secret, "12345")).toBe(false);
    expect(await verifyTOTP(secret, "abcdef")).toBe(false);
    expect(await verifyTOTP(secret, "")).toBe(false);
    expect(await verifyTOTP(secret, null)).toBe(false);
    expect(await verifyTOTP(secret, undefined)).toBe(false);
  });

  it("accepts codes within the +/-1 step window", async () => {
    const secret = generateTOTPSecret();
    const now = Math.floor(Date.now() / 1000);
    const previous = await generateTOTP(secret, now - 30);
    const next = await generateTOTP(secret, now + 30);

    expect(await verifyTOTP(secret, previous, now)).toBe(true);
    expect(await verifyTOTP(secret, next, now)).toBe(true);
  });
});
