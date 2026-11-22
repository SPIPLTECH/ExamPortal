import nodemailer from "nodemailer";

/** Gmail SMTP with an App Password: SMTP_USER=you@gmail.com, SMTP_PASS=<16-char app password>. */
export function emailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendEmail(to: string, subject: string, text: string, html?: string): Promise<void> {
  const port = Number(process.env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  await transport.sendMail({
    from: process.env.SMTP_FROM || `"Exam Portal" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
