import { NextResponse } from "next/server";
import { z } from "zod";
import { findUserByEmail, getUserPasswordHashByEmail } from "@/lib/admin-db";
import { publicUser, setAuthCookie, verifyPassword } from "@/lib/user-auth";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.")
});

export async function POST(request: Request) {
  try {
    const input = LoginSchema.parse(await request.json());
    const user = await findUserByEmail(input.email, true);
    const passwordHash = await getUserPasswordHashByEmail(input.email);

    if (!user || !passwordHash || !verifyPassword(input.password, passwordHash)) {
      return NextResponse.json({ ok: false, message: "Invalid email or password." }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json({ ok: false, status: "pending", message: "Your account is not active yet. Please verify your email or contact support." }, { status: 403 });
    }

    const response = NextResponse.json({ ok: true, user: publicUser(user) });
    setAuthCookie(response, user.accessKey);
    return response;
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, message: error.issues[0]?.message || "Invalid login details." }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Unable to sign in.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }
}
