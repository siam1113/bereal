import { Resend } from "resend";

interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text: string;
}

const resendApiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM || "Proverse <no-reply@proverse.app>";
const resend = resendApiKey ? new Resend(resendApiKey) : null;

/**
 * Dev fallback when RESEND_API_KEY is unset: logs the email instead of sending it, so
 * local auth flows (verify email, reset password) stay usable without a provider key.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  if (!resend) {
    console.log(
      `[mail:dev] to=${input.to} subject="${input.subject}"\n${input.text}`,
    );
    return;
  }
  await resend.emails.send({ from, to: input.to, subject: input.subject, html: input.html, text: input.text });
}

export function verificationEmail(url: string) {
  return {
    subject: "Verify your Proverse account",
    text: `Welcome to Proverse. Verify your email: ${url}`,
    html: `<p>Welcome to Proverse.</p><p><a href="${url}">Verify your email</a></p>`,
  };
}

export function passwordResetEmail(url: string) {
  return {
    subject: "Reset your Proverse password",
    text: `Reset your password: ${url}`,
    html: `<p><a href="${url}">Reset your password</a></p><p>If you didn't request this, ignore this email.</p>`,
  };
}
