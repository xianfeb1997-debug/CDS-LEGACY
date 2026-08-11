import { databaseConfigured, ensureAdminSchema, getDatabaseClient } from "./admin-db";

export type GlobalUsageState = {
  date: string;
  count: number;
  updatedAt: string;
};

const memoryUsage = new Map<string, GlobalUsageState>();

export function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function memoryState(date: string) {
  const current = memoryUsage.get(date);
  if (current) return current;
  const fresh = { date, count: 0, updatedAt: new Date().toISOString() };
  memoryUsage.set(date, fresh);
  return fresh;
}

function mapUsageRow(row: Record<string, unknown>): GlobalUsageState {
  const updatedAt = row.updated_at instanceof Date ? row.updated_at.toISOString() : String(row.updated_at || new Date().toISOString());
  return {
    date: String(row.date || row.usage_date || todayUtcDate()),
    count: Math.max(0, Math.floor(Number(row.count || 0))),
    updatedAt
  };
}

export async function readGlobalUsageCounter(date = todayUtcDate()) {
  if (!databaseConfigured()) return memoryState(date);

  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const rows = await sql`
    insert into ilaw_global_usage (usage_date, count, updated_at)
    values (${date}::date, 0, now())
    on conflict (usage_date) do update set usage_date = excluded.usage_date
    returning usage_date::text as date, count, updated_at
  `;
  return mapUsageRow(rows[0] as Record<string, unknown>);
}

export async function incrementGlobalUsageCounter(date = todayUtcDate()) {
  if (!databaseConfigured()) {
    const current = memoryState(date);
    const next = { date, count: current.count + 1, updatedAt: new Date().toISOString() };
    memoryUsage.set(date, next);
    return next;
  }

  await ensureAdminSchema();
  const rows = await getDatabaseClient()`
    insert into ilaw_global_usage (usage_date, count, updated_at)
    values (${date}::date, 1, now())
    on conflict (usage_date) do update
      set count = ilaw_global_usage.count + 1,
          updated_at = now()
    returning usage_date::text as date, count, updated_at
  `;
  return mapUsageRow(rows[0] as Record<string, unknown>);
}

export async function resetGlobalUsageCounter(date = todayUtcDate()) {
  if (!databaseConfigured()) {
    const next = { date, count: 0, updatedAt: new Date().toISOString() };
    memoryUsage.set(date, next);
    return next;
  }

  await ensureAdminSchema();
  const rows = await getDatabaseClient()`
    insert into ilaw_global_usage (usage_date, count, updated_at)
    values (${date}::date, 0, now())
    on conflict (usage_date) do update
      set count = 0,
          updated_at = now()
    returning usage_date::text as date, count, updated_at
  `;
  return mapUsageRow(rows[0] as Record<string, unknown>);
}
