import { NextResponse } from "next/server";
import { accessKeyFromRequest } from "@/lib/admin-auth";
import { findUserByAccessKey, databaseConfigured } from "@/lib/admin-db";
import { readGlobalUsageCounter } from "@/lib/global-usage";

export const runtime = "nodejs";
export const maxDuration = 30;

type CounterUsagePayload = {
  date: string;
  timezone: "UTC";
  configured: boolean;
  source: "counter" | "custom";
  providerName: string;
  quotaType: "count";
  usedUsd: number;
  limitUsd: number | null;
  remainingUsd: number | null;
  usedCount: number;
  limitCount: number;
  remainingCount: number;
  percent: number;
  averageCostUsd: number | null;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  requests: number;
  modelBreakdown: { model: string; requests: number; inputTokens: number; outputTokens: number }[];
  message: string;
};

function positiveIntegerFromEnv(...names: string[]) {
  for (const name of names) {
    const value = Number(process.env[name] || "");
    if (Number.isFinite(value) && value > 0) return Math.floor(value);
  }
  return null;
}

function stringFromEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function dailyGenerationLimit() {
  return positiveIntegerFromEnv(
    "AI_DAILY_GENERATION_LIMIT",
    "AI_DAILY_COUNT_LIMIT",
    "NEXT_PUBLIC_DAILY_GENERATION_LIMIT"
  ) || 100;
}

function usagePayload({
  date,
  source,
  providerName,
  usedCount,
  limitCount,
  message
}: {
  date: string;
  source: "counter" | "custom";
  providerName: string;
  usedCount: number;
  limitCount: number;
  message: string;
}): CounterUsagePayload {
  const remainingCount = Math.max(limitCount - usedCount, 0);
  const percent = limitCount > 0 ? Math.min(100, (usedCount / limitCount) * 100) : 0;

  return {
    date,
    timezone: "UTC",
    configured: true,
    source,
    providerName,
    usedUsd: 0,
    limitUsd: null,
    remainingUsd: null,
    quotaType: "count",
    usedCount,
    limitCount,
    remainingCount,
    percent,
    averageCostUsd: null,
    inputTokens: 0,
    cachedInputTokens: 0,
    outputTokens: 0,
    requests: usedCount,
    modelBreakdown: [],
    message
  };
}

export async function GET(request: Request) {
  const date = todayUtcDate();

  if (databaseConfigured()) {
    const accessKey = accessKeyFromRequest(request);
    const user = accessKey ? await findUserByAccessKey(accessKey) : null;

    if (!user) {
      return NextResponse.json({ error: "Invalid or inactive access key." }, { status: 401 });
    }

    const limitCount = user.creditLimit ?? 999999;
    return NextResponse.json(
      usagePayload({
        date,
        source: "custom",
        providerName: `${user.label} Credits`,
        usedCount: user.creditsUsed,
        limitCount,
        message:
          user.creditLimit === null
            ? "This user has unlimited text generation credits. Admin can still track credits used."
            : `This user's text-generation credits are controlled in the Supabase-backed Admin Panel.`
      }),
      { status: 200 }
    );
  }

  const providerName = stringFromEnv("AI_USAGE_PROVIDER_NAME") || "Global Daily Counter";
  const limitCount = dailyGenerationLimit();
  const state = await readGlobalUsageCounter(date);
  const usedCount = Math.max(0, Math.floor(state.count));

  return NextResponse.json(
    usagePayload({
      date,
      source: "counter",
      providerName,
      usedCount,
      limitCount,
      message: `Global daily counter is active. The app allows ${limitCount} successful AI lesson-plan generations per UTC day across this server.`
    }),
    { status: 200 }
  );
}
