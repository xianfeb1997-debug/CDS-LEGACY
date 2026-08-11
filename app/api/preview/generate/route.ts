import { NextResponse } from "next/server";
import { z } from "zod";
import { buildFileName, packDocx } from "@/lib/docx";
import { generatePreviewLesson } from "@/lib/lesson-preview";
import { LessonInputSchema } from "@/lib/schemas";
import { incrementGlobalUsageCounter, readGlobalUsageCounter } from "@/lib/global-usage";
import { chargeUserTextCredit, resolveGenerationProvider } from "@/lib/generation-auth";

export const runtime = "nodejs";
export const maxDuration = 300;

const PreviewInputSchema = LessonInputSchema.extend({
  reasoningEffort: z.enum(["low", "medium", "high"]).optional().default("medium")
});

function dailyGenerationLimit() {
  const raw = process.env.AI_DAILY_GENERATION_LIMIT || process.env.AI_DAILY_COUNT_LIMIT || "100";
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 100;
}

function counterEnabled() {
  return (process.env.AI_USAGE_PROVIDER || "counter").toLowerCase() !== "off";
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
  try {
    const payload = PreviewInputSchema.parse(await request.json());
    const provider = await resolveGenerationProvider(request);

    if (counterEnabled()) {
      const state = await readGlobalUsageCounter();
      const limit = dailyGenerationLimit();
      if (state.count >= limit) {
        return NextResponse.json(
          { error: `Daily global AI generation limit reached (${limit}/${limit}). Please try again tomorrow.` },
          { status: 429 }
        );
      }
    }

    const result = await generatePreviewLesson(payload, provider);
    const buffer = await packDocx(payload, result.lesson);
    const filename = buildFileName(payload, result.lesson);

    await chargeUserTextCredit(provider);
    if (counterEnabled()) await incrementGlobalUsageCounter();

    return NextResponse.json({
      filename,
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      docxBase64: buffer.toString("base64"),
      lesson: result.lesson,
      model: result.model,
      usedAI: result.usedAI,
      reasoningEffort: result.reasoningEffort,
      previewPlanner: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to generate the preview lesson plan.";
    console.error("Preview lesson generation failed", { error: message });
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}
