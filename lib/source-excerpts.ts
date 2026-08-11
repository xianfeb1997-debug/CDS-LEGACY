const KEY_LINE_PATTERN =
  /\b(learning\s+competenc|content\s+standard|performance\s+standard|objective|lesson|topic|day\s*\d+|session\s*\d+|activity|assessment|resource|module|quarter|week|formula|example|practice|evaluation)\b/i;

export function cleanSourceText(value: string) {
  return value
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

function trimToBoundary(value: string, maxChars: number) {
  if (value.length <= maxChars) return value.trim();

  const boundary = value.lastIndexOf(" ", maxChars);
  const end = boundary > maxChars * 0.75 ? boundary : maxChars;
  return value.slice(0, end).trim();
}

function sliceWindow(value: string, start: number, maxChars: number) {
  const safeStart = Math.max(0, Math.min(start, Math.max(0, value.length - maxChars)));
  let from = safeStart;
  let to = Math.min(value.length, safeStart + maxChars);

  if (from > 0) {
    const nextSpace = value.indexOf(" ", from);
    if (nextSpace > -1 && nextSpace < from + 80) {
      from = nextSpace + 1;
    }
  }

  if (to < value.length) {
    const previousSpace = value.lastIndexOf(" ", to);
    if (previousSpace > from + maxChars * 0.65) {
      to = previousSpace;
    }
  }

  return value.slice(from, to).trim();
}

function importantLines(value: string, maxChars: number) {
  if (maxChars < 300) return "";

  const selected: string[] = [];
  const seen = new Set<string>();
  let used = 0;

  for (const rawLine of value.split(/\n+/)) {
    const line = rawLine.trim();
    if (line.length < 12 || !KEY_LINE_PATTERN.test(line)) continue;

    const clipped = trimToBoundary(line, 600);
    const key = clipped.toLowerCase();
    if (seen.has(key)) continue;

    if (used + clipped.length + 1 > maxChars) break;
    seen.add(key);
    selected.push(clipped);
    used += clipped.length + 1;
  }

  return selected.join("\n");
}

function balancedExcerpt(value: string, maxChars: number) {
  if (value.length <= maxChars) return value;
  if (maxChars < 900) return trimToBoundary(value, maxChars);

  const labels =
    maxChars >= 8000
      ? ["Beginning excerpt", "Earlier middle excerpt", "Later middle excerpt", "Ending excerpt"]
      : ["Beginning excerpt", "Middle excerpt", "Ending excerpt"];
  const separator = "\n\n[...]\n\n";
  const labelOverhead = labels.reduce((total, label) => total + label.length + 2, 0);
  const available = Math.max(600, maxChars - labelOverhead - separator.length * (labels.length - 1));
  const windowSize = Math.max(350, Math.floor(available / labels.length));
  const starts =
    labels.length === 4
      ? [0, Math.floor(value.length * 0.33), Math.floor(value.length * 0.66), value.length - windowSize]
      : [0, Math.floor(value.length * 0.5), value.length - windowSize];

  const pieces = labels.map((label, index) => {
    const excerpt = sliceWindow(value, starts[index], windowSize);
    return `${label}:\n${excerpt}`;
  });

  return trimToBoundary(pieces.join(separator), maxChars);
}

export function buildSourceExcerpt(value: string, maxChars: number) {
  const text = cleanSourceText(value);
  if (!text || text.length <= maxChars) return text;

  const keyBudget = Math.min(3000, Math.floor(maxChars * 0.28));
  const keyLines = importantLines(text, keyBudget);
  const keyBlock = keyLines ? `Key detected lines from the full document:\n${keyLines}` : "";
  const remaining = Math.max(900, maxChars - keyBlock.length - (keyBlock ? 4 : 0));
  const balancedBlock = `Balanced excerpts from the full document:\n${balancedExcerpt(text, remaining)}`;

  return trimToBoundary([keyBlock, balancedBlock].filter(Boolean).join("\n\n"), maxChars);
}
