import { randomInt } from "crypto";
import { connectDB } from "@/lib/db";
import { ContactVerification } from "@/models/ContactVerification";
import { normalizeContact, isValidContact, type ContactType } from "@/lib/contact";
import { sendEmail, emailConfigured } from "@/lib/mailer";
import { sendSms, smsConfigured } from "@/lib/sms";
import { createProof, hashOtp } from "@/lib/verification-proof";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/audit";
import { ok, fail, handleRoute } from "@/lib/api";

const OTP_TTL_MS = 10 * 60_000;
const COOLDOWN_MS = 45_000;
const MAX_PER_HOUR = 5;

/** Send an OTP to a mobile/email — unless it is already verified, in which case say so. */
export const POST = handleRoute(async (req: Request) => {
  if (!rateLimit(`otp-ip:${clientIp(req) ?? "x"}`, 15, 60_000)) return fail("Too many requests. Try again shortly.", 429);

  const body = (await req.json().catch(() => ({}))) as { type?: string; contact?: string };
  const type = body.type === "EMAIL" ? "EMAIL" : body.type === "MOBILE" ? "MOBILE" : null;
  if (!type) return fail("Invalid contact type", 400);
  const contact = normalizeContact(type as ContactType, String(body.contact ?? ""));
  if (!isValidContact(type, contact)) {
    return fail(type === "MOBILE" ? "Enter a valid 10-digit mobile number" : "Enter a valid email address", 422);
  }

  await connectDB();
  let rec = await ContactVerification.findOne({ type, contact });
  if (rec?.verifiedAt) {
    return ok({ alreadyVerified: true, proof: createProof(type, contact) });
  }

  const now = Date.now();
  if (rec?.lastSentAt && now - rec.lastSentAt.getTime() < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - rec.lastSentAt.getTime())) / 1000);
    return fail(`Please wait ${wait}s before requesting another code.`, 429, { retryAfter: wait });
  }
  const windowFresh = rec?.windowStart && now - rec.windowStart.getTime() < 3_600_000;
  if (windowFresh && (rec?.sentCount ?? 0) >= MAX_PER_HOUR) {
    return fail("Too many codes requested. Try again in an hour.", 429);
  }

  const configured = type === "EMAIL" ? emailConfigured() : smsConfigured();
  if (!configured && process.env.NODE_ENV === "production") {
    return fail(`${type === "EMAIL" ? "Email" : "SMS"} service is not configured. Please use the other option.`, 503);
  }

  const code = String(randomInt(100000, 1000000));
  if (!rec) rec = new ContactVerification({ type, contact });
  rec.codeHash = hashOtp(type, contact, code);
  rec.expiresAt = new Date(now + OTP_TTL_MS);
  rec.attempts = 0;
  rec.lastSentAt = new Date(now);
  rec.sentCount = windowFresh ? rec.sentCount + 1 : 1;
  if (!windowFresh) rec.windowStart = new Date(now);
  await rec.save();

  try {
    if (!configured) {
      console.log(`[otp:dev] ${type} ${contact} → ${code}  (service not configured; dev only)`);
    } else if (type === "EMAIL") {
      await sendEmail(
        contact,
        "Your Exam Portal verification code",
        `Your verification code is ${code}. It is valid for 10 minutes. Do not share it with anyone.`,
        `<div style="font-family:system-ui,sans-serif"><p>Your Exam Portal verification code is</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p style="color:#666">Valid for 10 minutes. Do not share it with anyone.</p></div>`
      );
    } else {
      await sendSms(contact, `${code} is your Exam Portal verification code. Valid for 10 minutes. Do not share it.`);
    }
  } catch (err) {
    console.error("[otp] send failed", err);
    rec.lastSentAt = null; // let them retry immediately
    await rec.save();
    return fail(`Could not send the code to this ${type === "EMAIL" ? "email" : "number"}. Please try again.`, 502);
  }

  return ok({ sent: true, expiresInSec: OTP_TTL_MS / 1000, devMode: !configured || undefined });
});
