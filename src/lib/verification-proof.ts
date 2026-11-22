import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { ContactType } from "./contact";

/** Server-signed proof "this browser verified <contact>" — required by /api/public/enter. Valid 30 min. */
const TTL_MS = 30 * 60_000;
const sign = (p: string) => createHmac("sha256", process.env.AUTH_SECRET || "").update(p).digest("hex");

export function createProof(type: ContactType, contact: string): string {
  const exp = Date.now() + TTL_MS;
  return `${exp}.${sign(`${type}|${contact}|${exp}`)}`;
}
export function verifyProof(type: ContactType, contact: string, proof: string): boolean {
  const [expStr, sig] = (proof || "").split(".");
  const exp = Number(expStr);
  if (!exp || !sig || Date.now() > exp) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(`${type}|${contact}|${exp}`));
  return a.length === b.length && timingSafeEqual(a, b);
}

export const hashOtp = (type: string, contact: string, code: string) =>
  createHash("sha256").update(`${type}|${contact}|${code}|${process.env.AUTH_SECRET}`).digest("hex");
