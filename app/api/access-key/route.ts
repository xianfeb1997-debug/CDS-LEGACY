import { NextResponse } from "next/server";
import { findUserByAccessKey, databaseConfigured, isDatabaseUnavailableError } from "@/lib/admin-db";

export const runtime = "nodejs";

function configuredKeys() {
  const raw = process.env.ILAW_ACCESS_KEYS || process.env.APP_ACCESS_KEYS || process.env.ILAW_ACCESS_KEY || "";
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function databaseLoginErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "Unknown database error");
  if (/Supabase database is not configured/i.test(message)) {
    return "Set SUPABASE_DATABASE_URL to the Supabase Transaction pooler connection string.";
  }
  if (/Supabase schema is missing/i.test(message)) {
    return "Run database/supabase_schema.sql in the Supabase SQL Editor.";
  }
  return message;
}

function localFallbackLogin(accessKey: string, reason?: string) {
  const allowedKeys = configuredKeys();

  if (allowedKeys.length > 0) {
    if (!allowedKeys.includes(accessKey)) {
      return NextResponse.json({ ok: false, message: "Invalid access key." }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      label: "Authorized user",
      message: reason ? `Access granted using .env access keys. ${reason}` : undefined
    });
  }

  // Development fallback: if no access keys are configured yet, allow any
  // non-empty key so the UI can be tested locally. Set ILAW_ACCESS_KEYS or
  // Supabase user keys in production to enforce real access control.
  if (process.env.NODE_ENV !== "production") {
    return NextResponse.json({
      ok: true,
      label: "Development access",
      message: reason
        ? `Access granted in local development mode. ${reason}`
        : "Access granted. Configure ILAW_ACCESS_KEYS or Supabase user keys before production use."
    });
  }

  return null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { accessKey?: string };
    const accessKey = (body.accessKey || "").trim();

    if (!accessKey) {
      return NextResponse.json({ ok: false, message: "Enter an access key." }, { status: 400 });
    }

    if (databaseConfigured()) {
      try {
        const user = await findUserByAccessKey(accessKey);
        if (!user) {
          return NextResponse.json({ ok: false, message: "Invalid or inactive access key." }, { status: 401 });
        }

        const remaining = user.creditLimit === null ? null : Math.max(0, user.creditLimit - user.creditsUsed);
        const pptRemaining = user.pptCreditLimit === null ? null : Math.max(0, user.pptCreditLimit - user.pptCreditsUsed);
        return NextResponse.json({
          ok: true,
          label: user.label,
          creditLimit: user.creditLimit,
          creditsUsed: user.creditsUsed,
          creditsRemaining: remaining,
          pptCreditLimit: user.pptCreditLimit,
          pptCreditsUsed: user.pptCreditsUsed,
          pptCreditsRemaining: pptRemaining,
          apiKeyMode: user.textApiKey ? "dedicated" : "global-rotation"
        });
      } catch (databaseError) {
        const message = databaseLoginErrorMessage(databaseError);
        console.error("Access key database login failed:", databaseError);

        if (isDatabaseUnavailableError(databaseError)) {
          const fallback = localFallbackLogin(accessKey, `Database login is currently unavailable: ${message}`);
          if (fallback) return fallback;
          return NextResponse.json({ ok: false, message: `Database login is currently unavailable. ${message}` }, { status: 503 });
        }

        return NextResponse.json({ ok: false, message }, { status: 500 });
      }
    }

    const fallback = localFallbackLogin(accessKey);
    if (fallback) return fallback;

    return NextResponse.json({ ok: false, message: "Access keys are not configured." }, { status: 503 });
  } catch (error) {
    console.error("Access key route failed:", error);
    return NextResponse.json({ ok: false, message: "Unable to verify access key." }, { status: 500 });
  }
}
