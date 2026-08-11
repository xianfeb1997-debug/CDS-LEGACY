function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseLooseJson(value: string) {
  const attempts = [
    value,
    value.replace(/,\s*([}\]])/g, "$1"),
    value
      .replace(/,\s*([}\]])/g, "$1")
      .replace(/(["}\]])\s*(\r?\n\s*")(?=[^"\n]+":)/g, "$1,$2")
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
}

export function extractJsonObject(text: string): unknown {
  const trimmed = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return parseLooseJson(trimmed);
  } catch {
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return parseLooseJson(trimmed.slice(firstBrace, lastBrace + 1));
    }

    throw new Error("The AI response did not contain a JSON object.");
  }
}

export function getResponseText(response: unknown): string {
  if (isRecord(response) && typeof response.output_text === "string") {
    return response.output_text;
  }

  if (!isRecord(response) || !Array.isArray(response.output)) {
    return "";
  }

  const parts: string[] = [];

  for (const outputItem of response.output) {
    if (!isRecord(outputItem) || !Array.isArray(outputItem.content)) {
      continue;
    }

    for (const contentItem of outputItem.content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      if (typeof contentItem.text === "string") {
        parts.push(contentItem.text);
      }
    }
  }

  return parts.join("\n").trim();
}
