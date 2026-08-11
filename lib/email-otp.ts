import crypto from "node:crypto";
import { createRequire } from "node:module";

const requireFromHere = createRequire(import.meta.url);

const DEFAULT_ALLOWED_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "msn.com",
  "yahoo.com",
  "ymail.com",
  "rocketmail.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "zoho.com",
  "aol.com",
  "mail.com",
  "gmx.com",
  "gmx.net"
];

const TEMPORARY_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "10minutemail.net",
  "guerrillamail.com",
  "guerrillamail.net",
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "yopmail.com",
  "sharklasers.com",
  "getairmail.com",
  "trashmail.com",
  "dispostable.com",
  "fakeinbox.com",
  "maildrop.cc",
  "moakt.com",
  "mintemail.com",
  "emailondeck.com"
]);

function envList(value: string | undefined) {
  return String(value || "")
    .split(/[;,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeAuthEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

export function emailDomain(email: string) {
  const normalized = normalizeAuthEmail(email);
  const domain = normalized.split("@")[1] || "";
  return domain.trim().toLowerCase();
}

export function isAllowedManualSignupEmail(email: string) {
  const domain = emailDomain(email);
  if (!domain || TEMPORARY_EMAIL_DOMAINS.has(domain)) return false;

  const allowedDomains = new Set([
    ...DEFAULT_ALLOWED_DOMAINS,
    ...envList(process.env.ALLOWED_SIGNUP_EMAIL_DOMAINS)
  ]);

  return allowedDomains.has(domain);
}

export function allowedManualSignupMessage() {
  return "Please use a major email provider such as Gmail, Outlook/Hotmail, Yahoo, iCloud, Proton, Zoho, AOL, Mail.com, or a domain added by the administrator.";
}

export function createOtpCode() {
  return crypto.randomInt(100000, 1000000).toString();
}

export function hashOtp(email: string, otp: string) {
  const secret = process.env.AUTH_OTP_SECRET || process.env.ILAW_ADMIN_KEY || "local-otp-secret";
  return crypto
    .createHmac("sha256", secret)
    .update(`${normalizeAuthEmail(email)}:${String(otp || "").trim()}`)
    .digest("hex");
}

export function maskEmail(email: string) {
  const normalized = normalizeAuthEmail(email);
  const [name, domain] = normalized.split("@");
  if (!name || !domain) return normalized;
  if (name.length <= 2) return `${name[0] || "*"}***@${domain}`;
  return `${name.slice(0, 2)}***${name.slice(-1)}@${domain}`;
}

export async function sendSignupOtpEmail(input: { to: string; name?: string; otp: string }) {
  const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || "";
  const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
  const user = (process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || "").trim();
  const rawPass = process.env.SMTP_PASSWORD || process.env.EMAIL_SERVER_PASSWORD || "";
  const pass = rawPass.replace(/\s+/g, "");
  const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || user || "").trim();
  const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

  const subject = "Your Classroom Design Suite verification code";
  const safeName = input.name?.trim() || "Teacher";
  const text = [
    `Hello ${safeName},`,
    "",
    `Your verification code is: ${input.otp}`,
    "",
    "This code expires in 10 minutes. If you did not request this account, you may ignore this email.",
    "",
    "Classroom Design Suite",
    "Lloydie Labs"
  ].join("\n");
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0f172a">
      <h2 style="margin:0 0 12px">Verify your account</h2>
      <p>Hello ${safeName},</p>
      <p>Use this verification code to finish creating your Classroom Design Suite account:</p>
      <div style="font-size:30px;font-weight:800;letter-spacing:8px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px;text-align:center;color:#1d4ed8">${input.otp}</div>
      <p style="color:#64748b">This code expires in 10 minutes. If you did not request this account, you may ignore this email.</p>
      <p style="color:#64748b">Classroom Design Suite<br/>Lloydie Labs</p>
    </div>`;

  if (!host || !from) {
    console.warn(`[AUTH OTP] SMTP is not configured. Verification code for ${input.to}: ${input.otp}`);
    return { delivered: false, message: "SMTP is not configured. The verification code was printed in the server terminal." };
  }

  if (!user || !pass || user.startsWith("your-") || /your-(email|gmail|app|password)/i.test(`${user} ${rawPass}`)) {
    throw new Error("Email OTP is not configured correctly. Set SMTP_USER to the real Gmail address and SMTP_PASSWORD to the Gmail App Password.");
  }

  let nodemailer: { createTransport: (options: Record<string, unknown>) => { sendMail: (message: Record<string, unknown>) => Promise<unknown> } };
  try {
    nodemailer = requireFromHere("nodemailer");
  } catch {
    throw new Error("Email sending is not available. Run npm install so nodemailer is installed.");
  }

  const transport = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });

  try {
    await transport.sendMail({ from, to: input.to, subject, text, html });
  } catch (error) {
    console.error("[AUTH OTP] SMTP send failed", error);
    const message = error instanceof Error ? error.message : String(error || "");
    if (/535|5\.7\.8|Username and Password not accepted|BadCredentials/i.test(message)) {
      throw new Error("Gmail rejected the SMTP login. Use the real Gmail address in SMTP_USER and a 16-character Gmail App Password in SMTP_PASSWORD, with spaces removed.");
    }
    throw new Error("Unable to send the verification email. Please check the SMTP settings and try again.");
  }
  return { delivered: true, message: `Verification code sent to ${maskEmail(input.to)}.` };
}
