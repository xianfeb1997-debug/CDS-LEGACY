import { NextResponse } from "next/server";
import { generateLesson } from "@/lib/ai";
import { buildLASFileName, generateLAS, packLASDocx } from "@/lib/las";
import { GeneratedLessonSchema, LessonInputSchema } from "@/lib/schemas";
import { incrementGlobalUsageCounter, readGlobalUsageCounter } from "@/lib/global-usage";
import { chargeUserTextCredit, resolveGenerationProvider } from "@/lib/generation-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const PayloadSchema = LessonInputSchema.extend({
  lesson: GeneratedLessonSchema.optional()
});

function dailyGenerationLimit() {
  const raw = process.env.AI_DAILY_GENERATION_LIMIT || process.env.AI_DAILY_COUNT_LIMIT || "100";
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 100;
}

function counterEnabled() {
  return (process.env.AI_USAGE_PROVIDER || "counter").toLowerCase() !== "off";
}

function lasDebugEnabled() {
  return (process.env.ADMIN_API_DEBUG || process.env.ILAW_API_DEBUG || "").toLowerCase() === "true";
}

function providerDebug(provider: { source?: string; globalKeyId?: number | null; model?: string; baseURL?: string } | null) {
  if (!provider) return null;
  return {
    source: provider.source || "env",
    globalKeyId: provider.globalKeyId ?? null,
    model: provider.model || null,
    baseURL: provider.baseURL || null
  };
}

function errorStatus(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status?: unknown }).status)
      : NaN;

  if (Number.isFinite(status) && status >= 400 && status < 600) return status;

  const message = error instanceof Error ? error.message : String(error || "");
  if (/429|rate limit|quota|daily global/i.test(message)) return 429;
  if (/api key|not configured|unauthorized|401/i.test(message)) return 401;
  return 400;
}

export async function POST(request: Request) {
  let provider: Awaited<ReturnType<typeof resolveGenerationProvider>> | null = null;

  try {
    const payload = PayloadSchema.parse(await request.json());
    provider = await resolveGenerationProvider(request);

    if (lasDebugEnabled()) {
      console.log("/api/generate-las resolved provider", providerDebug(provider));
    }

    if (!payload.lesson && counterEnabled()) {
      const state = await readGlobalUsageCounter();
      const limit = dailyGenerationLimit();
      if (state.count >= limit) {
        return NextResponse.json(
          { error: `Daily global AI generation limit reached (${limit}/${limit}). Please try again tomorrow.` },
          { status: 429 }
        );
      }
    }

    const generated = payload.lesson ? null : await generateLesson(payload, provider);
    const lesson = payload.lesson || generated!.lesson;

    // Important: LAS must use the same resolved Admin/API-key provider as Lesson Plan generation.
    // This keeps per-user dedicated keys and global rotating keys working for LAS too.
    const las = await generateLAS(payload, lesson, provider);
    const buffer = await packLASDocx(las);
    const filename = buildLASFileName(payload, las);

    // LAS is an AI text generation request, so count the user credit after a successful LAS output.
    // Global rotating-key use_count is already advanced when the key is selected, including failed attempts,
    // so a bad key will not keep being selected repeatedly.
    await chargeUserTextCredit(provider);
    if (counterEnabled()) {
      await incrementGlobalUsageCounter();
    }

    return NextResponse.json({
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docxBase64: buffer.toString("base64"),
      las
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate LAS.";
    const body = lasDebugEnabled()
      ? { error: message, provider: providerDebug(provider) }
      : { error: message };

    console.error("LAS API failed", {
      error: message,
      provider: providerDebug(provider)
    });

    return NextResponse.json(body, { status: errorStatus(error) });
  }
}
