import { NextResponse } from "next/server";
import { getGlobalSettings } from "@/lib/admin-db";

export const runtime = "nodejs";

function maintenanceActive(enabled: boolean, until: string) {
  if (!enabled) return false;
  const trimmed = until.trim();
  if (!trimmed) return true;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return true;
  return date.getTime() > Date.now();
}

export async function GET() {
  try {
    const settings = await getGlobalSettings();
    return NextResponse.json({
      allowNewSignups: settings.allowNewSignups,
      maintenance: {
        enabled: maintenanceActive(settings.maintenanceModeEnabled, settings.maintenanceUntil),
        until: settings.maintenanceUntil,
        message: settings.maintenanceMessage
      }
    });
  } catch {
    return NextResponse.json({
      allowNewSignups: true,
      maintenance: {
        enabled: false,
        until: "",
        message: ""
      }
    });
  }
}
