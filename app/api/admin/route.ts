import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createGammaApiKey,
  createTextApiKey,
  createUserKey,
  deleteGammaApiKey,
  deleteTextApiKey,
  deleteUserKey,
  listAdminData,
  databaseConfigured,
  isDatabaseUnavailableError,
  resetUserCredits,
  GammaApiKeyInputSchema,
  GlobalSettingsInputSchema,
  TextApiKeyInputSchema,
  updateGammaApiKey,
  updateGlobalSettings,
  updateTextApiKey,
  updateUserKey,
  UserKeyInputSchema
} from "@/lib/admin-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const ActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create-user"), payload: UserKeyInputSchema }),
  z.object({ action: z.literal("update-user"), id: z.number().int().positive(), payload: UserKeyInputSchema }),
  z.object({ action: z.literal("delete-user"), id: z.number().int().positive() }),
  z.object({ action: z.literal("reset-user-credits"), id: z.number().int().positive() }),
  z.object({ action: z.literal("create-api-key"), payload: TextApiKeyInputSchema }),
  z.object({ action: z.literal("update-api-key"), id: z.number().int().positive(), payload: TextApiKeyInputSchema }),
  z.object({ action: z.literal("delete-api-key"), id: z.number().int().positive() }),
  z.object({ action: z.literal("create-gamma-key"), payload: GammaApiKeyInputSchema }),
  z.object({ action: z.literal("update-gamma-key"), id: z.number().int().positive(), payload: GammaApiKeyInputSchema }),
  z.object({ action: z.literal("delete-gamma-key"), id: z.number().int().positive() }),
  z.object({ action: z.literal("update-settings"), payload: GlobalSettingsInputSchema })
]);

function adminErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : "Admin request failed.";
  if (/Supabase database is not configured/i.test(message)) {
    return "Supabase is not configured. Set SUPABASE_DATABASE_URL to your Supabase Transaction pooler connection string.";
  }
  if (/Supabase schema is missing/i.test(message)) {
    return "Supabase tables are missing. Run database/supabase_schema.sql in the Supabase SQL Editor.";
  }
  return message;
}

function errorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "Invalid admin request." }, { status: 400 });
  }

  console.error("Admin API failed:", error);
  const message = adminErrorMessage(error);
  const status = /duplicate|unique/i.test(message)
    ? 409
    : isDatabaseUnavailableError(error)
      ? 503
      : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  if (!databaseConfigured()) {
    return NextResponse.json(
      {
        configured: false,
        users: [],
        textApiKeys: [],
        gammaApiKeys: [],
        settings: {
          lasHeaderDivision: "",
          lasHeaderSchoolName: "",
          gammaApiBaseUrl: "https://public-api.gamma.app/v1.0",
          defaultLessonCreditLimit: 100,
          defaultPptCreditLimit: 20,
          allowNewSignups: true,
          maintenanceModeEnabled: false,
          maintenanceUntil: "",
          maintenanceMessage: "We are improving Classroom Design Suite. Please check back soon."
        },
        stats: { totalUsers: 0, activeUsers: 0, totalCreditsUsed: 0, totalTextCreditsUsed: 0, totalPptCreditsUsed: 0, activeApiKeys: 0, activeGammaApiKeys: 0 },
        message: "Supabase is not configured. Set SUPABASE_DATABASE_URL in .env.local or in Vercel Environment Variables."
      },
      { status: 200 }
    );
  }

  try {
    return NextResponse.json(await listAdminData());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const body = ActionSchema.parse(await request.json());

    switch (body.action) {
      case "create-user":
        await createUserKey(body.payload);
        break;
      case "update-user":
        await updateUserKey(body.id, body.payload);
        break;
      case "delete-user":
        await deleteUserKey(body.id);
        break;
      case "reset-user-credits":
        await resetUserCredits(body.id);
        break;
      case "create-api-key":
        await createTextApiKey(body.payload);
        break;
      case "update-api-key":
        await updateTextApiKey(body.id, body.payload);
        break;
      case "delete-api-key":
        await deleteTextApiKey(body.id);
        break;
      case "create-gamma-key":
        await createGammaApiKey(body.payload);
        break;
      case "update-gamma-key":
        await updateGammaApiKey(body.id, body.payload);
        break;
      case "delete-gamma-key":
        await deleteGammaApiKey(body.id);
        break;
      case "update-settings":
        await updateGlobalSettings(body.payload);
        break;
    }

    return NextResponse.json(await listAdminData());
  } catch (error) {
    return errorResponse(error);
  }
}
