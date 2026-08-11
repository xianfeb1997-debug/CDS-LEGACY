import crypto from "node:crypto";
import postgres from "postgres";
import { z } from "zod";

export type AdminUserKey = {
  id: number;
  label: string;
  email: string;
  accessKey: string;
  authProvider: string;
  creditLimit: number | null;
  creditsUsed: number;
  pptCreditLimit: number | null;
  pptCreditsUsed: number;
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  textModel: string;
  textApiKey: string;
  textBaseUrl: string;
  isActive: boolean;
  notes: string;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminTextApiKey = {
  id: number;
  label: string;
  provider: string;
  apiKey: string;
  model: string;
  baseUrl: string;
  priority: number;
  isActive: boolean;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminGammaApiKey = {
  id: number;
  label: string;
  apiKey: string;
  priority: number;
  isActive: boolean;
  useCount: number;
  lastUsedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type AdminGlobalSettings = {
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
  gammaApiBaseUrl: string;
  defaultLessonCreditLimit: number;
  defaultPptCreditLimit: number;
  allowNewSignups: boolean;
  maintenanceModeEnabled: boolean;
  maintenanceUntil: string;
  maintenanceMessage: string;
};

export type ResolvedTextProvider = {
  user: AdminUserKey | null;
  apiKey: string;
  model: string;
  baseURL: string;
  source: "user" | "global-db" | "env";
  globalKeyId: number | null;
  lasHeaderDivision: string;
  lasHeaderSchoolName: string;
};

export type ResolvedGammaProvider = {
  apiKey: string;
  baseURL: string;
  source: "global-db" | "env";
  gammaKeyId: number | null;
};

let sqlClient: ReturnType<typeof postgres> | null = null;
let schemaReady = false;

function nullableCounter(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : null;
}

function requiredCounter(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
}

function booleanInput(value: unknown) {
  if (typeof value === "boolean") return value;
  const text = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "active", "enabled"].includes(text)) return true;
  if (["0", "false", "no", "n", "off", "inactive", "disabled"].includes(text)) return false;
  return Boolean(value);
}

function settingIntValue(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : fallback;
}

function settingBoolValue(value: unknown, fallback: boolean) {
  if (value === undefined || value === null || value === "") return fallback;
  return booleanInput(value);
}

export const UserKeyInputSchema = z.object({
  label: z.string().trim().min(1, "Name is required."),
  email: z.string().trim().email("Enter a valid email address.").or(z.literal("")).optional().default(""),
  accessKey: z.string().trim().optional().default("").refine((value) => !value || value.length >= 4, "Internal access token must have at least 4 characters."),
  authProvider: z.string().trim().optional().default("email"),
  creditLimit: z.preprocess(nullableCounter, z.number().int().min(0).nullable()),
  creditsUsed: z.preprocess(requiredCounter, z.number().int().min(0)).optional(),
  pptCreditLimit: z.preprocess(nullableCounter, z.number().int().min(0).nullable()).optional().default(20),
  pptCreditsUsed: z.preprocess(requiredCounter, z.number().int().min(0)).optional(),
  lasHeaderDivision: z.string().trim().optional().default(""),
  lasHeaderSchoolName: z.string().trim().optional().default(""),
  textModel: z.string().trim().optional().default(""),
  textApiKey: z.string().trim().optional().default(""),
  textBaseUrl: z.string().trim().optional().default(""),
  isActive: z.boolean().optional().default(true),
  notes: z.string().trim().optional().default("")
});

export const TextApiKeyInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required."),
  provider: z.string().trim().optional().default("OpenAI compatible"),
  apiKey: z.string().trim().min(8, "API key is required."),
  model: z.string().trim().optional().default(""),
  baseUrl: z.string().trim().optional().default(""),
  priority: z.preprocess((value) => {
    const parsed = Number(value ?? 100);
    return Number.isFinite(parsed) ? Math.floor(parsed) : 100;
  }, z.number().int()).optional().default(100),
  isActive: z.boolean().optional().default(true)
});

export const GammaApiKeyInputSchema = z.object({
  label: z.string().trim().min(1, "Label is required."),
  apiKey: z.string().trim().min(8, "Gamma API key is required."),
  priority: z.preprocess((value) => {
    const parsed = Number(value ?? 100);
    return Number.isFinite(parsed) ? Math.floor(parsed) : 100;
  }, z.number().int()).optional().default(100),
  isActive: z.boolean().optional().default(true)
});

export const GlobalSettingsInputSchema = z.object({
  lasHeaderDivision: z.string().trim().optional().default(""),
  lasHeaderSchoolName: z.string().trim().optional().default(""),
  gammaApiBaseUrl: z.string().trim().optional().default("https://public-api.gamma.app/v1.0"),
  defaultLessonCreditLimit: z.preprocess((value) => settingIntValue(value, 100), z.number().int().min(0)).optional().default(100),
  defaultPptCreditLimit: z.preprocess((value) => settingIntValue(value, 20), z.number().int().min(0)).optional().default(20),
  allowNewSignups: z.preprocess((value) => settingBoolValue(value, true), z.boolean()).optional().default(true),
  maintenanceModeEnabled: z.preprocess((value) => settingBoolValue(value, false), z.boolean()).optional().default(false),
  maintenanceUntil: z.string().trim().optional().default(""),
  maintenanceMessage: z.string().trim().optional().default("We are improving Classroom Design Suite. Please check back soon.")
});

const BackupUserInputSchema = UserKeyInputSchema.extend({
  id: z.number().int().positive().optional(),
  lastUsedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
});

const BackupTextApiKeyInputSchema = TextApiKeyInputSchema.extend({
  id: z.number().int().positive().optional(),
  useCount: z.preprocess(requiredCounter, z.number().int().min(0)).optional().default(0),
  lastUsedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
});

const BackupGammaApiKeyInputSchema = GammaApiKeyInputSchema.extend({
  id: z.number().int().positive().optional(),
  useCount: z.preprocess(requiredCounter, z.number().int().min(0)).optional().default(0),
  lastUsedAt: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional()
});

export const AdminBackupInputSchema = z.object({
  format: z.string().optional(),
  version: z.number().optional(),
  exportedAt: z.string().optional(),
  settings: GlobalSettingsInputSchema.optional(),
  users: z.array(BackupUserInputSchema).optional().default([]),
  textApiKeys: z.array(BackupTextApiKeyInputSchema).optional().default([]),
  gammaApiKeys: z.array(BackupGammaApiKeyInputSchema).optional().default([])
});

export const AdminBackupRestoreSchema = z.object({
  mode: z.enum(["merge", "replace"]).optional().default("merge"),
  backup: AdminBackupInputSchema
});

function cleanValue(value: unknown) {
  return String(value ?? "").trim();
}

function nowIso() {
  return new Date().toISOString();
}

function isPlaceholderApiKey(value: string) {
  const key = cleanValue(value);
  if (!key) return true;
  return /your_.*api.*key|replace_me|change_me|sk-\.\.\./i.test(key);
}


export function supabaseDatabaseUrl() {
  return cleanValue(process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL);
}

export function databaseConfigured() {
  return Boolean(supabaseDatabaseUrl());
}

export function isDatabaseUnavailableError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /Supabase database is not configured|Supabase schema is missing|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|CONNECT_TIMEOUT|CONNECTION_CLOSED|CONNECTION_ENDED|connection timeout|Connection terminated|password authentication failed|Tenant or user not found|server closed the connection|SASL_SIGNATURE_MISMATCH/i.test(message);
}

function databaseHost() {
  try {
    return new URL(supabaseDatabaseUrl()).hostname;
  } catch {
    return "Supabase Postgres";
  }
}

export function getDatabaseClient() {
  const connectionString = supabaseDatabaseUrl();
  if (!connectionString) {
    throw new Error("Supabase database is not configured. Set SUPABASE_DATABASE_URL to the Supabase Transaction pooler connection string.");
  }

  if (!sqlClient) {
    sqlClient = postgres(connectionString, {
      ssl: "require",
      prepare: false,
      max: 1,
      idle_timeout: 10,
      connect_timeout: 10,
      fetch_types: false
    });
  }
  return sqlClient;
}

function asDateString(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function nullableInt(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

function rowBoolean(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function mapUser(row: Record<string, unknown>): AdminUserKey {
  return {
    id: Number(row.id),
    label: String(row.label || ""),
    email: String(row.email || ""),
    accessKey: String(row.access_key || ""),
    authProvider: String(row.auth_provider || "email"),
    creditLimit: nullableInt(row.credit_limit),
    creditsUsed: Number(row.credits_used || 0),
    pptCreditLimit: nullableInt(row.ppt_credit_limit),
    pptCreditsUsed: Number(row.ppt_credits_used || 0),
    lasHeaderDivision: String(row.las_header_division || ""),
    lasHeaderSchoolName: String(row.las_header_school_name || ""),
    textModel: String(row.text_model || ""),
    textApiKey: String(row.text_api_key || ""),
    textBaseUrl: String(row.text_base_url || ""),
    isActive: rowBoolean(row.is_active),
    notes: String(row.notes || ""),
    lastUsedAt: asDateString(row.last_used_at),
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at)
  };
}

function mapTextApiKey(row: Record<string, unknown>): AdminTextApiKey {
  return {
    id: Number(row.id),
    label: String(row.label || ""),
    provider: String(row.provider || "OpenAI compatible"),
    apiKey: String(row.api_key || ""),
    model: String(row.model || ""),
    baseUrl: String(row.base_url || ""),
    priority: Number(row.priority || 100),
    isActive: rowBoolean(row.is_active),
    useCount: Number(row.use_count || 0),
    lastUsedAt: asDateString(row.last_used_at),
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at)
  };
}

function mapGammaApiKey(row: Record<string, unknown>): AdminGammaApiKey {
  return {
    id: Number(row.id),
    label: String(row.label || ""),
    apiKey: String(row.api_key || ""),
    priority: Number(row.priority || 100),
    isActive: rowBoolean(row.is_active),
    useCount: Number(row.use_count || 0),
    lastUsedAt: asDateString(row.last_used_at),
    createdAt: asDateString(row.created_at),
    updatedAt: asDateString(row.updated_at)
  };
}

function normalizeGammaBaseUrl(value?: string | null) {
  return (value || "https://public-api.gamma.app/v1.0").trim().replace(/\/$/, "") || "https://public-api.gamma.app/v1.0";
}

async function seedMissingSettings() {
  const sql = getDatabaseClient();
  const now = nowIso();
  await sql`
    insert into ilaw_global_settings (setting_key, setting_value, created_at, updated_at) values
      ('las_header_division', ${process.env.LAS_HEADER_DIVISION || "Division of General Santos City"}, ${now}, ${now}),
      ('las_header_school_name', ${process.env.LAS_HEADER_SCHOOL_NAME || "GENERAL SANTOS CITY NATIONAL HIGH SCHOOL"}, ${now}, ${now}),
      ('gamma_api_base_url', ${process.env.GAMMA_API_BASE_URL || "https://public-api.gamma.app/v1.0"}, ${now}, ${now}),
      ('default_lesson_credit_limit', ${process.env.DEFAULT_SIGNUP_LESSON_CREDITS || "100"}, ${now}, ${now}),
      ('default_ppt_credit_limit', ${process.env.DEFAULT_SIGNUP_PPT_CREDITS || "20"}, ${now}, ${now}),
      ('allow_new_signups', ${process.env.ALLOW_NEW_SIGNUPS || "1"}, ${now}, ${now}),
      ('maintenance_mode_enabled', ${process.env.MAINTENANCE_MODE_ENABLED || "0"}, ${now}, ${now}),
      ('maintenance_until', ${process.env.MAINTENANCE_UNTIL || ""}, ${now}, ${now}),
      ('maintenance_message', ${process.env.MAINTENANCE_MESSAGE || "We are improving Classroom Design Suite. Please check back soon."}, ${now}, ${now})
    on conflict (setting_key) do nothing
  `;

  const defaultAccessKey = cleanValue(process.env.ILAW_DEFAULT_ACCESS_KEY);
  if (defaultAccessKey) {
    await sql`
      insert into ilaw_user_keys
        (label, email, access_key, auth_provider, credit_limit, credits_used, ppt_credit_limit, ppt_credits_used, is_active, notes)
      values (
        ${process.env.ILAW_DEFAULT_USER_LABEL || "Teacher User"},
        ${cleanValue(process.env.ILAW_DEFAULT_USER_EMAIL) || null},
        ${defaultAccessKey},
        'email',
        ${settingIntValue(process.env.ILAW_DEFAULT_CREDIT_LIMIT, 100)},
        0,
        ${settingIntValue(process.env.ILAW_DEFAULT_PPT_CREDIT_LIMIT, 20)},
        0,
        true,
        'Seeded from ILAW_DEFAULT_ACCESS_KEY.'
      )
      on conflict (access_key) do nothing
    `;
  }
}

export async function ensureAdminSchema() {
  if (schemaReady) return;
  const sql = getDatabaseClient();
  const rows = await sql`
    select
      to_regclass('public.ilaw_user_keys') as user_table,
      to_regclass('public.ilaw_global_settings') as settings_table,
      to_regclass('public.ilaw_text_api_keys') as text_keys_table,
      to_regclass('public.ilaw_gamma_api_keys') as gamma_keys_table,
      to_regclass('public.ilaw_gamma_generations') as generations_table,
      to_regclass('public.ilaw_ppt_credit_charges') as charges_table,
      to_regclass('public.ilaw_email_otps') as otps_table,
      to_regclass('public.ilaw_global_usage') as usage_table,
      to_regclass('public.ilaw_gamma_credit_state') as gamma_credit_state_table,
      to_regclass('public.ilaw_gamma_credit_charges') as gamma_credit_charges_table
  `;
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row?.user_table || !row?.settings_table || !row?.text_keys_table || !row?.gamma_keys_table || !row?.generations_table || !row?.charges_table || !row?.otps_table || !row?.usage_table || !row?.gamma_credit_state_table || !row?.gamma_credit_charges_table) {
    throw new Error("Supabase schema is missing. Run database/supabase_schema.sql in the Supabase SQL Editor, then redeploy or retry.");
  }
  await seedMissingSettings();
  schemaReady = true;
}

export async function getGlobalSettings(): Promise<AdminGlobalSettings> {
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const rows = await sql`select setting_key, setting_value from ilaw_global_settings`;
  const values = Object.fromEntries(rows.map((row) => [String(row.setting_key || ""), String(row.setting_value || "")])) as Record<string, string>;
  return {
    lasHeaderDivision: values.las_header_division || process.env.LAS_HEADER_DIVISION || "Division of General Santos City",
    lasHeaderSchoolName: values.las_header_school_name || process.env.LAS_HEADER_SCHOOL_NAME || "GENERAL SANTOS CITY NATIONAL HIGH SCHOOL",
    gammaApiBaseUrl: normalizeGammaBaseUrl(values.gamma_api_base_url || process.env.GAMMA_API_BASE_URL),
    defaultLessonCreditLimit: settingIntValue(values.default_lesson_credit_limit || process.env.DEFAULT_SIGNUP_LESSON_CREDITS, 100),
    defaultPptCreditLimit: settingIntValue(values.default_ppt_credit_limit || process.env.DEFAULT_SIGNUP_PPT_CREDITS, 20),
    allowNewSignups: settingBoolValue(values.allow_new_signups || process.env.ALLOW_NEW_SIGNUPS, true),
    maintenanceModeEnabled: settingBoolValue(values.maintenance_mode_enabled || process.env.MAINTENANCE_MODE_ENABLED, false),
    maintenanceUntil: values.maintenance_until || process.env.MAINTENANCE_UNTIL || "",
    maintenanceMessage: values.maintenance_message || process.env.MAINTENANCE_MESSAGE || "We are improving Classroom Design Suite. Please check back soon."
  };
}

async function writeGlobalSettings(client: ReturnType<typeof postgres>, parsed: z.infer<typeof GlobalSettingsInputSchema>) {
  const now = nowIso();
  await client`
    insert into ilaw_global_settings (setting_key, setting_value, created_at, updated_at) values
      ('las_header_division', ${parsed.lasHeaderDivision || ""}, ${now}, ${now}),
      ('las_header_school_name', ${parsed.lasHeaderSchoolName || ""}, ${now}, ${now}),
      ('gamma_api_base_url', ${normalizeGammaBaseUrl(parsed.gammaApiBaseUrl)}, ${now}, ${now}),
      ('default_lesson_credit_limit', ${String(parsed.defaultLessonCreditLimit ?? 100)}, ${now}, ${now}),
      ('default_ppt_credit_limit', ${String(parsed.defaultPptCreditLimit ?? 20)}, ${now}, ${now}),
      ('allow_new_signups', ${parsed.allowNewSignups ? "1" : "0"}, ${now}, ${now}),
      ('maintenance_mode_enabled', ${parsed.maintenanceModeEnabled ? "1" : "0"}, ${now}, ${now}),
      ('maintenance_until', ${parsed.maintenanceUntil || ""}, ${now}, ${now}),
      ('maintenance_message', ${parsed.maintenanceMessage || "We are improving Classroom Design Suite. Please check back soon."}, ${now}, ${now})
    on conflict (setting_key) do update
      set setting_value = excluded.setting_value, updated_at = excluded.updated_at
  `;
}

export async function updateGlobalSettings(input: z.infer<typeof GlobalSettingsInputSchema>) {
  const parsed = GlobalSettingsInputSchema.parse(input);
  await ensureAdminSchema();
  await writeGlobalSettings(getDatabaseClient(), parsed);
}

export async function listAdminData() {
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const userRows = await sql`
  select *
  from ilaw_user_keys
  order by created_at desc, id desc
`;

const textRows = await sql`
  select *
  from ilaw_text_api_keys
  order by is_active desc, priority asc, use_count asc, id asc
`;

const gammaRows = await sql`
  select *
  from ilaw_gamma_api_keys
  order by is_active desc, priority asc, use_count asc, id asc
`;

const settings = await getGlobalSettings();
  const users = userRows.map((row) => mapUser(row as Record<string, unknown>));
  const textApiKeys = textRows.map((row) => mapTextApiKey(row as Record<string, unknown>));
  const gammaApiKeys = gammaRows.map((row) => mapGammaApiKey(row as Record<string, unknown>));
  const totalTextCreditsUsed = users.reduce((sum, user) => sum + user.creditsUsed, 0);
  const totalPptCreditsUsed = users.reduce((sum, user) => sum + user.pptCreditsUsed, 0);

  return {
    configured: true,
    dbType: "supabase-postgres",
    dbPath: databaseHost(),
    users,
    textApiKeys,
    gammaApiKeys,
    settings,
    stats: {
      totalUsers: users.length,
      activeUsers: users.filter((user) => user.isActive).length,
      totalCreditsUsed: totalTextCreditsUsed + totalPptCreditsUsed,
      totalTextCreditsUsed,
      totalPptCreditsUsed,
      activeApiKeys: textApiKeys.filter((key) => key.isActive).length,
      activeGammaApiKeys: gammaApiKeys.filter((key) => key.isActive).length
    }
  };
}

export async function exportAdminBackup() {
  const data = await listAdminData();
  return {
    format: "classroom-design-suite-admin-backup",
    version: 2,
    exportedAt: nowIso(),
    settings: data.settings,
    users: data.users,
    textApiKeys: data.textApiKeys,
    gammaApiKeys: data.gammaApiKeys
  };
}

export async function importAdminBackup(input: z.infer<typeof AdminBackupRestoreSchema>) {
  const parsed = AdminBackupRestoreSchema.parse(input);
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const now = nowIso();
  let usersImported = 0;
  let apiKeysImported = 0;
  let gammaKeysImported = 0;

  await sql.begin(async (tx) => {
    if (parsed.backup.settings) {
      await writeGlobalSettings(tx as ReturnType<typeof postgres>, GlobalSettingsInputSchema.parse(parsed.backup.settings));
    }

    if (parsed.mode === "replace") {
      await tx`delete from ilaw_email_otps`;
      await tx`delete from ilaw_ppt_credit_charges`;
      await tx`delete from ilaw_gamma_generations`;
      await tx`delete from ilaw_text_api_keys`;
      await tx`delete from ilaw_gamma_api_keys`;
      await tx`delete from ilaw_user_keys`;
    }

    for (const user of parsed.backup.users) {
      const accessKey = user.accessKey || createInternalAccessKey();
      const existing = await tx`select id from ilaw_user_keys where access_key = ${accessKey} limit 1`;
      if (existing.length) {
        await tx`
          update ilaw_user_keys set
            label = ${user.label}, email = ${user.email || null}, auth_provider = ${user.authProvider || "email"},
            credit_limit = ${user.creditLimit}, credits_used = ${user.creditsUsed ?? 0},
            ppt_credit_limit = ${user.pptCreditLimit ?? null}, ppt_credits_used = ${user.pptCreditsUsed ?? 0},
            las_header_division = ${user.lasHeaderDivision || null}, las_header_school_name = ${user.lasHeaderSchoolName || null},
            text_model = ${user.textModel || null}, text_api_key = ${user.textApiKey || null}, text_base_url = ${user.textBaseUrl || null},
            is_active = ${user.isActive}, notes = ${user.notes || null}, last_used_at = ${user.lastUsedAt || null},
            updated_at = ${user.updatedAt || now}
          where id = ${Number(existing[0].id)}
        `;
      } else {
        await tx`
          insert into ilaw_user_keys
            (label, email, access_key, auth_provider, credit_limit, credits_used, ppt_credit_limit, ppt_credits_used,
             las_header_division, las_header_school_name, text_model, text_api_key, text_base_url, is_active, notes,
             last_used_at, created_at, updated_at)
          values (
            ${user.label}, ${user.email || null}, ${accessKey}, ${user.authProvider || "email"}, ${user.creditLimit}, ${user.creditsUsed ?? 0},
            ${user.pptCreditLimit ?? null}, ${user.pptCreditsUsed ?? 0}, ${user.lasHeaderDivision || null}, ${user.lasHeaderSchoolName || null},
            ${user.textModel || null}, ${user.textApiKey || null}, ${user.textBaseUrl || null}, ${user.isActive}, ${user.notes || null},
            ${user.lastUsedAt || null}, ${user.createdAt || now}, ${user.updatedAt || now}
          )
        `;
      }
      usersImported += 1;
    }

    for (const apiKey of parsed.backup.textApiKeys) {
      const existing = await tx`select id from ilaw_text_api_keys where api_key = ${apiKey.apiKey} limit 1`;
      if (existing.length) {
        await tx`
          update ilaw_text_api_keys set
            label = ${apiKey.label}, provider = ${apiKey.provider || "OpenAI compatible"}, model = ${apiKey.model || null},
            base_url = ${apiKey.baseUrl || null}, priority = ${apiKey.priority ?? 100}, is_active = ${apiKey.isActive},
            use_count = ${apiKey.useCount ?? 0}, last_used_at = ${apiKey.lastUsedAt || null}, updated_at = ${apiKey.updatedAt || now}
          where id = ${Number(existing[0].id)}
        `;
      } else {
        await tx`
          insert into ilaw_text_api_keys
            (label, provider, api_key, model, base_url, priority, is_active, use_count, last_used_at, created_at, updated_at)
          values (
            ${apiKey.label}, ${apiKey.provider || "OpenAI compatible"}, ${apiKey.apiKey}, ${apiKey.model || null}, ${apiKey.baseUrl || null},
            ${apiKey.priority ?? 100}, ${apiKey.isActive}, ${apiKey.useCount ?? 0}, ${apiKey.lastUsedAt || null},
            ${apiKey.createdAt || now}, ${apiKey.updatedAt || now}
          )
        `;
      }
      apiKeysImported += 1;
    }

    for (const gammaKey of parsed.backup.gammaApiKeys) {
      const existing = await tx`select id from ilaw_gamma_api_keys where api_key = ${gammaKey.apiKey} limit 1`;
      if (existing.length) {
        await tx`
          update ilaw_gamma_api_keys set
            label = ${gammaKey.label}, priority = ${gammaKey.priority ?? 100}, is_active = ${gammaKey.isActive},
            use_count = ${gammaKey.useCount ?? 0}, last_used_at = ${gammaKey.lastUsedAt || null}, updated_at = ${gammaKey.updatedAt || now}
          where id = ${Number(existing[0].id)}
        `;
      } else {
        await tx`
          insert into ilaw_gamma_api_keys
            (label, api_key, priority, is_active, use_count, last_used_at, created_at, updated_at)
          values (
            ${gammaKey.label}, ${gammaKey.apiKey}, ${gammaKey.priority ?? 100}, ${gammaKey.isActive}, ${gammaKey.useCount ?? 0},
            ${gammaKey.lastUsedAt || null}, ${gammaKey.createdAt || now}, ${gammaKey.updatedAt || now}
          )
        `;
      }
      gammaKeysImported += 1;
    }
  });

  return { mode: parsed.mode, usersImported, apiKeysImported, gammaKeysImported };
}

const ADMIN_CSV_HEADERS = [
  "record_type",
  "label",
  "email",
  "access_key",
  "auth_provider",
  "credit_limit",
  "credits_used",
  "ppt_credit_limit",
  "ppt_credits_used",
  "las_header_division",
  "las_header_school_name",
  "text_model",
  "text_api_key",
  "text_base_url",
  "is_active",
  "notes",
  "last_used_at",
  "provider",
  "api_key",
  "model",
  "base_url",
  "priority",
  "use_count",
  "setting_key",
  "setting_value",
  "created_at",
  "updated_at"
] as const;

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function csvLine(values: readonly unknown[]) {
  return values.map(csvEscape).join(",");
}

function csvBoolean(value: boolean) {
  return value ? "1" : "0";
}

function backupRow(values: Partial<Record<(typeof ADMIN_CSV_HEADERS)[number], unknown>>) {
  return csvLine(ADMIN_CSV_HEADERS.map((header) => values[header] ?? ""));
}

export async function exportAdminBackupCsv() {
  const backup = await exportAdminBackup();
  const rows = [csvLine(ADMIN_CSV_HEADERS)];

  for (const user of backup.users) {
    rows.push(backupRow({
      record_type: "user",
      label: user.label,
      email: user.email,
      access_key: user.accessKey,
      auth_provider: user.authProvider,
      credit_limit: user.creditLimit,
      credits_used: user.creditsUsed,
      ppt_credit_limit: user.pptCreditLimit,
      ppt_credits_used: user.pptCreditsUsed,
      las_header_division: user.lasHeaderDivision,
      las_header_school_name: user.lasHeaderSchoolName,
      text_model: user.textModel,
      text_api_key: user.textApiKey,
      text_base_url: user.textBaseUrl,
      is_active: csvBoolean(user.isActive),
      notes: user.notes,
      last_used_at: user.lastUsedAt,
      created_at: user.createdAt,
      updated_at: user.updatedAt
    }));
  }

  if (backup.settings) {
    const settingsRows = {
      las_header_division: backup.settings.lasHeaderDivision,
      las_header_school_name: backup.settings.lasHeaderSchoolName,
      gamma_api_base_url: backup.settings.gammaApiBaseUrl,
      default_lesson_credit_limit: backup.settings.defaultLessonCreditLimit,
      default_ppt_credit_limit: backup.settings.defaultPptCreditLimit,
      allow_new_signups: backup.settings.allowNewSignups ? "1" : "0",
      maintenance_mode_enabled: backup.settings.maintenanceModeEnabled ? "1" : "0",
      maintenance_until: backup.settings.maintenanceUntil,
      maintenance_message: backup.settings.maintenanceMessage
    };
    for (const [settingKey, settingValue] of Object.entries(settingsRows)) {
      rows.push(backupRow({
        record_type: "setting",
        setting_key: settingKey,
        setting_value: settingValue,
        is_active: "1"
      }));
    }
  }

  for (const key of backup.textApiKeys) {
    rows.push(backupRow({
      record_type: "api_key",
      label: key.label,
      is_active: csvBoolean(key.isActive),
      last_used_at: key.lastUsedAt,
      provider: key.provider,
      api_key: key.apiKey,
      model: key.model,
      base_url: key.baseUrl,
      priority: key.priority,
      use_count: key.useCount,
      created_at: key.createdAt,
      updated_at: key.updatedAt
    }));
  }

  for (const gammaKey of backup.gammaApiKeys) {
    rows.push(backupRow({
      record_type: "gamma_api_key",
      label: gammaKey.label,
      is_active: csvBoolean(gammaKey.isActive),
      last_used_at: gammaKey.lastUsedAt,
      provider: "Gamma",
      api_key: gammaKey.apiKey,
      priority: gammaKey.priority,
      use_count: gammaKey.useCount,
      created_at: gammaKey.createdAt,
      updated_at: gammaKey.updatedAt
    }));
  }

  return `${rows.join("\r\n")}\r\n`;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  if (cell.length || row.length) {
    row.push(cell.replace(/\r$/, ""));
    if (row.some((value) => value.trim() !== "")) rows.push(row);
  }

  return rows;
}

function csvRecordValue(record: Record<string, string>, key: string) {
  return cleanValue(record[key]);
}

function csvOptionalNumber(record: Record<string, string>, key: string) {
  const value = csvRecordValue(record, key);
  return value === "" ? null : Number(value);
}

function csvRequiredNumber(record: Record<string, string>, key: string, fallback = 0) {
  const value = csvRecordValue(record, key);
  if (value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function csvBooleanValue(record: Record<string, string>, key: string, fallback = true) {
  const value = csvRecordValue(record, key).toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "y", "active", "on"].includes(value);
}

function csvNullableString(record: Record<string, string>, key: string) {
  const value = csvRecordValue(record, key);
  return value || null;
}

export function parseAdminBackupCsv(csv: string) {
  const rows = parseCsvRows(csv);
  if (rows.length < 1) {
    throw new Error("CSV backup is empty.");
  }

  const headers = rows[0].map((header) => cleanValue(header).toLowerCase());
  if (!headers.includes("record_type")) {
    throw new Error("CSV backup must include a record_type column.");
  }

  const users: z.infer<typeof BackupUserInputSchema>[] = [];
  const textApiKeys: z.infer<typeof BackupTextApiKeyInputSchema>[] = [];
  const gammaApiKeys: z.infer<typeof BackupGammaApiKeyInputSchema>[] = [];
  const settings: Record<string, string> = {};

  for (const row of rows.slice(1)) {
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = row[index] ?? "";
    });

    const recordType = csvRecordValue(record, "record_type").toLowerCase().replace(/[\s-]+/g, "_");
    if (!recordType) continue;

    if (recordType === "user" || recordType === "login_key" || recordType === "user_key") {
      users.push({
        label: csvRecordValue(record, "label") || csvRecordValue(record, "email") || "Imported user",
        email: csvRecordValue(record, "email"),
        accessKey: csvRecordValue(record, "access_key"),
        authProvider: csvRecordValue(record, "auth_provider") || "email",
        creditLimit: csvOptionalNumber(record, "credit_limit"),
        creditsUsed: csvRequiredNumber(record, "credits_used"),
        pptCreditLimit: csvOptionalNumber(record, "ppt_credit_limit"),
        pptCreditsUsed: csvRequiredNumber(record, "ppt_credits_used"),
        lasHeaderDivision: csvRecordValue(record, "las_header_division"),
        lasHeaderSchoolName: csvRecordValue(record, "las_header_school_name"),
        textModel: csvRecordValue(record, "text_model"),
        textApiKey: csvRecordValue(record, "text_api_key"),
        textBaseUrl: csvRecordValue(record, "text_base_url"),
        isActive: csvBooleanValue(record, "is_active"),
        notes: csvRecordValue(record, "notes"),
        lastUsedAt: csvNullableString(record, "last_used_at"),
        createdAt: csvNullableString(record, "created_at"),
        updatedAt: csvNullableString(record, "updated_at")
      });
      continue;
    }


    if (recordType === "gamma_api_key" || recordType === "gamma_key" || recordType === "presentation_api_key") {
      gammaApiKeys.push({
        label: csvRecordValue(record, "label") || "Imported Gamma key",
        apiKey: csvRecordValue(record, "api_key"),
        priority: csvRequiredNumber(record, "priority", 100),
        isActive: csvBooleanValue(record, "is_active"),
        useCount: csvRequiredNumber(record, "use_count"),
        lastUsedAt: csvNullableString(record, "last_used_at"),
        createdAt: csvNullableString(record, "created_at"),
        updatedAt: csvNullableString(record, "updated_at")
      });
      continue;
    }

    if (recordType === "setting" || recordType === "global_setting") {
      const key = csvRecordValue(record, "setting_key");
      if (key) settings[key] = csvRecordValue(record, "setting_value");
      continue;
    }

    if (recordType === "api_key" || recordType === "rotating_api_key" || recordType === "text_api_key") {
      textApiKeys.push({
        label: csvRecordValue(record, "label") || "Imported API key",
        provider: csvRecordValue(record, "provider") || "OpenAI compatible",
        apiKey: csvRecordValue(record, "api_key"),
        model: csvRecordValue(record, "model"),
        baseUrl: csvRecordValue(record, "base_url"),
        priority: csvRequiredNumber(record, "priority", 100),
        isActive: csvBooleanValue(record, "is_active"),
        useCount: csvRequiredNumber(record, "use_count"),
        lastUsedAt: csvNullableString(record, "last_used_at"),
        createdAt: csvNullableString(record, "created_at"),
        updatedAt: csvNullableString(record, "updated_at")
      });
    }
  }

  return AdminBackupInputSchema.parse({
    format: "classroom-design-suite-admin-backup-csv",
    version: 2,
    exportedAt: nowIso(),
    settings: Object.keys(settings).length ? {
      lasHeaderDivision: settings.las_header_division || "",
      lasHeaderSchoolName: settings.las_header_school_name || "",
      gammaApiBaseUrl: settings.gamma_api_base_url || "https://public-api.gamma.app/v1.0",
      defaultLessonCreditLimit: settingIntValue(settings.default_lesson_credit_limit, 100),
      defaultPptCreditLimit: settingIntValue(settings.default_ppt_credit_limit, 20),
      allowNewSignups: settingBoolValue(settings.allow_new_signups, true),
      maintenanceModeEnabled: settingBoolValue(settings.maintenance_mode_enabled, false),
      maintenanceUntil: settings.maintenance_until || "",
      maintenanceMessage: settings.maintenance_message || "We are improving Classroom Design Suite. Please check back soon."
    } : undefined,
    users,
    textApiKeys,
    gammaApiKeys
  });
}

export async function importAdminBackupCsv(input: { mode?: "merge" | "replace"; csv: string }) {
  const backup = parseAdminBackupCsv(input.csv);
  return importAdminBackup({ mode: input.mode || "merge", backup });
}

function createInternalAccessKey() {
  return `usr_${crypto.randomBytes(18).toString("hex")}`;
}


export async function createUserKey(input: z.infer<typeof UserKeyInputSchema>) {
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const now = nowIso();
  const accessKey = input.accessKey || createInternalAccessKey();
  const rows = await sql`
    insert into ilaw_user_keys
      (label, email, access_key, auth_provider, credit_limit, credits_used, ppt_credit_limit, ppt_credits_used,
       las_header_division, las_header_school_name, text_model, text_api_key, text_base_url, is_active, notes, created_at, updated_at)
    values (
      ${input.label}, ${input.email || null}, ${accessKey}, ${input.authProvider || "email"}, ${input.creditLimit}, ${input.creditsUsed ?? 0},
      ${input.pptCreditLimit ?? null}, ${input.pptCreditsUsed ?? 0}, ${input.lasHeaderDivision || null}, ${input.lasHeaderSchoolName || null},
      ${input.textModel || null}, ${input.textApiKey || null}, ${input.textBaseUrl || null}, ${input.isActive}, ${input.notes || null}, ${now}, ${now}
    ) returning id
  `;
  return Number(rows[0].id);
}

export async function updateUserKey(id: number, input: z.infer<typeof UserKeyInputSchema>) {
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const accessKey = input.accessKey || createInternalAccessKey();
  await sql`
    update ilaw_user_keys set
      label = ${input.label}, email = ${input.email || null}, access_key = ${accessKey}, auth_provider = ${input.authProvider || "email"},
      credit_limit = ${input.creditLimit}, credits_used = ${input.creditsUsed ?? 0}, ppt_credit_limit = ${input.pptCreditLimit ?? null},
      ppt_credits_used = ${input.pptCreditsUsed ?? 0}, las_header_division = ${input.lasHeaderDivision || null},
      las_header_school_name = ${input.lasHeaderSchoolName || null}, text_model = ${input.textModel || null},
      text_api_key = ${input.textApiKey || null}, text_base_url = ${input.textBaseUrl || null}, is_active = ${input.isActive},
      notes = ${input.notes || null}, updated_at = ${nowIso()}
    where id = ${id}
  `;
}

export async function deleteUserKey(id: number) {
  await ensureAdminSchema();
  await getDatabaseClient()`delete from ilaw_user_keys where id = ${id}`;
}

export async function resetUserCredits(id: number) {
  await ensureAdminSchema();
  await getDatabaseClient()`update ilaw_user_keys set credits_used = 0, ppt_credits_used = 0, updated_at = ${nowIso()} where id = ${id}`;
}

export async function createTextApiKey(input: z.infer<typeof TextApiKeyInputSchema>) {
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`
    insert into ilaw_text_api_keys (label, provider, api_key, model, base_url, priority, is_active, created_at, updated_at)
    values (${input.label}, ${input.provider || "OpenAI compatible"}, ${input.apiKey}, ${input.model || null}, ${input.baseUrl || null},
            ${input.priority ?? 100}, ${input.isActive}, ${nowIso()}, ${nowIso()}) returning id
  `;
  return Number(rows[0].id);
}

export async function updateTextApiKey(id: number, input: z.infer<typeof TextApiKeyInputSchema>) {
  await ensureAdminSchema();
  await getDatabaseClient()`
    update ilaw_text_api_keys set
      label = ${input.label}, provider = ${input.provider || "OpenAI compatible"}, api_key = ${input.apiKey}, model = ${input.model || null},
      base_url = ${input.baseUrl || null}, priority = ${input.priority ?? 100}, is_active = ${input.isActive}, updated_at = ${nowIso()}
    where id = ${id}
  `;
}

export async function deleteTextApiKey(id: number) {
  await ensureAdminSchema();
  await getDatabaseClient()`delete from ilaw_text_api_keys where id = ${id}`;
}

export async function createGammaApiKey(input: z.infer<typeof GammaApiKeyInputSchema>) {
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`
    insert into ilaw_gamma_api_keys (label, api_key, priority, is_active, created_at, updated_at)
    values (${input.label}, ${input.apiKey}, ${input.priority ?? 100}, ${input.isActive}, ${nowIso()}, ${nowIso()}) returning id
  `;
  return Number(rows[0].id);
}

export async function updateGammaApiKey(id: number, input: z.infer<typeof GammaApiKeyInputSchema>) {
  await ensureAdminSchema();
  await getDatabaseClient()`
    update ilaw_gamma_api_keys set
      label = ${input.label}, api_key = ${input.apiKey}, priority = ${input.priority ?? 100}, is_active = ${input.isActive}, updated_at = ${nowIso()}
    where id = ${id}
  `;
}

export async function deleteGammaApiKey(id: number) {
  await ensureAdminSchema();
  await getDatabaseClient()`delete from ilaw_gamma_api_keys where id = ${id}`;
}

export async function findUserByEmail(email: string, includeInactive = false) {
  const safeEmail = cleanValue(email).toLowerCase();
  if (!databaseConfigured() || !safeEmail) return null;
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  const rows = includeInactive
    ? await sql`select * from ilaw_user_keys where lower(email) = ${safeEmail} limit 1`
    : await sql`select * from ilaw_user_keys where lower(email) = ${safeEmail} and is_active = true limit 1`;
  return rows.length ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function createPendingAuthUser(input: { label: string; email: string; passwordHash?: string | null; provider?: string; isActive?: boolean; notes?: string }) {
  await ensureAdminSchema();
  const existing = await findUserByEmail(input.email, true);
  if (existing) return existing;

  const settings = await getGlobalSettings();
  const now = nowIso();
  const isActive = Boolean(input.isActive);
  const notes = input.notes || (isActive
    ? "Verified account. Access activated automatically."
    : "Pending signup. Activate this account in Admin to approve access.");
  const rows = await getDatabaseClient()`
    insert into ilaw_user_keys
      (label, email, access_key, password_hash, auth_provider, credit_limit, credits_used, ppt_credit_limit, ppt_credits_used, is_active, notes, created_at, updated_at)
    values (
      ${input.label || input.email}, ${input.email.toLowerCase()}, ${createInternalAccessKey()}, ${input.passwordHash || null}, ${input.provider || "email"},
      ${settings.defaultLessonCreditLimit}, 0, ${settings.defaultPptCreditLimit}, 0, ${isActive}, ${notes}, ${now}, ${now}
    ) returning *
  `;
  return mapUser(rows[0] as Record<string, unknown>);
}

export async function createOrActivateEmailAuthUser(input: { label: string; email: string; passwordHash: string }) {
  await ensureAdminSchema();
  const existing = await findUserByEmail(input.email, true);
  if (existing) {
    await getDatabaseClient()`
      update ilaw_user_keys set
        label = ${input.label || existing.label || input.email}, password_hash = ${input.passwordHash}, auth_provider = 'email',
        is_active = true, notes = 'Verified by email OTP. Access activated automatically.', updated_at = ${nowIso()}
      where id = ${existing.id}
    `;
    return findUserById(existing.id);
  }

  return createPendingAuthUser({
    label: input.label,
    email: input.email,
    passwordHash: input.passwordHash,
    provider: "email",
    isActive: true,
    notes: "Verified by email OTP. Access activated automatically."
  });
}

export async function activateAuthUserByEmail(email: string, provider = "google") {
  await ensureAdminSchema();
  const existing = await findUserByEmail(email, true);
  if (!existing) return null;
  await getDatabaseClient()`
    update ilaw_user_keys set auth_provider = ${provider}, is_active = true,
      notes = ${`Verified by ${provider} sign-in. Access activated automatically.`}, updated_at = ${nowIso()}
    where id = ${existing.id}
  `;
  return findUserById(existing.id);
}

export async function storeEmailOtp(input: { email: string; purpose?: string; otpHash: string; expiresAt: string }) {
  await ensureAdminSchema();
  const email = cleanValue(input.email).toLowerCase();
  const purpose = cleanValue(input.purpose || "signup") || "signup";
  const sql = getDatabaseClient();
  await sql.begin(async (tx) => {
    await tx`delete from ilaw_email_otps where email = ${email} and purpose = ${purpose} and consumed_at is null`;
    await tx`
      insert into ilaw_email_otps (email, purpose, otp_hash, expires_at, consumed_at, attempts, created_at)
      values (${email}, ${purpose}, ${input.otpHash}, ${input.expiresAt}, null, 0, ${nowIso()})
    `;
  });
}

export async function verifyEmailOtp(input: { email: string; purpose?: string; otpHash: string }) {
  await ensureAdminSchema();
  const email = cleanValue(input.email).toLowerCase();
  const purpose = cleanValue(input.purpose || "signup") || "signup";
  const now = nowIso();
  const sql = getDatabaseClient();
  const rows = await sql`
    select * from ilaw_email_otps
    where email = ${email} and purpose = ${purpose} and consumed_at is null
    order by id desc limit 1
  `;
  if (!rows.length) return { ok: false, message: "Verification code was not requested or has already been used." };

  const row = rows[0] as Record<string, unknown>;
  const id = Number(row.id);
  const attempts = Number(row.attempts || 0);
  if (attempts >= 5) return { ok: false, message: "Too many incorrect verification attempts. Request a new code." };

  const expiresAt = asDateString(row.expires_at) || "";
  if (expiresAt < now) return { ok: false, message: "Verification code expired. Request a new code." };

  if (String(row.otp_hash || "") !== input.otpHash) {
    await sql`update ilaw_email_otps set attempts = attempts + 1 where id = ${id}`;
    return { ok: false, message: "Incorrect verification code." };
  }

  await sql`update ilaw_email_otps set consumed_at = ${now} where id = ${id}`;
  return { ok: true, message: "Email verified." };
}

export async function getUserPasswordHashByEmail(email: string) {
  const safeEmail = cleanValue(email).toLowerCase();
  if (!databaseConfigured() || !safeEmail) return null;
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`select password_hash from ilaw_user_keys where lower(email) = ${safeEmail} limit 1`;
  return rows.length ? String(rows[0].password_hash || "") : null;
}

export async function findUserByAccessKey(accessKey: string) {
  if (!databaseConfigured() || !accessKey.trim()) return null;
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`select * from ilaw_user_keys where access_key = ${accessKey} and is_active = true limit 1`;
  return rows.length ? mapUser(rows[0] as Record<string, unknown>) : null;
}

export async function findUserById(id: number) {
  if (!databaseConfigured()) return null;
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`select * from ilaw_user_keys where id = ${id} limit 1`;
  return rows.length ? mapUser(rows[0] as Record<string, unknown>) : null;
}

async function nextGlobalTextApiKey() {
  if (!databaseConfigured()) return null;
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  return sql.begin(async (tx) => {
    const rows = await tx`
      select * from ilaw_text_api_keys
      where is_active = true
      order by priority asc, use_count asc, coalesce(last_used_at, '1970-01-01'::timestamptz) asc, id asc
      for update skip locked limit 1
    `;
    if (!rows.length) return null;
    const selected = mapTextApiKey(rows[0] as Record<string, unknown>);
    const now = nowIso();
    await tx`update ilaw_text_api_keys set use_count = use_count + 1, last_used_at = ${now}, updated_at = ${now} where id = ${selected.id}`;
    return selected;
  });
}

export async function requireActiveUserForAccessKey(accessKey: string) {
  const user = accessKey ? await findUserByAccessKey(accessKey) : null;
  if (databaseConfigured() && !user) {
    const error = new Error("Invalid or inactive access key.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  return user;
}

async function nextGlobalGammaApiKey() {
  if (!databaseConfigured()) return null;
  await ensureAdminSchema();
  const sql = getDatabaseClient();
  return sql.begin(async (tx) => {
    const rows = await tx`
      select * from ilaw_gamma_api_keys
      where is_active = true
      order by priority asc, use_count asc, coalesce(last_used_at, '1970-01-01'::timestamptz) asc, id asc
      for update skip locked limit 1
    `;
    if (!rows.length) return null;
    const selected = mapGammaApiKey(rows[0] as Record<string, unknown>);
    const now = nowIso();
    await tx`update ilaw_gamma_api_keys set use_count = use_count + 1, last_used_at = ${now}, updated_at = ${now} where id = ${selected.id}`;
    return selected;
  });
}

export async function resolveGammaProvider(): Promise<ResolvedGammaProvider> {
  const settings = databaseConfigured() ? await getGlobalSettings() : { gammaApiBaseUrl: process.env.GAMMA_API_BASE_URL || "https://public-api.gamma.app/v1.0" };
  const globalKey = await nextGlobalGammaApiKey();
  const apiKey = globalKey?.apiKey || process.env.GAMMA_API_KEY || "";
  const baseURL = normalizeGammaBaseUrl(settings.gammaApiBaseUrl || process.env.GAMMA_API_BASE_URL);
  if (!apiKey) throw new Error("PPT generation service is not configured. Add a Gamma API key in Admin Settings or set GAMMA_API_KEY before generating PPT.");
  return { apiKey, baseURL, source: globalKey ? "global-db" : "env", gammaKeyId: globalKey?.id || null };
}

export async function rememberGammaGenerationKey(generationId: string, gammaKeyId: number | null) {
  if (!databaseConfigured() || !generationId.trim()) return;
  await ensureAdminSchema();
  const now = nowIso();
  await getDatabaseClient()`
    insert into ilaw_gamma_generations (generation_id, gamma_key_id, created_at, updated_at)
    values (${generationId.trim()}, ${gammaKeyId}, ${now}, ${now})
    on conflict (generation_id) do update set gamma_key_id = excluded.gamma_key_id, updated_at = excluded.updated_at
  `;
}

export async function resolveGammaProviderForGeneration(generationId: string): Promise<ResolvedGammaProvider> {
  if (databaseConfigured()) {
    await ensureAdminSchema();
    const settings = await getGlobalSettings();
    const rows = await getDatabaseClient()`
      select k.* from ilaw_gamma_generations g
      join ilaw_gamma_api_keys k on k.id = g.gamma_key_id
      where g.generation_id = ${generationId.trim()} limit 1
    `;
    if (rows.length) {
      const key = mapGammaApiKey(rows[0] as Record<string, unknown>);
      if (key.apiKey) return { apiKey: key.apiKey, baseURL: normalizeGammaBaseUrl(settings.gammaApiBaseUrl), source: "global-db", gammaKeyId: key.id };
    }
  }
  return resolveGammaProvider();
}

export async function resolveTextProviderForAccessKey(accessKey: string): Promise<ResolvedTextProvider> {
  const user = accessKey ? await findUserByAccessKey(accessKey) : null;
  if (databaseConfigured() && !user) {
    const error = new Error("Invalid or inactive access key.");
    (error as Error & { status?: number }).status = 401;
    throw error;
  }
  if (user && user.creditLimit !== null && user.creditsUsed >= user.creditLimit) {
    const error = new Error(`Lesson/LAS credit limit reached for ${user.label} (${user.creditsUsed}/${user.creditLimit}).`);
    (error as Error & { status?: number }).status = 429;
    throw error;
  }

  const settings = databaseConfigured() ? await getGlobalSettings() : {
    lasHeaderDivision: process.env.LAS_HEADER_DIVISION || "",
    lasHeaderSchoolName: process.env.LAS_HEADER_SCHOOL_NAME || ""
  };
  const globalKey = user?.textApiKey ? null : await nextGlobalTextApiKey();
  const apiKey = user?.textApiKey || globalKey?.apiKey || process.env.OPENAI_API_KEY || "";
  const model = user?.textModel || globalKey?.model || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = user?.textBaseUrl || globalKey?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  if (!apiKey) throw new Error("AI generation is not configured. Add a user API key, add global rotating API keys in Admin, or set OPENAI_API_KEY.");

  return {
    user, apiKey, model, baseURL,
    source: user?.textApiKey ? "user" : globalKey ? "global-db" : "env",
    globalKeyId: globalKey?.id || null,
    lasHeaderDivision: user?.lasHeaderDivision || settings.lasHeaderDivision || process.env.LAS_HEADER_DIVISION || "",
    lasHeaderSchoolName: user?.lasHeaderSchoolName || settings.lasHeaderSchoolName || process.env.LAS_HEADER_SCHOOL_NAME || ""
  };
}

export async function incrementUserCredits(userId: number) {
  if (!databaseConfigured()) return;
  await ensureAdminSchema();
  const now = nowIso();
  await getDatabaseClient()`update ilaw_user_keys set credits_used = credits_used + 1, last_used_at = ${now}, updated_at = ${now} where id = ${userId}`;
}

export function assertUserPptCreditsAvailable(user: AdminUserKey | null) {
  if (!user || user.pptCreditLimit === null) return;
  if (user.pptCreditsUsed >= user.pptCreditLimit) {
    const error = new Error(`PPT Generator credit limit reached for ${user.label} (${user.pptCreditsUsed}/${user.pptCreditLimit}).`);
    (error as Error & { status?: number }).status = 429;
    throw error;
  }
}

export async function incrementUserPptCredits(userId: number, amount = 1) {
  if (!databaseConfigured()) return null;
  const safeAmount = Math.max(1, Math.floor(Number.isFinite(amount) ? amount : 1));
  await ensureAdminSchema();
  const now = nowIso();
  await getDatabaseClient()`update ilaw_user_keys set ppt_credits_used = ppt_credits_used + ${safeAmount}, last_used_at = ${now}, updated_at = ${now} where id = ${userId}`;
  return findUserById(userId);
}

export type UserPptGammaUsageCharge = {
  user: AdminUserKey | null;
  deducted: number | null;
  applied: number;
  alreadyApplied: boolean;
};

function gammaCreditsDeducted(credits?: { deducted?: number; remaining?: number } | null) {
  if (!credits || typeof credits.deducted !== "number" || !Number.isFinite(credits.deducted)) return null;
  return Math.max(0, Math.floor(credits.deducted));
}

export async function applyUserPptGammaUsage(
  userId: number,
  generationId: string,
  credits?: { deducted?: number; remaining?: number } | null
): Promise<UserPptGammaUsageCharge> {
  const deducted = gammaCreditsDeducted(credits);
  const safeGenerationId = generationId.trim();
  if (!databaseConfigured()) return { user: null, deducted, applied: 0, alreadyApplied: false };
  await ensureAdminSchema();
  if (!safeGenerationId || deducted === null || deducted <= 0) {
    return { user: await findUserById(userId), deducted, applied: 0, alreadyApplied: false };
  }

  const sql = getDatabaseClient();
  let inserted = false;
  await sql.begin(async (tx) => {
    const now = nowIso();
    const result = await tx`
      insert into ilaw_ppt_credit_charges (user_id, generation_id, credits_deducted, created_at, updated_at)
      values (${userId}, ${safeGenerationId}, ${deducted}, ${now}, ${now})
      on conflict (user_id, generation_id) do nothing
      returning id
    `;
    inserted = result.length > 0;
    if (inserted) {
      await tx`update ilaw_user_keys set ppt_credits_used = ppt_credits_used + ${deducted}, last_used_at = ${now}, updated_at = ${now} where id = ${userId}`;
    }
  });

  return {
    user: await findUserById(userId),
    deducted,
    applied: inserted ? deducted : 0,
    alreadyApplied: !inserted
  };
}

export function pptCreditsRemaining(user: AdminUserKey | null) {
  if (!user || user.pptCreditLimit === null) return null;
  return Math.max(0, user.pptCreditLimit - user.pptCreditsUsed);
}
