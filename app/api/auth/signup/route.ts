import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrActivateEmailAuthUser, findUserByEmail, getGlobalSettings, storeEmailOtp, verifyEmailOtp } from "@/lib/admin-db";
import { hashPassword, publicUser, setAuthCookie } from "@/lib/user-auth";
import {
  allowedManualSignupMessage,
  createOtpCode,
  hashOtp,
  isAllowedManualSignupEmail,
  maskEmail,
  normalizeAuthEmail,
  sendSignupOtpEmail
} from "@/lib/email-otp";

export const runtime = "nodejs";

const SignupSchema = z.object({
  name: z.string().trim().min(2, "Enter your full name."),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  otp: z.string().trim().optional().default("")
});

function otpExpiresAt() {
  return new Date(Date.now() + 10 * 60 * 1000).toISOString();
}

export async function POST(request: Request) {
  try {
    const input = SignupSchema.parse(await request.json());
    const settings = await getGlobalSettings();
    if (!settings.allowNewSignups) {
      return NextResponse.json({
        ok: false,
        message: "New account registration is currently closed. Please contact the administrator for access."
      }, { status: 403 });
    }

    const email = normalizeAuthEmail(input.email);

    if (!isAllowedManualSignupEmail(email)) {
      return NextResponse.json({
        ok: false,
        message: allowedManualSignupMessage()
      }, { status: 400 });
    }

    const existing = await findUserByEmail(email, true);
    if (existing?.isActive) {
      return NextResponse.json({
        ok: true,
        status: "active",
        message: "This email already has access. Please sign in."
      });
    }

    if (!input.otp) {
      const otp = createOtpCode();
      await storeEmailOtp({
        email,
        purpose: "signup",
        otpHash: hashOtp(email, otp),
        expiresAt: otpExpiresAt()
      });

      const delivery = await sendSignupOtpEmail({ to: email, name: input.name, otp });
      return NextResponse.json({
        ok: true,
        status: "otp_required",
        message: delivery.delivered
          ? `Verification code sent to ${maskEmail(email)}. Enter the 6-digit code to activate your account.`
          : `${delivery.message} Enter the 6-digit code to activate your account.`
      });
    }

    const verification = await verifyEmailOtp({
      email,
      purpose: "signup",
      otpHash: hashOtp(email, input.otp)
    });

    if (!verification.ok) {
      return NextResponse.json({ ok: false, message: verification.message }, { status: 400 });
    }

    const user = await createOrActivateEmailAuthUser({
      label: input.name,
      email,
      passwordHash: hashPassword(input.password)
    });

    if (!user) throw new Error("Unable to activate account.");

    const response = NextResponse.json({
      ok: true,
      status: "active",
      message: "Email verified. Your account is now active.",
      user: publicUser(user)
    });
    setAuthCookie(response, user.accessKey);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: error.issues[0]?.message || "Invalid signup details." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to create account.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
