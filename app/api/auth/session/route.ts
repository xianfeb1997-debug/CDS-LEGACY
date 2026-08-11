import { NextResponse } from "next/server";
import { accessKeyFromRequest } from "@/lib/admin-auth";
import { findUserByAccessKey } from "@/lib/admin-db";
import { clearAuthCookie, publicUser } from "@/lib/user-auth";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const accessKey = accessKeyFromRequest(request);
  if (!accessKey) return NextResponse.json({ authenticated: false });
  const user = await findUserByAccessKey(accessKey);
  if (!user) {
    const response = NextResponse.json({ authenticated: false });
    clearAuthCookie(response);
    return response;
  }
  return NextResponse.json({ authenticated: true, user: publicUser(user) });
}
