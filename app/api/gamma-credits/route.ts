import { NextResponse } from "next/server";
import { accessKeyFromRequest } from "@/lib/admin-auth";
import { findUserByAccessKey, databaseConfigured, isDatabaseUnavailableError, pptCreditsRemaining } from "@/lib/admin-db";
import { readGammaCreditState } from "@/lib/gamma-credits";

export const runtime = "nodejs";
export const maxDuration = 30;


export async function GET(request: Request) {
  if (databaseConfigured()) {
    try {
      const accessKey = accessKeyFromRequest(request);
      const user = accessKey ? await findUserByAccessKey(accessKey) : null;

      if (!user) {
        return NextResponse.json({ error: "Invalid or inactive access key." }, { status: 401 });
      }

      const remaining = pptCreditsRemaining(user);
      return NextResponse.json(
        {
          configured: true,
          source: "custom",
          remaining,
          used: user.pptCreditsUsed,
          limit: user.pptCreditLimit,
          lastDeducted: null,
          updatedAt: user.updatedAt,
          message:
            user.pptCreditLimit === null
              ? "This user has unlimited PPT Generator credits. Admin can still track PPT usage."
              : "This user's PPT Generator credits are controlled in the Supabase-backed Admin Panel."
        },
        { status: 200 }
      );
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }
      console.error("PPT user credit lookup failed. Falling back to the configured PPT credit state:", error);
    }
  }

  const state = await readGammaCreditState();
  return NextResponse.json(state, { status: 200 });
}
