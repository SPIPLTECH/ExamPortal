/**
 * SMS OTP via APITxT (https://apitxt.com).
 *
 * .env:
 *   API_TXT=<your APITxT auth key>      ← the KEY itself, not a URL
 *
 * APITxT sends the OTP through the template configured in your APITxT account
 * (it injects the `otp` we pass into the template's {otp} placeholder), so we
 * pull the 4–8 digit code out of the message our routes build.
 */
const BASE = "https://apitxt.com/api";

export function smsConfigured(): boolean {
  return !!process.env.API_TXT;
}

/** 10-digit Indian number → 91XXXXXXXXXX (other lengths are passed through). */
function toFullNumber(phone: string, country = "91"): string {
  const digits = String(phone).replace(/\D/g, "");
  return digits.length === 10 ? `${country}${digits}` : digits;
}

export async function sendSms(mobile10: string, message: string): Promise<void> {
  const authkey = process.env.API_TXT;
  if (!authkey) throw new Error("API_TXT is missing in .env");

  const otp = String(message).match(/\d{4,8}/)?.[0];
  if (!otp) throw new Error("Could not find the OTP digits in the SMS message");

  const params = new URLSearchParams({
    authkey,
    mobile: toFullNumber(mobile10),
    otp,
    channel: "sms",
  });

  const res = await fetch(`${BASE}/sendOTP?${params.toString()}`);
  const text = await res.text();
  let data: { status?: string; message?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    /* non-JSON response handled below */
  }
  if (!res.ok || data.status !== "success") {
    throw new Error(data.message || `APITxT error ${res.status}: ${text.slice(0, 200)}`);
  }
  if (process.env.NODE_ENV !== "production") console.log("[sms] APITxT:", text.slice(0, 200));
}