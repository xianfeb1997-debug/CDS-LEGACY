import crypto from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function appOrigin(request: Request) {
  const url = new URL(request.url);
  return process.env.NEXT_PUBLIC_APP_URL || `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID || "";
  if (!clientId) {
    return NextResponse.redirect(new URL("/?auth=google-not-configured", request.url));
  }

  const state = crypto.randomBytes(16).toString("hex");
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || `${appOrigin(request)}/api/auth/google/callback`;
  const authUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid email profile");
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("prompt", "select_account");

  const response = NextResponse.redirect(authUrl);
  response.cookies.set({ name: "ilaw_google_state", value: state, httpOnly: true, sameSite: "lax", path: "/", maxAge: 600 });
  return response;
}
