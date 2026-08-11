import type { GeneratedLesson, LessonInput } from "./schemas";
import type { ResolvedGammaProvider } from "./admin-db";
import { saveGammaCreditState } from "./gamma-credits";

type GammaCreateResponse = {
  generationId?: string;
  warnings?: string | string[];
  message?: string;
  statusCode?: number;
  error?: { message?: string; statusCode?: number; details?: unknown };
  errors?: unknown;
  details?: unknown;
};

type GammaStatusResponse = {
  generationId?: string;
  status?: "pending" | "running" | "completed" | "failed" | string;
  gammaId?: string;
  gammaUrl?: string;
  exportUrl?: string;
  error?: { message?: string; statusCode?: number };
  credits?: { deducted?: number; remaining?: number };
};

type GammaThemeResponse = {
  data?: { id?: string; name?: string; type?: string }[];
  hasMore?: boolean;
  nextCursor?: string | null;
  error?: { message?: string; statusCode?: number };
  message?: string;
};

const gammaThemeCache = new Map<string, string>();

export type GammaPresentationResult = {
  generationId: string;
  status: "pending" | "running" | "completed";
  gammaId?: string;
  gammaUrl?: string;
  exportUrl?: string;
  credits?: { deducted?: number; remaining?: number };
  warnings?: string | string[];
  message?: string;
};

function baseUrl(override?: string) {
  return (override || process.env.GAMMA_API_BASE_URL || "https://public-api.gamma.app/v1.0").replace(/\/$/, "");
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pptTheme(input: LessonInput) {
  return (input.pptTheme || "Basic Light").trim();
}

function pptImageModel(input: LessonInput) {
  return (input.pptImageModel || "imagen-4-fast").trim();
}

function pptImageStylePreset(input: LessonInput) {
  return (input.pptImageStylePreset || "3D").trim();
}

function pptImageModelLabel(model: string) {
  const labels: Record<string, string> = {
    "imagen-4-fast": "Imagen 4 Fast",
    "flux-2-klein": "Flux 2 Fast",
    "flux-kontext-fast": "Flux Kontext Fast",
    "ideogram-v3-turbo": "Ideogram 3 Turbo",
    "recraft-v4": "Recraft V4",
    "luma-photon-flash-1": "Luma Photon Flash"
  };
  return labels[model] || model;
}

type GammaImageStyleConfig = {
  stylePreset: "photorealistic" | "illustration" | "abstract" | "3D" | "lineArt" | "custom";
  style: string;
  label: string;
};

function pptImageStyleConfig(styleKey: string): GammaImageStyleConfig {
  const configs: Record<string, GammaImageStyleConfig> = {
    photo: {
      stylePreset: "photorealistic",
      style: "professional realistic classroom photography, natural lighting, authentic learners, clean educational setting",
      label: "Photo - professional realistic classroom photography"
    },
    scene: {
      stylePreset: "custom",
      style: "scenic educational visuals, immersive real-world setting, contextual learning environment, polished classroom presentation image",
      label: "Scene - immersive real-world learning contexts"
    },
    cinematic: {
      stylePreset: "custom",
      style: "cinematic realistic educational scenes, dramatic but natural lighting, story-based classroom context, high depth and atmosphere",
      label: "Cinematic - story-driven realistic educational scenes"
    },
    "3D": {
      stylePreset: "3D",
      style: "friendly 3D rendered classroom objects, icons, learning tools, clean product-like lighting",
      label: "3D - friendly rendered education objects and icons"
    },
    illustration: {
      stylePreset: "illustration",
      style: "modern educational illustration, scenic classroom visuals, clean linework, flat colors, approachable characters",
      label: "Illustration - scenic modern education illustration"
    },
    technicalLine: {
      stylePreset: "lineArt",
      style: "technical line art, clean diagrams, instructional labels, workflow steps, formula visuals, high readability",
      label: "Technical Line - diagrams, steps, and formula visuals"
    },
    editorial: {
      stylePreset: "custom",
      style: "editorial lifestyle photography for education, clean magazine-style objects, realistic products, warm daylight, polished composition",
      label: "Magazine - polished lifestyle and object photography"
    },
    lineArt: {
      stylePreset: "lineArt",
      style: "minimal pictographic line art, clean diagrams, workflow steps, formula visuals, high readability",
      label: "Line Art - minimal diagrams and pictographic steps"
    }
  };
  return configs[styleKey] || configs.photo;
}

function pptImageStyleLabel(styleKey: string) {
  return pptImageStyleConfig(styleKey).label;
}

function pptImageStyleDirection(styleKey: string) {
  return pptImageStyleConfig(styleKey).style;
}

function gammaLanguage(input: LessonInput) {
  if (input.language === "Filipino") return "tl";
  return "en";
}

function pptThemeInstructions(theme: string) {
  const themes: Record<string, string> = {
    "Basic Light": "Use a Basic Light classroom theme: clean white canvas, soft blue accents, rounded content cards, readable typography, and minimal distraction.",
    "Rush": "Use a Rush-style deck: bold red-orange gradients, energetic section dividers, strong callout cards, and classroom activity momentum.",
    "Borealis": "Use a Borealis-style deck: dark navy cards, cyan and teal glow accents, elegant contrast, and projector-friendly readability.",
    "Cornfield": "Use a Cornfield-style deck: warm yellow-gold accents, friendly cards, soft contrast, and inviting classroom visuals.",
    "Daydream": "Use a Daydream-style deck: soft pastel gradients, airy layouts, frosted cards, calm blue-lavender accents, and modern classroom readability.",
    "Terracotta": "Use a Terracotta-style deck: warm neutral canvas, clay and blush accents, classic typography, soft shadows, and polished professional cards."
  };
  return themes[theme] || `Use the selected theme style: ${theme}.`;
}

function themeEnvKey(theme: string) {
  return `GAMMA_THEME_ID_${theme.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
}

function normalizeThemeName(theme: string) {
  return theme.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

async function findGammaThemeIdByName(theme: string, apiKey: string, apiBaseUrl?: string) {
  const normalizedTheme = normalizeThemeName(theme);
  if (!normalizedTheme) return "";

  const cachedThemeId = gammaThemeCache.get(normalizedTheme);
  if (cachedThemeId) return cachedThemeId;

  try {
    const response = await fetch(`${baseUrl(apiBaseUrl)}/themes?query=${encodeURIComponent(theme)}&limit=50`, {
      method: "GET",
      headers: {
        "X-API-KEY": apiKey,
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) return "";

    const body = await readJson<GammaThemeResponse>(response);
    const themes = body.data || [];
    const exact = themes.find((item) => item.id && normalizeThemeName(item.name || "") === normalizedTheme);
    const loose = exact || themes.find((item) => item.id && normalizeThemeName(item.name || "").includes(normalizedTheme));
    const themeId = loose?.id?.trim() || "";

    if (themeId) {
      gammaThemeCache.set(normalizedTheme, themeId);
    }

    return themeId;
  } catch {
    return "";
  }
}

async function gammaThemeId(theme: string, apiKey: string, apiBaseUrl?: string) {
  if (theme.startsWith("themeId:")) return theme.slice("themeId:".length).trim();
  const key = themeEnvKey(theme);
  const configuredThemeId = process.env[key]?.trim() || process.env.GAMMA_THEME_ID?.trim() || "";

  if (configuredThemeId) return configuredThemeId;

  return findGammaThemeIdByName(theme, apiKey, apiBaseUrl);
}

function cleanLine(value: string | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function bulletList(values: string[] | undefined, fallback = "Teacher-reviewed item from the approved lesson plan") {
  const cleaned = (values || []).map(cleanLine).filter(Boolean);
  const items = cleaned.length > 0 ? cleaned : [fallback];
  return items.map((item) => `- ${item}`).join("\n");
}

function sessionObjectivesBlock(lesson: GeneratedLesson) {
  return lesson.sessions
    .map(
      (session) => `Session ${session.sessionNumber}: ${session.label}
Session Objectives:
${bulletList(session.learningObjectives, "Use the approved learning objective from the lesson plan.")}`
    )
    .join("\n\n");
}

function sessionOutline(lesson: GeneratedLesson) {
  return lesson.sessions
    .map(
      (session) => `Session ${session.sessionNumber}: ${session.label}
Session Objectives:
${bulletList(session.learningObjectives, "Use the approved learning objective from the lesson plan.")}
Pre-Lesson: ${session.preLesson}
Flow: ${session.flow.join(" | ")}
Assessment: ${session.formativeAssessment.join(" | ")}
Extended Learning: ${session.extendedLearning}`
    )
    .join("\n\n");
}

function sessionDeckPlan(lesson: GeneratedLesson, targetCards: number) {
  const sessionCount = Math.max(1, lesson.sessions.length);
  const remainingAfterCore = Math.max(0, targetCards - 4);
  const cardsPerSession = Math.max(2, Math.floor(remainingAfterCore / sessionCount));

  const sessionCards = lesson.sessions
    .map((session) => {
      const firstFlow = session.flow.slice(0, Math.max(1, cardsPerSession - 2));
      return `Session ${session.sessionNumber} slide group: "${session.label}"
- Session opener: show the exact title "Session ${session.sessionNumber}: ${session.label}".
- Session Objectives slide: use the exact heading "Session Objectives" and copy these objective bullets exactly:
${bulletList(session.learningObjectives, "Use the approved learning objective from the lesson plan.")}
- Lesson flow slides: convert these lesson-plan activities into student-facing slides without changing the sequence: ${firstFlow.join(" | ")}
- Quick check / assessment slide: ${session.formativeAssessment.slice(0, 2).map(cleanLine).filter(Boolean).join(" | ") || "Use the formative assessment in the approved lesson plan."}`;
    })
    .join("\n\n");

  return `Required slide blueprint for alignment with the generated Lesson Plan:
1. Title slide: title, learning area, grade/section, term/week.
2. Lesson overview / learning roadmap: show how Plan, Practice, and Present connect.
3. Overall Session Objectives: include the exact objectives for each session from the lesson plan.
${sessionCards}
Final slides: performance task / synthesis, reflection or exit ticket, and references.

Do not omit the Session Objectives. Do not replace the lesson-plan objectives with generic objectives. Keep the slide sequence aligned with the lesson plan flow.`;
}

export function buildGammaInputText(input: LessonInput, lesson: GeneratedLesson) {
  const sourceNames = input.references || lesson.references || "Teacher-provided form inputs and uploaded source materials";
  const sourceExcerpts = (input.sourceMaterials || "").slice(0, 70000);
  const selectedTheme = pptTheme(input);
  const selectedPageCount = Math.max(5, Math.min(60, Number(input.pptPageCount || 20)));
  const selectedImageModel = pptImageModel(input);
  const selectedImageStyle = pptImageStylePreset(input);

  return `Create a creative, modern, interactive PowerPoint-style classroom presentation for this lesson plan.

Presentation title:
${lesson.title}

Learning area and level:
${lesson.learningArea} | ${lesson.gradeLevelSection} | ${lesson.term} ${lesson.week}

Teaching dates and duration:
${lesson.teachingDates || input.teachingDates} | ${lesson.sessions.length} session(s), ${input.sessionDurationMinutes || 60} minutes each

Core competency:
${lesson.learningCompetency}

Content standard:
${lesson.contentStandard || input.contentStandard}

Performance standard:
${lesson.performanceStandard || input.performanceStandard}

Source references to respect:
${sourceNames}

Selected PPT theme, page count, and image direction:
Theme: ${selectedTheme}
Target pages/slides/cards: ${selectedPageCount}
Theme direction: ${pptThemeInstructions(selectedTheme)}
AI image model: ${pptImageModelLabel(selectedImageModel)} (${selectedImageModel})
AI image type/style: ${pptImageStyleLabel(selectedImageStyle)} (${selectedImageStyle})

Exact Session Objectives from the approved Lesson Plan:
${sessionObjectivesBlock(lesson)}

${sessionDeckPlan(lesson, selectedPageCount)}

Required deck design:
- Use a clean, professional, modern education design.
- Make it easy to visualize with large readable fonts.
- Use visual aids, icons, graphics, diagrams, formula cards, comparison cards, arrows, and simple tables.
- Use a 16:9 layout.
- Avoid crowded paragraphs.
- Use short learner-facing slide text.
- Include interactive slides such as Stand and Vote, Think-Pair-Share, Number Relay, Quick Check, Exit Ticket, and Performance Task Mission.
- Organize by session with clear section opener slides.
- Include worked examples and guided practice aligned with the lesson plan and uploaded sources.
- Include formulas and computation steps when relevant.
- Include one wrap-up/reflection slide and one references slide.

Recommended slide structure:
1. Title slide
2. Learning roadmap for all sessions
3. Overall Session Objectives slide using exact objectives from the lesson plan
4. For each session: Session opener, Session Objectives, lesson flow/practice, and quick check
5. Final synthesis/performance task, reflection or exit ticket, and references

Session-by-session lesson flow from the approved Lesson Plan:
${sessionOutline(lesson)}

Uploaded source excerpts for grounding:
${sourceExcerpts || "No uploaded source text provided."}`;
}

function gammaHeaders(apiKey: string) {
  return {
    "Content-Type": "application/json",
    "X-API-KEY": apiKey
  };
}

function gammaApiKey(providerOptions?: Partial<ResolvedGammaProvider>) {
  const apiKey = providerOptions?.apiKey || process.env.GAMMA_API_KEY;
  if (!apiKey) {
    throw new Error("PPT generation service is not configured. Add a Gamma API key in Admin Settings before generating PPT.");
  }
  return apiKey;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(`PPT generation service returned a non-JSON response: ${text.slice(0, 240)}`);
  }
}

function compactDetails(value: unknown) {
  if (!value) return "";
  if (typeof value === "string") return value.slice(0, 500);
  try {
    return JSON.stringify(value).slice(0, 500);
  } catch {
    return "";
  }
}

function gammaCreateErrorMessage(body: GammaCreateResponse, status: number) {
  const base = body.error?.message || body.message || `PPT service API request failed with status ${status}.`;
  const detail = compactDetails(body.error?.details || body.details || body.errors);
  return detail ? `${base} Details: ${detail}` : base;
}

function toResult(generationId: string, latest: GammaStatusResponse, warnings?: string | string[]): GammaPresentationResult {
  const status = latest.status === "completed" && latest.exportUrl ? "completed" : latest.status === "running" || latest.status === "completed" ? "running" : "pending";
  return {
    generationId,
    status,
    gammaId: latest.gammaId,
    gammaUrl: latest.gammaUrl,
    exportUrl: latest.exportUrl,
    credits: latest.credits,
    warnings
  };
}

async function getRawGammaStatus(generationId: string, providerOptions?: Partial<ResolvedGammaProvider>) {
  const apiKey = gammaApiKey(providerOptions);
  const response = await fetch(`${baseUrl(providerOptions?.baseURL)}/generations/${encodeURIComponent(generationId)}`, {
    method: "GET",
    headers: gammaHeaders(apiKey),
    cache: "no-store"
  });
  const body = await readJson<GammaStatusResponse>(response);

  if (!response.ok) {
    throw new Error(body.error?.message || `PPT generation status check failed with status ${response.status}.`);
  }

  if (body.status === "failed") {
    throw new Error(body.error?.message || "PPT presentation generation failed.");
  }

  if (body.credits) {
    const savedCredits = await saveGammaCreditState(body.credits, generationId);
    body.credits = {
      deducted: savedCredits.lastDeducted ?? body.credits.deducted,
      ...(typeof savedCredits.remaining === "number" ? { remaining: savedCredits.remaining } : {})
    };
  }

  return body;
}

export async function getGammaPresentationStatus(generationId: string, providerOptions?: Partial<ResolvedGammaProvider>): Promise<GammaPresentationResult> {
  const trimmedId = generationId.trim();
  if (!trimmedId) throw new Error("Missing PPT generation ID.");
  const latest = await getRawGammaStatus(trimmedId, providerOptions);
  return toResult(trimmedId, latest);
}

async function pollGammaPresentation(generationId: string, attempts: number, intervalMs: number, warnings?: string | string[], providerOptions?: Partial<ResolvedGammaProvider>) {
  const safeAttempts = Math.max(0, Math.min(60, Number.isFinite(attempts) ? Math.floor(attempts) : 0));
  const safeIntervalMs = Math.max(1500, Math.min(10000, Number.isFinite(intervalMs) ? intervalMs : 5000));
  let latest: GammaStatusResponse = { generationId, status: "pending" };

  if (safeAttempts === 0) {
    return {
      generationId,
      status: "pending",
      warnings,
      message:
        "AI accepted the PPT job. This app will keep checking until the PPTX download link is ready."
    } satisfies GammaPresentationResult;
  }

  for (let attempt = 0; attempt < safeAttempts; attempt += 1) {
    await wait(safeIntervalMs);
    latest = await getRawGammaStatus(generationId, providerOptions);

    if (latest.status === "completed" && latest.exportUrl) {
      return toResult(generationId, latest, warnings);
    }
  }

  return {
    ...toResult(generationId, latest, warnings),
    message: `AI is still generating this PPT. This app will keep checking until the PPTX download link is ready.`
  } satisfies GammaPresentationResult;
}

export async function generateGammaPresentation(input: LessonInput, lesson: GeneratedLesson, providerOptions?: Partial<ResolvedGammaProvider>): Promise<GammaPresentationResult> {
  const apiKey = gammaApiKey(providerOptions);
  const sessionCount = Math.min(5, Math.max(1, input.sessionCount || lesson.sessions.length || 5));
  const defaultCards = Math.max(18, Math.min(45, sessionCount * 8));
  const requestedCards = Number(input.pptPageCount || process.env.GAMMA_DEFAULT_NUM_CARDS || defaultCards);
  const numCards = Math.max(5, Math.min(60, Number.isFinite(requestedCards) ? Math.floor(requestedCards) : defaultCards));
  const selectedTheme = pptTheme(input);
  const selectedThemeId = await gammaThemeId(selectedTheme, apiKey, providerOptions?.baseURL);
  const selectedImageModel = pptImageModel(input);
  const selectedImageStyle = pptImageStylePreset(input);
  const imageStyleConfig = pptImageStyleConfig(selectedImageStyle);
  const waitForExportOnServer = (process.env.GAMMA_WAIT_FOR_EXPORT_ON_SERVER || "false").toLowerCase() === "true";
  const pollAttempts = waitForExportOnServer ? Number(process.env.GAMMA_POLL_ATTEMPTS || 48) : 0;
  const pollIntervalMs = Number(process.env.GAMMA_POLL_INTERVAL_MS || 5000);
  const url = `${baseUrl(providerOptions?.baseURL)}/generations`;

  const baseRequestBody = {
    inputText: buildGammaInputText(input, lesson),
    additionalInstructions:
      `Generate a polished classroom presentation that strictly follows the approved lesson plan. Include an explicit slide/section titled "Session Objectives" and copy the lesson-plan objectives exactly before the learning activities for each session. Do not omit objectives and do not invent unrelated objectives. Keep the deck sequence aligned with the lesson plan: overview, session objectives, lesson flow, practice, quick check, synthesis, reflection, and references. Use large fonts, clean layouts, visual aids, icons, diagrams, formula cards, interactive prompts, worked examples, and student-friendly language. Use ${pptImageStyleDirection(selectedImageStyle)} consistently for all AI-generated images. Export as editable PPTX. ${pptThemeInstructions(selectedTheme)} Return only a fully generated PPTX export.`,
    textMode: "generate",
    format: "presentation",
    numCards,
    cardSplit: "auto",
    textOptions: {
      amount: "medium",
      tone: "professional",
      audience: "Senior High School learners",
      language: gammaLanguage(input)
    },
    cardOptions: {
      dimensions: "16x9"
    },
    exportAs: "pptx"
  };

  const imageOptions = {
    source: "aiGenerated",
    model: selectedImageModel,
    stylePreset: imageStyleConfig.stylePreset,
    ...(imageStyleConfig.stylePreset === "custom" ? { style: imageStyleConfig.style } : {})
  };

  const selectedThemeOption = selectedThemeId ? { themeId: selectedThemeId } : {};
  const requestBody = {
    ...baseRequestBody,
    ...selectedThemeOption,
    imageOptions
  };

  async function createGeneration(body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: gammaHeaders(apiKey),
      body: JSON.stringify(body)
    });
    const parsed = await readJson<GammaCreateResponse>(response);
    return { response, parsed };
  }

  const imageOptionsWithoutModel = {
    source: "aiGenerated",
    stylePreset: imageStyleConfig.stylePreset,
    ...(imageStyleConfig.stylePreset === "custom" ? { style: imageStyleConfig.style } : {})
  };

  const compactBaseRequestBody = {
    ...baseRequestBody,
    numCards: Math.min(numCards, 20)
  };

  const createAttempts = [
    {
      label: "selected theme, selected image model, and selected image style",
      body: requestBody
    },
    {
      label: "selected theme, selected image style, and automatic image model",
      body: {
        ...baseRequestBody,
        ...selectedThemeOption,
        imageOptions: imageOptionsWithoutModel
      }
    },
    {
      label: "selected theme with automatic AI image settings",
      body: {
        ...baseRequestBody,
        ...selectedThemeOption,
        imageOptions: { source: "aiGenerated" }
      }
    },
    {
      label: "compact selected-theme request with automatic AI images",
      body: {
        ...compactBaseRequestBody,
        ...selectedThemeOption,
        imageOptions: { source: "aiGenerated" }
      }
    },
    {
      label: "selected image style with automatic model and workspace default theme",
      body: {
        ...baseRequestBody,
        imageOptions: imageOptionsWithoutModel
      }
    },
    {
      label: "compact 20-slide request with default visual settings",
      body: compactBaseRequestBody
    }
  ];

  let createResponse: Response | undefined;
  let created: GammaCreateResponse = {};
  const fallbackWarnings: string[] = [];

  for (let index = 0; index < createAttempts.length; index += 1) {
    const attempt = createAttempts[index];
    const result = await createGeneration(attempt.body);
    createResponse = result.response;
    created = result.parsed;

    if (createResponse.ok && created.generationId) {
      if (index > 0) {
        fallbackWarnings.push(
          `Initial PPT request was retried using ${attempt.label} because the PPT service rejected an advanced visual parameter or card setting.`
        );
      }
      break;
    }

    if (createResponse.status !== 400) {
      break;
    }
  }

  if (!createResponse || !createResponse.ok || !created.generationId) {
    throw new Error(gammaCreateErrorMessage(created, createResponse?.status || 500));
  }

  const generationId = created.generationId;

  if (fallbackWarnings.length > 0) {
    created = {
      ...created,
      warnings: [
        ...(Array.isArray(created.warnings) ? created.warnings : created.warnings ? [created.warnings] : []),
        ...fallbackWarnings
      ]
    };
  }

  return pollGammaPresentation(generationId, pollAttempts, pollIntervalMs, created.warnings, providerOptions);
}
