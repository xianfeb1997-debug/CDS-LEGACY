import { NextResponse } from "next/server";
import { activateAuthUserByEmail, createPendingAuthUser, findUserByEmail, getGlobalSettings } from "@/lib/admin-db";
import { decodeJwtPayload, setAuthCookie } from "@/lib/user-auth";

export const runtime = "nodejs";

function appOrigin(request: Request) {
  const url = new URL(request.url);
  return process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  for (const part of raw.split(";")) {
    const [cookieName, ...value] = part.trim().split("=");
    if (cookieName === name) return decodeURIComponent(value.join("="));
  }
  return "";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = cookieValue(request, "ilaw_google_state");

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?auth=google-failed", request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appOrigin(request)}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/?auth=google-not-configured", request.url));
  }

  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code"
      })
    });
    const tokenBody = await tokenResponse.json() as { id_token?: string; error_description?: string };
    if (!tokenResponse.ok || !tokenBody.id_token) {
      throw new Error(tokenBody.error_description || "Google sign-in failed.");
    }

    const profile = decodeJwtPayload(tokenBody.id_token);
    const email = String(profile.email || "").toLowerCase();
    const name = String(profile.name || profile.given_name || email || "Google user");
    const emailVerified = profile.email_verified === true || String(profile.email_verified || "").toLowerCase() === "true";
    if (!email) throw new Error("Google account did not return an email address.");
    if (!emailVerified) throw new Error("Google did not confirm this email as verified.");

    let user = await findUserByEmail(email, true);
    if (!user) {
      const settings = await getGlobalSettings();
      if (!settings.allowNewSignups) {
        return NextResponse.redirect(new URL("/?auth=signup-disabled", request.url));
      }
      user = await createPendingAuthUser({
        label: name,
        email,
        provider: "google",
        isActive: true,
        notes: "Verified by Google sign-in. Access activated automatically."
      });
    } else if (!user.isActive || user.authProvider !== "google") {
      user = await activateAuthUserByEmail(email, "google");
    }

    if (!user) {
      return NextResponse.redirect(new URL("/?auth=google-failed", request.url));
    }

    const response = NextResponse.redirect(new URL("/", request.url));
    setAuthCookie(response, user.accessKey);
    response.cookies.set({ name: "ilaw_google_state", value: "", httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
    return response;
  } catch (error) {
    console.error("Google auth callback failed", error);
    return NextResponse.redirect(new URL("/?auth=google-failed", request.url));
  }
}
