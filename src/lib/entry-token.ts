import { createHmac, timingSafeEqual } from "crypto";

/**
 * Short-lived, HMAC-signed token handed to the browser right after a student
 * registers. The browser exchanges it for a NextAuth session via the
 * "exam-entry" provider. Valid for 2 minutes, bound to one user id.
 */
const TTL_MS = 2 * 60_000;

function sign(payload: string): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("Missing AUTH_SECRET");
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createEntryToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  const payload = `${userId}.${exp}`;
  return `${exp}.${sign(payload)}`;
}

export function verifyEntryToken(userId: string, token: string): boolean {
  const [expStr, sig] = (token || "").split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  const expected = sign(`${userId}.${exp}`);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
