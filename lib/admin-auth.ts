import { NextResponse } from "next/server";
import { AUTH_COOKIE_NAME } from "./user-auth";

export function configuredAdminKey() {
  return (
    process.env.ILAW_ADMIN_KEY ||
    process.env.ADMIN_PANEL_KEY ||
    process.env.ADMIN_KEY ||
    (process.env.NODE_ENV === "production" ? "" : "local-admin")
  ).trim();
}

export function readAdminToken(request: Request) {
  const header = request.headers.get("x-admin-token") || request.headers.get("authorization") || "";
  return header.replace(/^Bearer\s+/i, "").trim();
}

export function requireAdmin(request: Request) {
  const expected = configuredAdminKey();
  if (!expected) {
    return NextResponse.json(
      { error: "Admin panel key is not configured. Set ILAW_ADMIN_KEY in .env.local." },
      { status: 503 }
    );
  }

  const received = readAdminToken(request);
  if (!received || received !== expected) {
    return NextResponse.json({ error: "Invalid admin key." }, { status: 401 });
  }

  return null;
}

function cookieValue(request: Request, name: string) {
  const raw = request.headers.get("cookie") || "";
  const cookies = raw.split(";").map((part) => part.trim()).filter(Boolean);
  for (const cookie of cookies) {
    const index = cookie.indexOf("=");
    if (index === -1) continue;
    const cookieName = cookie.slice(0, index).trim();
    if (cookieName === name) return decodeURIComponent(cookie.slice(index + 1));
  }
  return "";
}

export function accessKeyFromRequest(request: Request) {
  return (
    request.headers.get("x-ilaw-access-key") ||
    request.headers.get("x-access-key") ||
    cookieValue(request, AUTH_COOKIE_NAME) ||
    ""
  ).trim();
}
