import { databaseConfigured, ensureAdminSchema, getDatabaseClient } from "./admin-db";

export type GammaCreditState = {
  configured: boolean;
  source: "database" | "memory" | "env" | "unknown";
  remaining: number | null;
  lastDeducted: number | null;
  updatedAt: string | null;
  message: string;
};

type StoredGammaCreditState = {
  initial: number | null;
  remaining: number | null;
  lastDeducted: number | null;
  updatedAt: string | null;
  lastGenerationId: string | null;
};

let memoryState: StoredGammaCreditState | null = null;
const memoryAppliedGenerationIds = new Set<string>();

function numberFromEnv(...names: string[]) {
  for (const name of names) {
    const raw = process.env[name];
    if (!raw) continue;
    const value = Number(raw);
    if (Number.isFinite(value) && value >= 0) return Math.floor(value);
  }
  return null;
}

function configuredInitialCredits() {
  return numberFromEnv("GAMMA_INITIAL_CREDITS", "NEXT_PUBLIC_GAMMA_INITIAL_CREDITS");
}

function toIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function mapDatabaseState(row: Record<string, unknown>): StoredGammaCreditState {
  return {
    initial: row.initial_credits === null || row.initial_credits === undefined ? null : Number(row.initial_credits),
    remaining: row.remaining === null || row.remaining === undefined ? null : Number(row.remaining),
    lastDeducted: row.last_deducted === null || row.last_deducted === undefined ? null : Number(row.last_deducted),
    updatedAt: toIso(row.updated_at),
    lastGenerationId: row.last_generation_id ? String(row.last_generation_id) : null
  };
}

function responseFromStored(state: StoredGammaCreditState, source: "database" | "memory"): GammaCreditState {
  return {
    configured: typeof state.remaining === "number",
    source,
    remaining: state.remaining,
    lastDeducted: state.lastDeducted,
    updatedAt: state.updatedAt,
    message:
      source === "database"
        ? "Presentation credits are tracked in Supabase from the configured starting balance."
        : "Presentation credits are using temporary in-memory tracking because Supabase is not configured."
  };
}

async function readDatabaseState() {
  await ensureAdminSchema();
  const rows = await getDatabaseClient()`
    select initial_credits, remaining, last_deducted, updated_at, last_generation_id
    from ilaw_gamma_credit_state
    where state_key = 'global'
    limit 1
  `;
  return rows[0] ? mapDatabaseState(rows[0] as Record<string, unknown>) : null;
}

export async function readGammaCreditState(): Promise<GammaCreditState> {
  if (databaseConfigured()) {
    const stored = await readDatabaseState();
    if (stored && typeof stored.remaining === "number") {
      return responseFromStored(stored, "database");
    }
  } else if (memoryState && typeof memoryState.remaining === "number") {
    return responseFromStored(memoryState, "memory");
  }

  const envRemaining = configuredInitialCredits();
  if (typeof envRemaining === "number") {
    return {
      configured: true,
      source: "env",
      remaining: envRemaining,
      lastDeducted: null,
      updatedAt: null,
      message: databaseConfigured()
        ? "Presentation credits are using the configured starting value. The first completed generation will persist the balance in Supabase."
        : "Presentation credits are using the configured starting value. Configure Supabase for durable tracking on Vercel."
    };
  }

  return {
    configured: false,
    source: "unknown",
    remaining: null,
    lastDeducted: null,
    updatedAt: null,
    message: "Set GAMMA_INITIAL_CREDITS to show fallback Presentation credits."
  };
}

async function saveDatabaseState(deducted: number, generationId: string) {
  await ensureAdminSchema();
  const db = getDatabaseClient();
  const initialFromEnv = configuredInitialCredits();

  return db.begin(async (sql) => {
    let rows = await sql`
      select initial_credits, remaining, last_deducted, updated_at, last_generation_id
      from ilaw_gamma_credit_state
      where state_key = 'global'
      for update
    `;

    if (!rows[0]) {
      if (typeof initialFromEnv !== "number") return null;
      await sql`
        insert into ilaw_gamma_credit_state
          (state_key, initial_credits, remaining, last_deducted, updated_at, last_generation_id)
        values ('global', ${initialFromEnv}, ${initialFromEnv}, null, now(), null)
        on conflict (state_key) do nothing
      `;
      rows = await sql`
        select initial_credits, remaining, last_deducted, updated_at, last_generation_id
        from ilaw_gamma_credit_state
        where state_key = 'global'
        for update
      `;
    }

    const current = rows[0] ? mapDatabaseState(rows[0] as Record<string, unknown>) : null;
    if (!current || typeof current.remaining !== "number") return null;

    let alreadyApplied = false;
    if (generationId) {
      const inserted = await sql`
        insert into ilaw_gamma_credit_charges (generation_id, credits_deducted, created_at)
        values (${generationId}, ${deducted}, now())
        on conflict (generation_id) do nothing
        returning generation_id
      `;
      alreadyApplied = inserted.length === 0;
    }

    if (alreadyApplied) {
      return { state: current, alreadyApplied: true };
    }

    const nextRemaining = Math.max(0, current.remaining - deducted);
    const updated = await sql`
      update ilaw_gamma_credit_state
      set remaining = ${nextRemaining},
          last_deducted = ${deducted},
          last_generation_id = ${generationId || current.lastGenerationId},
          updated_at = now()
      where state_key = 'global'
      returning initial_credits, remaining, last_deducted, updated_at, last_generation_id
    `;
    return { state: mapDatabaseState(updated[0] as Record<string, unknown>), alreadyApplied: false };
  });
}

function saveMemoryState(deducted: number, generationId: string) {
  const initial = memoryState?.initial ?? configuredInitialCredits();
  const startingRemaining = memoryState?.remaining ?? initial;
  if (typeof startingRemaining !== "number") return null;

  const alreadyApplied = generationId ? memoryAppliedGenerationIds.has(generationId) : false;
  if (generationId && !alreadyApplied) memoryAppliedGenerationIds.add(generationId);

  memoryState = {
    initial: typeof initial === "number" ? initial : startingRemaining,
    remaining: alreadyApplied ? startingRemaining : Math.max(0, startingRemaining - deducted),
    lastDeducted: deducted,
    updatedAt: new Date().toISOString(),
    lastGenerationId: generationId || memoryState?.lastGenerationId || null
  };
  return { state: memoryState, alreadyApplied };
}

export async function saveGammaCreditState(credits?: { deducted?: number; remaining?: number }, generationId?: string) {
  const deducted =
    credits && typeof credits.deducted === "number" && Number.isFinite(credits.deducted)
      ? Math.max(0, Math.floor(credits.deducted))
      : null;

  if (deducted === null) return readGammaCreditState();

  const safeGenerationId = generationId?.trim() || "";
  const saved = databaseConfigured()
    ? await saveDatabaseState(deducted, safeGenerationId)
    : saveMemoryState(deducted, safeGenerationId);

  if (!saved) {
    return {
      configured: false,
      source: "unknown" as const,
      remaining: null,
      lastDeducted: deducted,
      updatedAt: null,
      message: "Presentation credits were used, but no starting balance is configured. Set GAMMA_INITIAL_CREDITS."
    };
  }

  const source = databaseConfigured() ? "database" as const : "memory" as const;
  return {
    configured: true,
    source,
    remaining: saved.state.remaining,
    lastDeducted: saved.state.lastDeducted,
    updatedAt: saved.state.updatedAt,
    message: saved.alreadyApplied
      ? "Presentation credit deduction was already recorded for this generation."
      : source === "database"
        ? "Presentation credits were deducted from the Supabase-backed fallback balance."
        : "Presentation credits were deducted from temporary in-memory fallback tracking."
  };
}
