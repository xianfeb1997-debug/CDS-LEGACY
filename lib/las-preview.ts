import OpenAI from "openai";
import { z } from "zod";
import { extractJsonObject, getResponseText } from "./json";
import type { GeneratedLAS } from "./las";
import type { GeneratedLesson, LessonInput } from "./schemas";

type ReasoningEffort = "low" | "medium" | "high";

type PreviewLASInput = LessonInput & {
  reasoningEffort?: ReasoningEffort;
};

type ProviderOptions = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  lasHeaderDivision?: string;
  lasHeaderSchoolName?: string;
};

type ProviderError = { status?: unknown };

const LooseRubricSchema = z.object({
  criteria: z.string().optional().default(""),
  excellent: z.string().optional().default(""),
  satisfactory: z.string().optional().default(""),
  needsImprovement: z.string().optional().default("")
}).passthrough();

const LooseSessionSchema = z.object({
  sessionNumber: z.coerce.number().int().min(1).max(5).optional(),
  sessionTitle: z.string().optional().default(""),
  learningCompetencies: z.string().optional().default(""),
  objectives: z.array(z.string()).optional().default([]),
  letUsLearn: z.object({
    concept: z.string().optional().default(""),
    blueprint: z.array(z.string()).optional().default([]),
    models: z.array(z.string()).optional().default([])
  }).optional().default({ concept: "", blueprint: [], models: [] }),
  letUsTry: z.array(z.string()).optional().default([]),
  letUsDo: z.array(z.string()).optional().default([]),
  letUsApply: z.object({
    context: z.string().optional().default(""),
    output: z.string().optional().default(""),
    instructions: z.array(z.string()).optional().default([])
  }).optional().default({ context: "", output: "", instructions: [] }),
  rubric: z.array(LooseRubricSchema).optional().default([]),
  references: z.array(z.string()).optional().default([])
}).passthrough();

const LooseLASSchema = z.object({
  title: z.string().optional().default(""),
  sessions: z.array(LooseSessionSchema).optional().default([])
}).passthrough();

const SYSTEM_PROMPT = `You are an expert DepEd learning-materials designer. Create learner-facing Learning Activity Sheets that match the actual subject, grade level, competency, standards, lesson sequence, and allotted time.

Never default to Mathematics. Use discipline-authentic activity forms:
- Languages: reading, vocabulary/language use, listening/speaking, writing, revision, response to texts.
- Mathematics: representations, examples, reasoning, computation/problem solving, error analysis when relevant.
- Science: observation, inquiry, evidence, models, investigation planning, data interpretation, CER, safety when relevant.
- Araling Panlipunan/social sciences: source analysis, timeline/map work, cause-effect, perspective, evidence, civic reasoning.
- TLE/TVL: procedures, demonstrations, safety, quality checks, troubleshooting, authentic products/performance.
- MAPEH/Arts/PE: practice, technique, movement/performance, critique, wellness, creative production.
- Values/GMRC/EsP: ethical cases, dialogue, reflection, decisions, observable application.
- Research/ICT: inquiry, information literacy, data, digital tools, source evaluation, authentic outputs.
- Other subjects: infer the most authentic learner work from the competency and standards.

Do not force word problems, calculations, essays, experiments, role-play, or performance tasks when they do not fit.

The LAS must be feasible inside the teacher-selected number of sessions and session duration. It supports the lesson plan; it must not create extra days or extra competencies.

Return JSON only.`;

function reasoningEffort(input: PreviewLASInput): ReasoningEffort {
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

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanArray(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => clean(item)).filter(Boolean)
    : [];
}

function bounded(values: string[], fallback: string[], min: number, max: number) {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of [...values, ...fallback]) {
    const item = value.trim();
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= max) break;
  }

  let fallbackIndex = 0;
  while (result.length < min && fallback.length) {
    const candidate = fallback[fallbackIndex % fallback.length];
    fallbackIndex += 1;
    if (!result.includes(candidate)) result.push(candidate);
    if (fallbackIndex > fallback.length * 3) break;
  }

  return result.slice(0, max);
}

function referenceItems(input: LessonInput) {
  return (input.references || "")
    .split(/\r?\n/)
    .map((item) => item.replace(/^\s*\d+[.)]\s*/, "").trim())
    .filter(Boolean)
    .slice(0, 8);
}

function activityLimits(duration: number) {
  if (duration <= 30) return { tryMax: 3, doMax: 5, applySteps: 3 };
  if (duration <= 45) return { tryMax: 4, doMax: 6, applySteps: 4 };
  if (duration <= 60) return { tryMax: 5, doMax: 7, applySteps: 5 };
  return { tryMax: 5, doMax: 10, applySteps: 6 };
}

function disciplineHint(learningArea: string) {
  const subject = learningArea.toLowerCase();
  if (/math/.test(subject)) return "Use representations, reasoning, worked examples, guided practice, problem solving, and error analysis where aligned.";
  if (/science|biology|chemistry|physics|earth/.test(subject)) return "Use inquiry, evidence, models, observation, investigation/data interpretation, and safety where aligned.";
  if (/english|filipino|communication|literature|writing|wika/.test(subject)) return "Use authentic texts, comprehension, language use, speaking/listening, writing, feedback, and revision where aligned.";
  if (/araling|history|kasaysayan|governance|politic|citizenship|social/.test(subject)) return "Use sources, maps/timelines, cause-effect, perspective, evidence, discussion, and civic reasoning where aligned.";
  if (/tle|epp|tv[el]|business|entrepreneur|account|organization|management/.test(subject)) return "Use demonstration, procedure, safety/quality checks, authentic products, troubleshooting, and workplace relevance where aligned.";
  if (/mapeh|music|arts|dance|theater|physical education|sports|movement/.test(subject)) return "Use technique, rehearsal/practice, movement/performance, critique, wellness, and creative production where aligned.";
  if (/values|gmrc|esp|philosophy/.test(subject)) return "Use ethical situations, dialogue, reflection, perspective-taking, decisions, and observable application where aligned.";
  if (/research|ict|technology|database|data analytics|empowerment/.test(subject)) return "Use inquiry, information literacy, source evaluation, data, digital tools, and authentic outputs where aligned.";
  return "Infer the most authentic disciplinary practices from the competency and performance standard; do not use a generic worksheet pattern.";
}

function buildPrompt(input: PreviewLASInput, lesson: GeneratedLesson) {
  const sessionCount = Math.min(5, Math.max(1, Number(input.sessionCount || lesson.sessions.length || 5)));
  const duration = Math.min(240, Math.max(10, Number(input.sessionDurationMinutes || 60)));
  const limits = activityLimits(duration);
  const sourceText = (input.sourceMaterials || "").slice(0, 70000);

  return `Create a complete Learning Activity Sheet package aligned to the already-generated ILAW lesson plan.

PACING AND WORKLOAD
- Exactly ${sessionCount} LAS session(s); no extra day or session.
- Each LAS corresponds to the matching lesson-plan session and must be feasible within that same ${duration}-minute period.
- The teacher also needs time for directions, checking, feedback, transitions, and closure, so learner worksheet workload must be realistic rather than maximal.
- For this duration, use at most ${limits.tryMax} guided-practice items, ${limits.doMax} independent-practice items, and ${limits.applySteps} application instructions unless fewer are more authentic.
- If ${sessionCount} is 3, all learner materials must fit exactly those three sessions and may not defer work to an assumed Day 4 or Day 5.

SUBJECT AUTHENTICITY
Learning Area: ${input.learningArea}
Guidance: ${disciplineHint(input.learningArea)}
Do not turn non-Mathematics subjects into numbered computation worksheets. Do not force performance products when a short response, demonstration, analysis, oral task, investigation, rehearsal, source task, or other evidence better matches the competency.

ALIGNMENT
- Preserve the teacher-entered Learning Competency, Content Standard, and Performance Standard.
- Match each LAS session to the corresponding lesson session objective and flow.
- Let Us Learn provides learner-friendly concept input plus discipline-appropriate process/rules/frameworks and 1-3 models/examples.
- Let Us Try is scaffolded/guided practice with hints, frames, cues, partial models, guided questions, checklists, or teacher support appropriate to the subject.
- Let Us Do is independent or small-group evidence of learning, with task count and complexity feasible in ${duration} minutes.
- Let Us Apply is authentic application only when appropriate, with a clear output and concise directions.
- Rubrics must assess the actual expected output. Avoid calculation criteria in non-computational lessons.
- References may only come from teacher-provided references/uploaded source filenames.

Return exactly this JSON shape:
{
  "title": "",
  "sessions": [
    {
      "sessionNumber": 1,
      "sessionTitle": "",
      "learningCompetencies": "",
      "objectives": [""],
      "letUsLearn": {
        "concept": "",
        "blueprint": [""],
        "models": [""]
      },
      "letUsTry": [""],
      "letUsDo": [""],
      "letUsApply": {
        "context": "",
        "output": "",
        "instructions": [""]
      },
      "rubric": [
        { "criteria": "", "excellent": "", "satisfactory": "", "needsImprovement": "" }
      ],
      "references": [""]
    }
  ]
}

Teacher inputs:
${JSON.stringify({
    language: input.language,
    learningArea: input.learningArea,
    gradeLevelSection: input.gradeLevelSection,
    term: input.term,
    week: input.week,
    teachingDates: input.teachingDates,
    sessionCount,
    sessionDurationMinutes: duration,
    learningCompetency: input.learningCompetency,
    contentStandard: input.contentStandard,
    performanceStandard: input.performanceStandard,
    references: input.references
  }, null, 2)}

Lesson plan to follow:
${JSON.stringify(lesson, null, 2)}

Uploaded source excerpts:
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
        `Preview LAS generation failed.${status ? ` Provider status: ${status}.` : ""} Responses: ${providerMessage(responsesError)} Chat: ${providerMessage(chatError)}`
      );
    }
  }
}

function defaultRubric() {
  return [
    {
      criteria: "Accuracy / Understanding",
      excellent: "Shows accurate and complete understanding of the target competency.",
      satisfactory: "Shows mostly accurate understanding with minor gaps.",
      needsImprovement: "Shows partial understanding and needs additional support."
    },
    {
      criteria: "Process / Evidence",
      excellent: "Uses an appropriate process and provides clear evidence, reasoning, technique, or support.",
      satisfactory: "Uses most of the appropriate process but needs more clarity or support.",
      needsImprovement: "Process or evidence is incomplete, unclear, or inaccurate."
    },
    {
      criteria: "Application / Communication",
      excellent: "Applies learning effectively and communicates or performs the output clearly.",
      satisfactory: "Applies learning adequately with minor gaps in clarity or execution.",
      needsImprovement: "Application is limited or the output needs substantial revision."
    }
  ];
}

function normalizeLAS(
  input: PreviewLASInput,
  lesson: GeneratedLesson,
  raw: unknown,
  provider: ProviderOptions
): GeneratedLAS {
  const parsed = LooseLASSchema.parse(raw);
  const sessionCount = Math.min(5, Math.max(1, Number(input.sessionCount || lesson.sessions.length || 5)));
  const duration = Math.min(240, Math.max(10, Number(input.sessionDurationMinutes || 60)));
  const limits = activityLimits(duration);
  const refs = referenceItems(input);
  const safeRefs = refs.length ? refs : ["Teacher-provided lesson plan"];

  const sessions = Array.from({ length: sessionCount }, (_, index) => {
    const sessionNumber = index + 1;
    const lessonSession = lesson.sessions[index];
    const candidate = parsed.sessions.find((item) => item.sessionNumber === sessionNumber) || parsed.sessions[index];
    const objective = lessonSession?.learningObjectives?.[0] || input.learningCompetency;
    const title = clean(candidate?.sessionTitle) || lessonSession?.label || `Session ${sessionNumber}`;

    const defaultBlueprint = [
      `Focus on the key concept or skill needed to ${objective}.`,
      "Study the teacher/source model and identify the success criteria before attempting the task.",
      "Use the discipline-appropriate process, evidence, language, technique, procedure, representation, or tool required by the competency."
    ];
    const defaultModels = [
      `Model: Review one completed or teacher-modeled example that demonstrates how to ${objective}. Identify what makes the response or performance successful.`
    ];
    const defaultTry = [
      `Guided Practice 1: Complete a supported task aligned with ${objective}. Use the model, cue, frame, checklist, or teacher question provided.`,
      `Guided Practice 2: Compare your response or performance with the success criteria and revise one part with teacher or peer feedback.`,
      `Guided Practice 3: Explain, demonstrate, identify, solve, analyze, perform, or create one additional example appropriate to ${input.learningArea}.`
    ];
    const defaultDo = [
      `Independent Task 1: Produce clear evidence that you can ${objective}.`,
      `Independent Task 2: Apply the same competency to a new but appropriate example or situation.`,
      "Independent Task 3: Check your work against the success criteria and correct or improve it before submission.",
      "Independent Task 4: Give a brief explanation, reflection, justification, or demonstration of your process as appropriate to the subject.",
      "Independent Task 5: Complete a final mastery check aligned directly to the session objective."
    ];
    const defaultApplySteps = [
      "Read or examine the authentic situation/task carefully.",
      "Identify the required output and relevant success criteria.",
      "Apply the session competency using the appropriate subject process, evidence, technique, language, or tool.",
      "Review and improve the output before submitting or presenting it."
    ];

    const rubricRows = Array.isArray(candidate?.rubric)
      ? candidate.rubric
          .map((row) => ({
            criteria: clean(row.criteria),
            excellent: clean(row.excellent),
            satisfactory: clean(row.satisfactory),
            needsImprovement: clean(row.needsImprovement)
          }))
          .filter((row) => row.criteria && row.excellent && row.satisfactory && row.needsImprovement)
      : [];

    return {
      sessionNumber,
      sessionTitle: title,
      learningCompetencies: clean(candidate?.learningCompetencies) || input.learningCompetency,
      objectives: bounded(cleanArray(candidate?.objectives), lessonSession?.learningObjectives || [objective], 1, 4),
      letUsLearn: {
        concept:
          clean(candidate?.letUsLearn?.concept) ||
          `This session develops the competency through discipline-appropriate examples, guided support, and application. Focus on the knowledge and skill needed to ${objective}.`,
        blueprint: bounded(cleanArray(candidate?.letUsLearn?.blueprint), defaultBlueprint, 2, 8),
        models: bounded(cleanArray(candidate?.letUsLearn?.models), defaultModels, 1, 3)
      },
      letUsTry: bounded(cleanArray(candidate?.letUsTry), defaultTry, 3, limits.tryMax),
      letUsDo: bounded(cleanArray(candidate?.letUsDo), defaultDo, 5, limits.doMax),
      letUsApply: {
        context:
          clean(candidate?.letUsApply?.context) ||
          `Use the session competency in an authentic ${input.learningArea || "classroom"} context appropriate to the learners' grade level.`,
        output:
          clean(candidate?.letUsApply?.output) ||
          `A clear response, product, performance, solution, analysis, explanation, or other evidence aligned to: ${objective}.`,
        instructions: bounded(cleanArray(candidate?.letUsApply?.instructions), defaultApplySteps, 3, limits.applySteps)
      },
      rubric: (rubricRows.length ? rubricRows : defaultRubric()).slice(0, 5),
      references: safeRefs
    };
  });

  return {
    title: clean(parsed.title) || lesson.title || "Learning Activity Sheet",
    learningArea: input.learningArea || lesson.learningArea,
    gradeLevel: input.gradeLevelSection || lesson.gradeLevelSection,
    school: provider.lasHeaderSchoolName || input.school || "",
    division: provider.lasHeaderDivision || "",
    term: input.term,
    week: input.week,
    teachingDates: input.teachingDates,
    sessions
  };
}

export async function generatePreviewLAS(
  input: PreviewLASInput,
  lesson: GeneratedLesson,
  provider: ProviderOptions
): Promise<{ las: GeneratedLAS; model: string; reasoningEffort: ReasoningEffort }> {
  const apiKey = provider.apiKey || process.env.OPENAI_API_KEY || "";
  const model = provider.model || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = provider.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";

  if (!apiKey) {
    throw new Error("AI generation is not configured. Add an API key in Admin or configure OPENAI_API_KEY.");
  }

  const effort = reasoningEffort(input);
  const client = new OpenAI({ apiKey, baseURL });
  const text = await generateText(client, model, baseURL, buildPrompt(input, lesson), effort);
  const las = normalizeLAS(input, lesson, extractJsonObject(text), provider);

  return { las, model, reasoningEffort: effort };
}
