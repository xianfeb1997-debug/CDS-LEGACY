import { accessKeyFromRequest } from "./admin-auth";
import { incrementUserCredits, databaseConfigured, isDatabaseUnavailableError, resolveTextProviderForAccessKey, type ResolvedTextProvider } from "./admin-db";

function configuredAccessKeys() {
  const raw = process.env.ILAW_ACCESS_KEYS || process.env.APP_ACCESS_KEYS || process.env.ILAW_ACCESS_KEY || "";
  return raw
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);
}

function fallbackAccessAllowed(accessKey: string) {
  const allowedKeys = configuredAccessKeys();
  if (allowedKeys.length > 0) return allowedKeys.includes(accessKey);
  return process.env.NODE_ENV !== "production" && accessKey.trim().length > 0;
}

function envTextProvider(): ResolvedTextProvider {
  const apiKey = process.env.OPENAI_API_KEY || "";
  const model = process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("AI generation is not configured. Add a global API key in Admin or set OPENAI_API_KEY in .env.local.");
  }

  return {
    user: null,
    apiKey,
    model,
    baseURL,
    source: "env",
    globalKeyId: null,
    lasHeaderDivision: process.env.LAS_HEADER_DIVISION || "",
    lasHeaderSchoolName: process.env.LAS_HEADER_SCHOOL_NAME || ""
  };
}

export async function resolveGenerationProvider(request: Request): Promise<ResolvedTextProvider> {
  const accessKey = accessKeyFromRequest(request);

  try {
    return await resolveTextProviderForAccessKey(accessKey);
  } catch (error) {
    if (databaseConfigured() && isDatabaseUnavailableError(error) && fallbackAccessAllowed(accessKey)) {
      console.error("Generation database provider unavailable. Falling back to .env provider:", error);
      return envTextProvider();
    }

    throw error;
  }
}

export async function chargeUserTextCredit(provider: ResolvedTextProvider) {
  if (provider.user) {
    await incrementUserCredits(provider.user.id);
  }
}
