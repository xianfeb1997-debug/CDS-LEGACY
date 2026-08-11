import { NextResponse } from "next/server";
import { generateLesson } from "@/lib/ai";
import {
  applyUserPptGammaUsage,
  assertUserPptCreditsAvailable,
  pptCreditsRemaining,
  rememberGammaGenerationKey,
  requireActiveUserForAccessKey,
  resolveGammaProvider
} from "@/lib/admin-db";
import { generateGammaPresentation } from "@/lib/gamma";
import { GeneratedLessonSchema, LessonInputSchema } from "@/lib/schemas";
import { accessKeyFromRequest } from "@/lib/admin-auth";
import { chargeUserTextCredit, resolveGenerationProvider } from "@/lib/generation-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const PayloadSchema = LessonInputSchema.extend({
  lesson: GeneratedLessonSchema.optional()
});

function errorStatus(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (Number.isFinite(status) && status >= 400 && status < 600) return status;

  const message = error instanceof Error ? error.message : String(error || "");
  if (/api key|not configured|unauthorized|401|invalid or inactive access key/i.test(message)) return 401;
  if (/insufficient credits|402/i.test(message)) return 402;
  if (/credit limit|rate limit|quota|429/i.test(message)) return 429;
  return 400;
}

export async function POST(request: Request) {
  try {
    const payload = PayloadSchema.parse(await request.json());
    const textProvider = payload.lesson ? null : await resolveGenerationProvider(request);
    const user = textProvider?.user || await requireActiveUserForAccessKey(accessKeyFromRequest(request));

    assertUserPptCreditsAvailable(user);

    const generated = payload.lesson ? null : await generateLesson(payload, textProvider!);
    const lesson = payload.lesson || generated!.lesson;

    if (generated?.usedAI && textProvider) {
      await chargeUserTextCredit(textProvider);
    }

    const gammaProvider = await resolveGammaProvider();
    const result = await generateGammaPresentation(payload, lesson, gammaProvider);
    await rememberGammaGenerationKey(result.generationId, gammaProvider.gammaKeyId);

    if (user) {
      const gammaCharge = await applyUserPptGammaUsage(user.id, result.generationId, result.credits);
      const updatedUser = gammaCharge.user || user;
      const remaining = pptCreditsRemaining(updatedUser);

      return NextResponse.json({
        ...result,
        credits: {
          deducted: gammaCharge.applied,
          ...(typeof remaining === "number" ? { remaining } : {})
        }
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate PPT." },
      { status: errorStatus(error) }
    );
  }
}
