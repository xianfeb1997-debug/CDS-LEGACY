export function normalizeSessionDurationMinutes(value: unknown) {
  const duration = Number(value || 60);
  if (!Number.isFinite(duration)) return 60;
  return Math.min(240, Math.max(10, Math.round(duration)));
}

export function formatSessionHeaderLabel(label: string, durationValue: unknown) {
  const duration = normalizeSessionDurationMinutes(durationValue);
  const cleanLabel = (label || "Day")
    .replace(/\s*\(\s*\d+\s*(?:m|min|mins|minute|minutes)\s*\)\s*$/i, "")
    .trim();

  return `${cleanLabel || "Day"} (${duration}m)`;
}

function canonicalIntegrationLabel(label: string) {
  const normalized = label.trim().toLowerCase();
  if (normalized === "ict") return "ICT";
  if (normalized === "values education") return "Values Education";
  if (normalized === "literacy") return "Literacy";
  if (normalized === "numeracy") return "Numeracy";
  if (normalized === "related learning areas") return "Related Learning Areas";
  return "Related Learning Area";
}

export function formatIntegrationText(value: string) {
  const text = value.trim();
  if (!text) return "";

  return text
    .replace(/[ \t\r\n]+/g, " ")
    .replace(
      /\b(ICT|Values Education|Literacy|Numeracy|Related Learning Areas?)\s*:/gi,
      (match, label: string, offset: number) =>
        `${offset === 0 ? "" : "\n"}${canonicalIntegrationLabel(label)}:`
    )
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

export function stripObjectiveTiming(value: string) {
  return value
    .replace(
      /\s*(?:This|The)\s+\d+\s*(?:-|\u2013|\u2014|\s)?\s*minute\s+(?:session|period|class|lesson)\s+[^.?!]*(?:[.?!]|$)/gi,
      " "
    )
    .replace(
      /\s*\b(?:within|during|in|for)\s+(?:the\s+|a\s+|an\s+)?\d+\s*(?:-|\u2013|\u2014|\s)?\s*minute\s+(?:session|period|class|lesson)\b/gi,
      ""
    )
    .replace(/\s*\b(?:within|during|for)\s+(?:the\s+)?(?:selected|given|allotted)\s+session\b/gi, "")
    .replace(/\s*\b(?:within|during|for)\s+(?:the\s+)?session\b/gi, "")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .replace(/[,:;]\s*$/g, "")
    .trim();
}

export function cleanObjectiveText(value: string, sessionNumber?: number) {
  let cleaned = value.replace(/^\s*[-*\u2022\u25cf\u25aa]\s*/, "");

  if (sessionNumber) {
    cleaned = cleaned.replace(
      new RegExp(
        `^\\s*by\\s+the\\s+end\\s+of\\s+(?:day|session)\\s*${sessionNumber}\\s*,?\\s*(?:the\\s+)?(?:learners?|students?|pupils?)\\s+(?:will|should|can)\\s+be\\s+able\\s+to\\s+`,
        "i"
      ),
      ""
    );
  }

  cleaned = stripObjectiveTiming(cleaned)
    .replace(
      /^\s*by\s+the\s+end\s+of\s+(?:the\s+)?(?:day|session)\s*,?\s*(?:the\s+)?(?:learners?|students?|pupils?)\s+(?:will|should|can)\s+be\s+able\s+to\s+/i,
      ""
    )
    .replace(/^\s*(?:the\s+)?(?:learners?|students?|pupils?)\s+(?:will|should|can)\s+be\s+able\s+to\s+/i, "")
    .replace(/^\s*be\s+able\s+to\s+/i, "")
    .replace(/^\s*to\s+/i, "");

  return stripObjectiveTiming(cleaned)
    .trim()
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}
