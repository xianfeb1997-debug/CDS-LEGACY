import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin-auth";
import {
  AdminBackupRestoreSchema,
  exportAdminBackupCsv,
  importAdminBackup,
  importAdminBackupCsv,
  listAdminData
} from "@/lib/admin-db";

export const runtime = "nodejs";
export const maxDuration = 60;

const CsvRestoreSchema = z.object({
  mode: z.enum(["merge", "replace"]).optional().default("merge"),
  csv: z.string().min(1, "CSV backup file is empty.")
});

function backupErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: error.issues[0]?.message || "Invalid backup file." }, { status: 400 });
  }

  console.error("Admin backup API failed:", error);
  const message = error instanceof Error ? error.message : "Backup request failed.";
  const status = /Supabase database is not configured|Supabase schema is missing|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|password authentication failed/i.test(message) ? 503 : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const csv = await exportAdminBackupCsv();
    const safeDate = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
    return new NextResponse(`\uFEFF${csv}`, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="classroom-design-suite-admin-backup-${safeDate}.csv"`,
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff"
      }
    });
  } catch (error) {
    return backupErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (auth) return auth;

  try {
    const rawBody = await request.json();
    const result = typeof rawBody?.csv === "string"
      ? await importAdminBackupCsv(CsvRestoreSchema.parse(rawBody))
      : await importAdminBackup(AdminBackupRestoreSchema.parse(rawBody));
    const data = await listAdminData();
    return NextResponse.json({ ...data, backupRestore: result });
  } catch (error) {
    return backupErrorResponse(error);
  }
}
