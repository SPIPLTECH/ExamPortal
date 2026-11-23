import { emailConfigured, sendEmail } from "./mailer";

const APP_NAME = "Exam Portal";

/** Add N whole months to a date (clamping day-of-month as JS Date does). */
export function addMonths(from: Date, months: number): Date {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}

function credentialsHtml(opts: {
  heading: string;
  intro: string;
  username: string;
  password: string;
  loginUrl: string;
  note?: string;
}): string {
  const { heading, intro, username, password, loginUrl, note } = opts;
  return `
  <div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:auto;color:#0f172a">
    <h2 style="margin:0 0 8px">${heading}</h2>
    <p style="margin:0 0 16px;color:#334155">${intro}</p>
    <table style="border-collapse:collapse;margin:0 0 16px">
      <tr><td style="padding:6px 16px 6px 0;color:#64748b">Username</td><td style="padding:6px 0;font-weight:600">${username}</td></tr>
      <tr><td style="padding:6px 16px 6px 0;color:#64748b">Password</td><td style="padding:6px 0;font-weight:600">${password}</td></tr>
    </table>
    <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Log in</a>
    ${note ? `<p style="margin:16px 0 0;color:#64748b;font-size:13px">${note}</p>` : ""}
    <p style="margin:20px 0 0;color:#94a3b8;font-size:12px">${APP_NAME}</p>
  </div>`;
}

/** Send a center login's credentials to the center and owner mailboxes. Best-effort. */
export async function sendCenterCredentials(opts: {
  centerName: string;
  recipients: string[];
  username: string;
  password: string;
  loginUrl: string;
  expiresAt: Date;
}): Promise<boolean> {
  const to = Array.from(new Set(opts.recipients.filter(Boolean)));
  if (!emailConfigured() || to.length === 0) return false;
  const text = `Your ${APP_NAME} center login for "${opts.centerName}"\n\nUsername: ${opts.username}\nPassword: ${opts.password}\n\nLog in: ${opts.loginUrl}\nThis login is valid until ${opts.expiresAt.toDateString()}.`;
  const html = credentialsHtml({
    heading: `Your ${APP_NAME} center login`,
    intro: `A center account has been created for <b>${opts.centerName}</b>. Use the credentials below to sign in.`,
    username: opts.username,
    password: opts.password,
    loginUrl: opts.loginUrl,
    note: `This login is valid until <b>${opts.expiresAt.toDateString()}</b>.`,
  });
  await Promise.allSettled(to.map((r) => sendEmail(r, `Your ${APP_NAME} center login`, text, html)));
  return true;
}

/** Send a student their self-chosen credentials right after registration. Best-effort. */
export async function sendStudentCredentials(opts: {
  name: string;
  to: string;
  username: string;
  password: string;
  loginUrl: string;
  className: string;
}): Promise<boolean> {
  if (!emailConfigured() || !opts.to) return false;
  const text = `Hi ${opts.name},\n\nYou have successfully registered for the ${opts.className} exam.\n\nUsername: ${opts.username}\nPassword: ${opts.password}\n\nLog in anytime: ${opts.loginUrl}`;
  const html = credentialsHtml({
    heading: `You're registered for ${opts.className}`,
    intro: `Hi ${opts.name}, your registration is complete. Keep these credentials to log in and take your exam.`,
    username: opts.username,
    password: opts.password,
    loginUrl: opts.loginUrl,
    note: "You can log in and take the exam whenever you're ready.",
  });
  await sendEmail(opts.to, `Your ${APP_NAME} login — ${opts.className}`, text, html);
  return true;
}
