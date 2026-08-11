import OpenAI from "openai";
import { z } from "zod";
import { buildFallbackLesson } from "./fallback";
import { extractJsonObject, getResponseText } from "./json";
import {
  GeneratedLessonSchema,
  type GeneratedLesson,
  type LessonInput,
  type SessionPlan
} from "./schemas";
import { OFFICIAL_TEMPLATE_NARRATIVES } from "./template-constants";

type ReasoningEffort = "low" | "medium" | "high";

type PreviewLessonInput = LessonInput & {
  reasoningEffort?: ReasoningEffort;
};

type ProviderOptions = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
};

type ProviderError = { status?: unknown };

const LooseSessionSchema = z.object({
  sessionNumber: z.coerce.number().int().min(1).max(5).optional(),
  label: z.string().optional().default(""),
  learningObjectives: z.array(z.string()).optional().default([]),
  preLesson: z.string().optional().default(""),
  flow: z.array(z.string()).optional().default([]),
  learningResources: z.string().optional().default(""),
  integration: z.string().optional().default(""),
  formativeAssessment: z.array(z.string()).optional().default([]),
  extendedLearning: z.string().optional().default(""),
  reflectionPrompt: z.string().optional().default("")
}).passthrough();

const LooseLessonSchema = z.object({
  title: z.string().optional().default(""),
  learnerContext: z.string().optional().default(""),
  sessions: z.array(LooseSessionSchema).optional().default([])
}).passthrough();

const SYSTEM_PROMPT = `You are a senior Philippine curriculum designer and classroom teacher who creates teacher-reviewed ILAW lesson plans.

Your work must be subject-general. Never assume Mathematics, Science, English, or any other discipline before reading the teacher's Learning Area, grade level, competency, standards, topic, and uploaded source excerpts.

Use discipline-authentic pedagogy:
- Languages: comprehension, vocabulary/language use, speaking/listening, authentic reading and writing, feedback and revision when appropriate.
- Mathematics: representations, conceptual understanding, worked examples, mathematical reasoning, guided practice, problem solving, and error analysis when appropriate.
- Science: inquiry, observation, evidence, models, investigation, data interpretation, scientific explanation, and safety when appropriate.
- Araling Panlipunan/social sciences: primary/secondary sources, chronology, geography, cause-effect, perspective, evidence, civic reasoning, and discussion when appropriate.
- TLE/TVL: demonstration, procedural accuracy, tool/material safety, quality criteria, authentic products or performance, troubleshooting, and workplace relevance.
- MAPEH/Arts/PE: technique, practice/rehearsal, movement or performance, critique, wellness, creativity, and safe participation as appropriate.
- Values/GMRC/EsP: ethical situations, dialogue, perspective-taking, reflection, values-based decisions, and observable application.
- Research/ICT: inquiry, information literacy, data, digital tools, source evaluation, process documentation, and authentic products.
- Other subjects: infer the most authentic disciplinary practices from the competency and standards.

Do not force formulas, computation, experiments, essays, role-play, group work, technology, or performance tasks unless they genuinely fit the competency.

Teacher-entered Learning Competency, Content Standard, and Performance Standard are authoritative. Uploaded source text can enrich examples and activities but cannot override official teacher-entered curriculum fields.

Before answering, silently perform these design checks:
1. Parse every competency item and distribute the complete set across exactly the selected number of sessions.
2. Unpack each assigned competency focus into appropriate Knowledge, Skills, and Attitudes/Values.
3. Sequence objectives and evidence using suitable cognitive demand and Revised Bloom's Taxonomy where applicable.
4. Choose pedagogy authentic to the actual subject.
5. Build a realistic time budget for every session.
6. Include modeling/input, guided support, learner application, checking for understanding, feedback, inclusion/accommodation, assessment evidence, and closure in forms appropriate to the subject.
7. Verify that the final selected session synthesizes the complete selected-session sequence and gathers sufficient evidence of learning.
8. Verify alignment among competency, objective, learning experience, assessment, and ways forward.

Return JSON only.`;

function reasoningEffort(input: PreviewLessonInput): ReasoningEffort {
  return input.reasoningEffort || "medium";
}

function isGeminiProvider(model: string, baseURL: string) {
  return /gemini/i.test(model) || /generativelanguage\.googleapis\.com/i.test(baseURL);
}

function providerMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function providerStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? (error as ProviderError).status
    : undefined;
}

function unsupportedJsonMode(error: unknown) {
  return /response_format|json_object|unsupported|unknown field|invalid argument/i.test(providerMessage(error));
}

function unsupportedReasoning(error: unknown) {
  return /reasoning_effort|reasoning.*unsupported|unsupported.*reasoning|thinking.*unsupported/i.test(providerMessage(error));
}

function trim(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => trim(item)).filter(Boolean)
    : [];
}

function outputLimits(depth: LessonInput["outputDepth"]) {
  switch (depth) {
    case "Concise":
      return { objectives: 1, flow: 3, assessment: 3 };
    case "Short":
      return { objectives: 1, flow: 4, assessment: 3 };
    case "Comprehensive":
      return { objectives: 3, flow: 7, assessment: 6 };
    case "Detailed":
    default:
      return { objectives: 1, flow: 5, assessment: 4 };
  }
}

function stripTimingPrefix(value: string) {
  return value
    .replace(/^\s*\[?\d+\s*(?:min|mins|minutes?)\]?\s*(?:[-–—:|]\s*)?/i, "")
    .trim();
}

function ensureTimedFlow(values: string[], fallback: string[], durationMinutes: number, maxItems: number) {
  const source = (values.length ? values : fallback)
    .map(stripTimingPrefix)
    .filter(Boolean)
    .slice(0, Math.max(3, maxItems));

  while (source.length < 3) {
    const fallbackItem = stripTimingPrefix(fallback[source.length] || `Learning step ${source.length + 1}`);
    source.push(fallbackItem);
  }

  const count = source.length;
  const base = Math.floor(durationMinutes / count);
  let remainder = durationMinutes - base * count;

  return source.map((item) => {
    const minutes = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return `${minutes} min — ${item}`;
  });
}

function mergeItems(primary: string[], fallback: string[], min: number, max: number) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of [...primary, ...fallback]) {
    const clean = item.trim();
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= max) break;
  }

  while (result.length < min && fallback[result.length]) {
    result.push(fallback[result.length]);
  }

  return result.slice(0, max);
}

function composeStandards(input: LessonInput) {
  return `Content Standard:\n${input.contentStandard.trim()}\n\nPerformance Standard:\n${input.performanceStandard.trim()}`;
}

function buildPrompt(input: PreviewLessonInput) {
  const sessionCount = Math.min(5, Math.max(1, Number(input.sessionCount || 5)));
  const duration = Math.min(240, Math.max(10, Number(input.sessionDurationMinutes || 60)));
  const sourceText = input.sourceMaterials?.trim() || "";

  return `Create the fillable content for an ILAW lesson plan.

NON-NEGOTIABLE PACING
- The teacher selected exactly ${sessionCount} session(s). Return exactly ${sessionCount} session objects and no additional days.
- Each session is exactly ${duration} minutes.
- If the teacher selected 3 sessions, the complete sequence must fit three ${duration}-minute sessions; do not assume Day 4 or Day 5 exists.
- Silently allocate the complete ${duration} minutes before writing each session. Flow items should include realistic time allocations. The application will normalize the final Flow so its minute totals equal exactly ${duration} minutes.
- Treat pre-lesson/readiness as part of the same class period, not extra time outside the ${duration} minutes.
- Distribute every teacher-provided competency across the ${sessionCount} sessions without dropping, postponing, or inventing competencies.
- Make the final selected session include synthesis plus sufficient evidence of learning.

SUBJECT AUTHENTICITY
- Design from the actual Learning Area and competency, not from a generic Mathematics template.
- Select tasks, examples, grouping, tools, resources, assessment evidence, and accommodations that make sense for this discipline and grade level.
- Do not invent exact textbook pages, curriculum codes, URLs, school details, or references.
- Use uploaded source excerpts only when relevant and never let them override teacher-entered standards.

QUALITY
- One measurable main objective per session for Concise/Short/Detailed. Comprehensive may include up to three tightly aligned objective phrases.
- Make objectives achievable within ${duration} minutes.
- Every session must include readiness/connection, teacher input or modeling appropriate to the discipline, guided support, learner application, checking for understanding, feedback, evidence of learning, and synthesis/closure. These may be combined when the duration is short.
- Include inclusive supports without lowering the competency target.
- Formative assessment must produce observable evidence directly tied to that session's assigned competency focus.
- Ways forward must follow from likely evidence: remediation, practice, enrichment, extension, or next-step adjustment.

OUTPUT DETAIL: ${input.outputDepth || "Detailed"}
LANGUAGE: ${input.language}

Return exactly this JSON shape:
{
  "title": "",
  "learnerContext": "",
  "sessions": [
    {
      "sessionNumber": 1,
      "label": "Day 1",
      "learningObjectives": ["observable objective phrase"],
      "preLesson": "",
      "flow": ["10 min — ..."],
      "learningResources": "",
      "integration": "",
      "formativeAssessment": [""],
      "extendedLearning": "",
      "reflectionPrompt": ""
    }
  ]
}

Teacher inputs:
${JSON.stringify({
    language: input.language,
    gradeLevelSection: input.gradeLevelSection,
    learningArea: input.learningArea,
    lessonTitle: input.lessonTitle,
    term: input.term,
    week: input.week,
    teachingDates: input.teachingDates,
    sessionCount,
    sessionDurationMinutes: duration,
    outputDepth: input.outputDepth,
    learningCompetency: input.learningCompetency,
    contentStandard: input.contentStandard,
    performanceStandard: input.performanceStandard,
    learnerContext: input.learnerContext,
    resourceNotes: input.resourceNotes,
    integrationNotes: input.integrationNotes,
    assessmentNotes: input.assessmentNotes,
    waysForwardNotes: input.waysForwardNotes,
    references: input.references
  }, null, 2)}

Uploaded supporting source excerpts:
${sourceText || "No uploaded source text provided."}`;
}

async function chatText(
  client: OpenAI,
  model: string,
  prompt: string,
  effort: ReasoningEffort,
  options: { jsonMode?: boolean; includeReasoning?: boolean } = {}
) {
  const request = {
    model,
    messages: [
      { role: "system" as const, content: SYSTEM_PROMPT },
      { role: "user" as const, content: prompt }
    ],
    ...(options.includeReasoning === false ? {} : { reasoning_effort: effort }),
    ...(options.jsonMode === false ? {} : { response_format: { type: "json_object" as const } })
  };

  const response = await client.chat.completions.create(request);
  return response.choices[0]?.message?.content || "";
}

async function generateText(client: OpenAI, model: string, baseURL: string, prompt: string, effort: ReasoningEffort) {
  if (isGeminiProvider(model, baseURL)) {
    try {
      return await chatText(client, model, prompt, effort);
    } catch (firstError) {
      if (unsupportedReasoning(firstError)) {
        return chatText(client, model, prompt, effort, { includeReasoning: false });
      }
      if (unsupportedJsonMode(firstError)) {
        try {
          return await chatText(client, model, prompt, effort, { jsonMode: false });
        } catch (retryError) {
          if (unsupportedReasoning(retryError)) {
            return chatText(client, model, prompt, effort, { jsonMode: false, includeReasoning: false });
          }
          throw retryError;
        }
      }
      throw firstError;
    }
  }

  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt }
      ],
      reasoning: { effort }
    });
    return getResponseText(response);
  } catch (responsesError) {
    try {
      return await chatText(client, model, prompt, effort);
    } catch (chatError) {
      if (unsupportedReasoning(chatError)) {
        return chatText(client, model, prompt, effort, { includeReasoning: false });
      }
      const status = providerStatus(responsesError) || providerStatus(chatError);
      throw new Error(
        `Preview AI generation failed.${status ? ` Provider status: ${status}.` : ""} Responses: ${providerMessage(responsesError)} Chat: ${providerMessage(chatError)}`
      );
    }
  }
}

function normalizeLesson(input: PreviewLessonInput, raw: unknown): GeneratedLesson {
  const parsed = LooseLessonSchema.parse(raw);
  const fallback = buildFallbackLesson(input);
  const sessionCount = Math.min(5, Math.max(1, Number(input.sessionCount || 5)));
  const duration = Math.min(240, Math.max(10, Number(input.sessionDurationMinutes || 60)));
  const limits = outputLimits(input.outputDepth || "Detailed");

  const sessions: SessionPlan[] = Array.from({ length: sessionCount }, (_, index) => {
    const sessionNumber = index + 1;
    const candidate = parsed.sessions.find((item) => item.sessionNumber === sessionNumber) || parsed.sessions[index];
    const base = fallback.sessions[index];

    const objectives = mergeItems(
      strings(candidate?.learningObjectives),
      base.learningObjectives,
      1,
      limits.objectives
    );
    const flow = ensureTimedFlow(
      strings(candidate?.flow),
      base.flow,
      duration,
      limits.flow
    );
    const assessments = mergeItems(
      strings(candidate?.formativeAssessment),
      base.formativeAssessment,
      Math.min(3, limits.assessment),
      limits.assessment
    );

    return {
      sessionNumber,
      label: `Day ${sessionNumber}`,
      learningObjectives: objectives,
      preLesson: trim(candidate?.preLesson) || base.preLesson,
      flow,
      learningResources: trim(candidate?.learningResources) || input.resourceNotes?.trim() || base.learningResources,
      integration: trim(candidate?.integration) || input.integrationNotes?.trim() || base.integration,
      formativeAssessment: assessments,
      extendedLearning: trim(candidate?.extendedLearning) || input.waysForwardNotes?.trim() || base.extendedLearning,
      reflectionPrompt: trim(candidate?.reflectionPrompt) || base.reflectionPrompt
    };
  });

  return GeneratedLessonSchema.parse({
    title: trim(parsed.title) || input.lessonTitle?.trim() || fallback.title,
    learningArea: input.learningArea,
    teacherName: input.teacherName,
    gradeLevelSection: input.gradeLevelSection,
    term: input.term,
    week: input.week,
    schoolYear: input.schoolYear,
    sessionLabels: sessions.map((session) => session.label),
    teachingDates: input.teachingDates,
    references: input.references?.trim() || "",
    aiUseDeclaration: input.aiUseDeclaration || fallback.aiUseDeclaration,
    intentionNarrative: OFFICIAL_TEMPLATE_NARRATIVES.intentions,
    learningCompetency: input.learningCompetency,
    contentStandard: input.contentStandard,
    performanceStandard: input.performanceStandard,
    curriculumStandards: composeStandards(input),
    learnerContext: trim(parsed.learnerContext) || input.learnerContext?.trim() || fallback.learnerContext,
    learningExperienceNarrative: OFFICIAL_TEMPLATE_NARRATIVES.learningExperience,
    assessmentNarrative: OFFICIAL_TEMPLATE_NARRATIVES.assessment,
    waysForwardNarrative: OFFICIAL_TEMPLATE_NARRATIVES.waysForward,
    sessions
  });
}

export async function generatePreviewLesson(
  input: PreviewLessonInput,
  provider: ProviderOptions
): Promise<{ lesson: GeneratedLesson; model: string; usedAI: true; reasoningEffort: ReasoningEffort }> {
  const apiKey = provider.apiKey || process.env.OPENAI_API_KEY || "";
  const model = provider.model || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = provider.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("AI generation is not configured. Add an API key in Admin or configure OPENAI_API_KEY.");
  }

  const effort = reasoningEffort(input);
  const client = new OpenAI({ apiKey, baseURL });
  const text = await generateText(client, model, baseURL, buildPrompt(input), effort);
  const lesson = normalizeLesson(input, extractJsonObject(text));

  return { lesson, model, usedAI: true, reasoningEffort: effort };
}
