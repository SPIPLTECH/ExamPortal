/**
 * SMS via APITxT (https://apitxt.com).
 *
 * .env:
 *   API_TXT=<full SMS-send endpoint URL from your APITxT dashboard/docs>
 *   APITXT_AUTH_KEY=<auth key>
 *   APITXT_SENDER_ID=<DLT sender/header id>
 *   APITXT_TEMPLATE_ID=<DLT template id>      (optional)
 *   APITXT_ENTITY_ID=<DLT principal entity id> (optional)
 *   APITXT_METHOD=GET|POST                     (default GET)
 *
 * ⚠ APITxT's public docs were not accessible when this was written, so the request
 * shape below (authkey/mobile/sender/message/…) is the common Indian-gateway layout.
 * If APITxT uses different parameter names, change ONLY `buildParams()` below.
 */
export function smsConfigured(): boolean {
  return !!(process.env.API_TXT && process.env.APITXT_AUTH_KEY && process.env.APITXT_SENDER_ID);
}

function buildParams(mobile10: string, message: string): Record<string, string> {
  const p: Record<string, string> = {
    authkey: process.env.APITXT_AUTH_KEY!,
    mobile: `91${mobile10}`,
    sender: process.env.APITXT_SENDER_ID!,
    message,
  };
  if (process.env.APITXT_TEMPLATE_ID) p.template_id = process.env.APITXT_TEMPLATE_ID;
  if (process.env.APITXT_ENTITY_ID) p.entity_id = process.env.APITXT_ENTITY_ID;
  return p;
}

export async function sendSms(mobile10: string, message: string): Promise<void> {
  const url = process.env.API_TXT!;
  const params = buildParams(mobile10, message);
  const post = (process.env.APITXT_METHOD || "GET").toUpperCase() === "POST";
  const res = post
    ? await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params) })
    : await fetch(`${url}${url.includes("?") ? "&" : "?"}${new URLSearchParams(params)}`);
  const body = await res.text();
  if (!res.ok) throw new Error(`SMS gateway error ${res.status}: ${body.slice(0, 200)}`);
  if (process.env.NODE_ENV !== "production") console.log("[sms] gateway response:", body.slice(0, 200));
}
