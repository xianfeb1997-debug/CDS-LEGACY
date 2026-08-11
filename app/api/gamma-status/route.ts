import { NextResponse } from "next/server";
import { accessKeyFromRequest } from "@/lib/admin-auth";
import { applyUserPptGammaUsage, findUserByAccessKey, databaseConfigured, pptCreditsRemaining, resolveGammaProviderForGeneration } from "@/lib/admin-db";
import { getGammaPresentationStatus } from "@/lib/gamma";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorStatus(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/api key|not configured|unauthorized|401/i.test(message)) return 401;
  if (/insufficient credits|402/i.test(message)) return 402;
  if (/rate limit|quota|429/i.test(message)) return 429;
  return 400;
}

async function applyUserPptCreditsToResult(request: Request, result: Awaited<ReturnType<typeof getGammaPresentationStatus>>) {
  if (!databaseConfigured()) return result;

  try {
    const accessKey = accessKeyFromRequest(request);
    if (!accessKey) return result;

    const user = await findUserByAccessKey(accessKey);
    if (!user) return result;

    const gammaCharge = await applyUserPptGammaUsage(user.id, result.generationId, result.credits);
    const updatedUser = gammaCharge.user || user;
    const remaining = pptCreditsRemaining(updatedUser);
    return {
      ...result,
      credits: typeof remaining === "number" ? { deducted: gammaCharge.applied, remaining } : undefined
    };
  } catch (error) {
    console.error("Unable to apply per-user PPT credits to status response:", error);
    return result;
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const generationId = url.searchParams.get("generationId") || "";
    const gammaProvider = await resolveGammaProviderForGeneration(generationId);
    const result = await getGammaPresentationStatus(generationId, gammaProvider);
    const userAwareResult = await applyUserPptCreditsToResult(request, result);
    return NextResponse.json(userAwareResult);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check PPT status." },
      { status: errorStatus(error) }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { generationId?: string };
    const generationId = body.generationId || "";
    const gammaProvider = await resolveGammaProviderForGeneration(generationId);
    const result = await getGammaPresentationStatus(generationId, gammaProvider);
    const userAwareResult = await applyUserPptCreditsToResult(request, result);
    return NextResponse.json(userAwareResult);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to check PPT status." },
      { status: errorStatus(error) }
    );
  }
}
