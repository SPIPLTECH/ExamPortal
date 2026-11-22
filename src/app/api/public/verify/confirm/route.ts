import { connectDB } from "@/lib/db";
import { ContactVerification } from "@/models/ContactVerification";
import { normalizeContact, isValidContact, type ContactType } from "@/lib/contact";
import { createProof, hashOtp } from "@/lib/verification-proof";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/audit";
import { ok, fail, handleRoute } from "@/lib/api";

const MAX_ATTEMPTS = 5;

export const POST = handleRoute(async (req: Request) => {
  if (!rateLimit(`otpc-ip:${clientIp(req) ?? "x"}`, 30, 60_000)) return fail("Too many attempts. Try again shortly.", 429);
  const body = (await req.json().catch(() => ({}))) as { type?: string; contact?: string; code?: string };
  const type = body.type === "EMAIL" ? "EMAIL" : body.type === "MOBILE" ? "MOBILE" : null;
  if (!type) return fail("Invalid contact type", 400);
  const contact = normalizeContact(type as ContactType, String(body.contact ?? ""));
  const code = String(body.code ?? "").trim();
  if (!isValidContact(type, contact) || !/^\d{6}$/.test(code)) return fail("Enter the 6-digit code", 422);

  await connectDB();
  const rec = await ContactVerification.findOne({ type, contact });
  if (!rec) return fail("No code was requested for this contact", 404);
  if (rec.verifiedAt) return ok({ verified: true, alreadyVerified: true, proof: createProof(type, contact) });
  if (!rec.codeHash || !rec.expiresAt || rec.expiresAt.getTime() < Date.now()) {
    return fail("This code has expired. Request a new one.", 410);
  }
  if (rec.attempts >= MAX_ATTEMPTS) return fail("Too many wrong attempts. Request a new code.", 429);

  if (rec.codeHash !== hashOtp(type, contact, code)) {
    rec.attempts += 1;
    await rec.save();
    return fail(`Incorrect code. ${Math.max(0, MAX_ATTEMPTS - rec.attempts)} attempt(s) left.`, 400);
  }
  rec.verifiedAt = new Date();
  rec.codeHash = null;
  rec.expiresAt = null;
  await rec.save();
  return ok({ verified: true, proof: createProof(type, contact) });
});
