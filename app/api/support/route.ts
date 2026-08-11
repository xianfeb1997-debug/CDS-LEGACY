import { NextResponse } from "next/server";
import { createRequire } from "node:module";
import { z } from "zod";

export const runtime = "nodejs";

const requireFromHere = createRequire(import.meta.url);

const SupportSchema = z.object({
  name: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email("Enter a valid email address."),
  subject: z.string().trim().min(3, "Enter a short subject.").max(160),
  message: z.string().trim().min(8, "Please enter a message.").max(5000),
  page: z.string().trim().max(500).optional().default("")
});

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: Request) {
  try {
    const input = SupportSchema.parse(await request.json());

    const host = process.env.SMTP_HOST || process.env.EMAIL_SERVER_HOST || "";
    const port = Number(process.env.SMTP_PORT || process.env.EMAIL_SERVER_PORT || 587);
    const user = (process.env.SMTP_USER || process.env.EMAIL_SERVER_USER || "").trim();
    const rawPass = process.env.SMTP_PASSWORD || process.env.EMAIL_SERVER_PASSWORD || "";
    const pass = rawPass.replace(/\s+/g, "");
    const from = (process.env.SMTP_FROM || process.env.EMAIL_FROM || user || "").trim();
    const to = (process.env.SUPPORT_EMAIL || "support@lloydielabs.site").trim();
    const secure = String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465;

    if (!host || !from || !to) {
      return NextResponse.json({ ok: false, message: "Support email is not configured. Please set SMTP settings and SUPPORT_EMAIL." }, { status: 400 });
    }

    if (!user || !pass || user.startsWith("your-") || /your-(email|gmail|app|password)/i.test(`${user} ${rawPass}`)) {
      return NextResponse.json({ ok: false, message: "Support email is not configured correctly. Set SMTP_USER to the real Gmail address and SMTP_PASSWORD to the Gmail App Password." }, { status: 400 });
    }

    let nodemailer: { createTransport: (options: Record<string, unknown>) => { sendMail: (message: Record<string, unknown>) => Promise<unknown> } };
    try {
      nodemailer = requireFromHere("nodemailer");
    } catch {
      return NextResponse.json({ ok: false, message: "Email sending is not available. Run npm install so nodemailer is installed." }, { status: 500 });
    }

    const subject = `[Classroom Design Suite] ${input.subject}`;
    const text = [
      `Name: ${input.name || "Not provided"}`,
      `Email: ${input.email}`,
      input.page ? `Page: ${input.page}` : "",
      "",
      input.message
    ].filter(Boolean).join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#0f172a">
        <h2 style="margin:0 0 12px">Classroom Design Suite Support</h2>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:16px;margin-bottom:18px">
          <p><strong>Name:</strong> ${escapeHtml(input.name || "Not provided")}</p>
          <p><strong>Email:</strong> ${escapeHtml(input.email)}</p>
          ${input.page ? `<p><strong>Page:</strong> ${escapeHtml(input.page)}</p>` : ""}
        </div>
        <h3 style="margin:0 0 10px">${escapeHtml(input.subject)}</h3>
        <p style="white-space:pre-wrap;line-height:1.6">${escapeHtml(input.message)}</p>
      </div>`;

    const transport = nodemailer.createTransport({ host, port, secure, auth: { user, pass } });

    await transport.sendMail({
      from,
      to,
      replyTo: input.email,
      subject,
      text,
      html
    });

    return NextResponse.json({ ok: true, message: "Support message sent. We will reply by email." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: error.issues[0]?.message || "Invalid support request." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to send support message.";
    if (/535|5\.7\.8|Username and Password not accepted|BadCredentials/i.test(message)) {
      return NextResponse.json({ ok: false, message: "Gmail rejected the SMTP login. Use your real Gmail address and a 16-character Gmail App Password with spaces removed." }, { status: 400 });
    }
    return NextResponse.json({ ok: false, message: "Unable to send support message. Please check SMTP settings." }, { status: 400 });
  }
}
