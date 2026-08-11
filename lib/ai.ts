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
import { normalizeSessionDurationMinutes, stripObjectiveTiming } from "./lesson-format";

type GenerationResult = {
  lesson: GeneratedLesson;
  model: string;
  usedAI: boolean;
};

type GenerationProviderOptions = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
};

type ProviderError = {
  status?: unknown;
};

const SYSTEM_PROMPT = `You are an expert Philippine teacher and curriculum developer familiar with the DepEd ILAW lesson-planning format under DepEd Order No. 016, s. 2026.

Task: Create a complete Daily Lesson Log (DLL) using the ILAW format for the exact number of sessions selected in the teacher form. If uploaded source text is provided, use it as supporting reference while keeping teacher-entered curriculum fields authoritative.

Generate only the lesson-specific fillable content for the official ILAW table. The app supplies the fixed template description rows and keeps reflection cells available for teacher use.

Follow the attached DepEd ILAW skill contract:
- Treat the output as a teacher-reviewed AI-assisted draft, not final official approval.
- Follow authority order: teacher form fields first, uploaded official/source materials second, DepEd policy and scholastic sources third, then general pedagogy.
- Treat the Learning Competency, Content Standard, and Performance Standard fields as the core curriculum source. Every objective, flow activity, assessment, resource, integration, and ways-forward task must visibly connect to those fields.
- Silently unpack every competency into Knowledge, Skills, and Attitudes/Values (KSA) before writing objectives.
- Use Revised Bloom's Taxonomy to sequence objectives and learning tasks.
- Write one clear SMART objective per day/session unless Comprehensive output truly needs supporting sub-objectives.
- Use a gradual-release rhythm in every session: I Do/Modeling, We Do/Guided or Social Learning, You Do/Application, Synthesis/Reflection.
- Include realistic checks for understanding, feedback moves, accommodations for diverse learners, remediation/enrichment, and emergency/low-tech alternatives.
- Add creative hooks, local Philippine contexts, games, inquiry prompts, role-play, or learner choice only when they directly support the competency.
- Do not invent curriculum codes, content standards, performance standards, teacher/school details, exact textbook pages, hyperlinks, or references.
- Before returning JSON, silently check alignment: KSA unpacking, SMART objective, gradual-release flow, CFU/feedback, accommodation, assessment evidence, integration, and ways forward must all match the teacher-entered competency and standards.

Use this required ILAW structure:
1. INTENTIONS
- Learning Competency: restate the competency clearly and preserve every budgeted competency listed by the teacher.
- Objectives: create one specific, measurable SMART objective for each selected session/day, aligned with KSA, Revised Bloom's Taxonomy, the competency, content standard, and performance standard. If supporting objectives are needed for Comprehensive output, write them as short action phrases. Do not repeat the stem "By the end of Day X, learners will be able to" in every bullet. If the teacher entered multiple weekly competencies, distribute all of them across the selected sessions so the full weekly competency set is covered without omission.
- Learner Context: describe learners' prior knowledge, interests, strengths, possible misconceptions, barriers to learning, and relevant real-life experiences related to the topic.

2. LEARNING EXPERIENCE
- Pre-Lesson: for each selected session/day, provide a review/motivation activity, lesson preparation, and learner-readiness check.
- Flow: create detailed daily activities using gradual release (I Do, We Do, You Do, Synthesis). Use this progression when the selected number of sessions permits:
  Day 1: Engage/Motivate, Explore, Explain.
  Day 2: Review, Guided Practice, Discussion.
  Day 3: Deepening of Understanding, Collaborative Activity.
  Day 4: Application and Real-World Connection, Independent Practice.
  Day 5: Synthesis, Performance Task or Summative Activity, Reflection.
  If fewer than 5 sessions are selected, compress the progression responsibly so the final selected day includes synthesis, assessment evidence, and reflection.
- Learning Resources: provide resources for each selected session/day, such as PPT presentations, worksheets, videos, textbooks, simulations, online resources, and alternative resources during emergencies.
- Opportunities for Integration: suggest meaningful integration with ICT, Values Education, Literacy, Numeracy, and related learning areas.

3. ASSESSMENT
- Formative Assessment: provide teacher-friendly assessment tasks for each selected session/day, such as multiple-choice questions, matching type, exit tickets, oral questioning, short quizzes, error analysis, self-checks, and graphic organizers. Include evidence of learning, teacher feedback, support for learners needing help, enrichment for learners ready to extend, and accommodations for diverse learners. Avoid performance-based assessment unless the competency truly requires it.

4. WAYS FORWARD
- Extended Learning Opportunities: provide home-based, remediation, or enrichment activities for each selected session/day.
- Reflections: write concise teacher reflection prompts for each selected session/day regarding learner engagement, misconceptions observed, adjustments needed, support required for struggling learners, and recommendations for future lessons. Keep them as prompts or possible reflection starters, not completed claims.

Follow the official table labels exactly in the generated content and DOCX mapping:
- Lesson Title
- Learning Area/s
- Name of Teacher/s
- Grade Level and Section
- Teaching Dates
- No. of Sessions
- Duration of Each Session
- Intentions.
- Learning Competency and Curriculum Standards:
- Learning Objectives:
- Learner Context:
- Learning Experience.
- Pre-Lesson:
- Flow:
- Learning Resources:
- Opportunities for integration:
- Assessment.
- Formative Assessment:
- Ways Forward.
- Extended learning opportunities:
- Reflections:

Follow DepEd Order No. 016, s. 2026 lesson-planning intent: lesson planning should be flexible, efficient, context-responsive, learner-centered, reflective, and evidence-informed. The plan must support meaningful learning rather than compliance-only activity listing.

Important professional constraints:
- Use teacher-provided form fields as the authoritative official curriculum information. Uploaded full readable source text may support examples, resources, vocabulary, and activity context, but it must not override the official competency, content standard, or performance standard.
- Do not mention source extraction, scans, technical upload details, or uploaded source filenames in the lesson content cells. Put uploaded source filenames only in the References field. When a source must be named in lesson content, use generic labels such as Source 1 or Source 2.
- Do not generate markdown, citations, commentary, or explanations outside the requested JSON.
- Return exactly the selected number of session objects. Label them sequentially as Day 1, Day 2, Day 3, Day 4, and/or Day 5 as applicable.
- Treat the selected number of sessions as the pacing container, not as permission to shorten the week. If the Learning Competency field contains several competencies, MELCs, codes, bullet points, numbered items, or semicolon-separated items, divide the complete set across the selected sessions. For example, if 2 sessions are selected, Day 1 and Day 2 together must cover every competency listed for the week; related competencies may be clustered, but none may be dropped, summarized away, or left for an ungenerated day.
- Every objective, activity, assessment, resource, integration, extended learning task, and reflection prompt must align with the teacher-provided competency, content standard, performance standard, topic, grade level, learning area, term, week, and teaching dates.
- Activities must promote active participation, collaboration, prior-knowledge connections, differentiation for diverse learners, critical thinking, and reflection.
- Keep each table cell classroom-ready, compact, and professional.
- References must come only from uploaded source filenames or teacher-provided explicit references. If no upload/reference is provided, leave the References field blank. Do not generate references from general model knowledge.

Language rule: write in the selected language. If Bilingual, use professional English with natural Filipino support terms where appropriate.`;

const LESSON_JSON_INSTRUCTIONS = `Return only one JSON object with this shape:
{
  "title": "",
  "learningArea": "",
  "teacherName": "",
  "gradeLevelSection": "",
  "term": "Term 1",
  "week": "",
  "teachingDates": "",
  "schoolYear": "",
  "sessionLabels": ["Day 1", "Day 2"],
  "references": "",
  "aiUseDeclaration": "",
  "learningCompetency": "",
  "contentStandard": "",
  "performanceStandard": "",
  "curriculumStandards": "Content Standard:\n...\n\nPerformance Standard:\n...",
  "learnerContext": "",
  "sessions": [
    {
      "sessionNumber": 1,
      "label": "Day 1",
      "learningObjectives": ["Identify ...", "Explain ...", "Apply ..."],
      "preLesson": "Review/Motivation: ... Preparation: ... Readiness Check: ...",
      "flow": ["Engage/Motivate: ...", "Explore: ...", "Explain: ..."],
      "learningResources": "PPT presentation; worksheet; textbook/module pages; video/simulation; alternative printed/offline materials for emergencies.",
      "integration": "ICT: ... Values Education: ... Literacy: ... Numeracy: ... Related Learning Area: ...",
      "formativeAssessment": ["Oral Questioning: ...", "Short Quiz/Exit Ticket: ...", "Accommodation: ..."],
      "extendedLearning": "Home-based or enrichment activity: ...",
      "reflectionPrompt": "Teacher reflection starter: ..."
    }
  ]
}`;

function isGeminiProvider(model: string, baseURL: string) {
  return /gemini/i.test(model) || /generativelanguage\.googleapis\.com/i.test(baseURL);
}

function providerStatus(error: unknown) {
  return typeof error === "object" && error && "status" in error
    ? (error as ProviderError).status
    : undefined;
}

function providerMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isUnsupportedJsonMode(error: unknown) {
  const message = providerMessage(error);
  return /response_format|json_object|unsupported|unknown field|invalid argument|400/i.test(message);
}


function depthInstruction(depth?: LessonInput["outputDepth"]) {
  switch (depth) {
    case "Concise":
      return "Output depth: Concise. Produce a lean ILAW plan for fast review. Use 1 observable objective per session, exactly 3 compact flow moves (Readiness/Modeling, Guided Practice/CFU, Evidence/Synthesis), 3 assessment/support items, and 1 actionable ways-forward task. Keep each item one short sentence and avoid background narration.";
    case "Short":
      return "Output depth: Short. Produce a brief but implementable ILAW plan. Use 1 objective, 4 flow moves, 3 assessment/support items, concise resources, and concise integration.";
    case "Comprehensive":
      return "Output depth: Comprehensive. Produce the richest official-style ILAW plan. Use 1 main objective plus up to 2 supporting sub-objectives, 6-7 well-labeled flow moves with explicit teacher moves, learner actions, CFU, accommodation, feedback, success criteria, and evidence tasks; include richer learner-context, integration, and ways-forward details while keeping each table cell readable.";
    case "Detailed":
    default:
      return "Output depth: Detailed. Produce a balanced professional ILAW plan. Use 1 SMART objective per session, 5 flow moves, 4 assessment/support items, concrete resources, teacher facilitation moves, learner actions, CFU, visible evidence, and one differentiated support note per session.";
  }
}

function composeCurriculumStandards(input: LessonInput) {
  const content = input.contentStandard?.trim() || "Teacher to provide the applicable content standard.";
  const performance = input.performanceStandard?.trim() || "Teacher to provide the applicable performance standard.";
  return `Content Standard:\n${content}\n\nPerformance Standard:\n${performance}`;
}

function sessionDurationMinutes(input: LessonInput) {
  return normalizeSessionDurationMinutes(input.sessionDurationMinutes);
}

function buildUserPrompt(input: LessonInput) {
  const selectedSessionCount = Math.min(5, Math.max(1, input.sessionCount || 5));
  const selectedLabels = Array.from({ length: selectedSessionCount }, (_, index) => `Day ${index + 1}`);
  const durationMinutes = sessionDurationMinutes(input);
  const uploadedSources = input.sourceMaterials?.trim() || "";
  const teacherFields = {
    ...input,
    inputMode: "manual",
    sessionCount: selectedSessionCount,
    sessionDurationMinutes: durationMinutes,
    sourceMaterials: uploadedSources ? "[Uploaded full readable source text provided below]" : "",
    references: input.references || "",
    curriculumStandards: composeCurriculumStandards(input)
  };
  const sourceInstruction = uploadedSources
    ? "- Uploaded full readable source text is provided and must be used as a source for content generation. Use relevant uploaded-source examples, activities, vocabulary, formulas, tables, lesson sections, assessment items, and resource suggestions when they align with the teacher-entered competency and standards. Do not ignore the uploaded source. Teacher-entered competency and standards remain authoritative if anything conflicts. If a source must be named in a lesson content cell, use only the generic source label such as Source 1 or Source 2. Do not write uploaded filenames in lesson content cells; filenames belong only in the References field."
    : "- No uploaded source text or explicit references were provided. Leave the References field blank. Do not invent or add citations, editions, page numbers, source titles, or URLs.";
  const sourceBlock = uploadedSources
    ? `\n\nUploaded full readable source text for supporting reference:\n${uploadedSources}`
    : "";

  return `${LESSON_JSON_INSTRUCTIONS}

Mandatory requirements:
- Create exactly ${selectedSessionCount} session object(s) labeled ${selectedLabels.join(", ")}. Do not add extra day/session columns beyond this selection.
- Each selected session is ${durationMinutes} minutes. The app will display this in the day/session header as Day 1 (${durationMinutes}m), Day 2 (${durationMinutes}m), and so on. Use the duration to keep objectives and activities achievable, but do not write minute/session timing phrases inside the objective text.
- ${depthInstruction(input.outputDepth)}
${sourceInstruction}
- Treat the following form inputs as authoritative official curriculum information. Do not request additional files or source text.
- Use the exact Learning Competency, Content Standard, and Performance Standard from the form. Do not replace them with a generic topic. When the Topic / Lesson field is blank, infer a title from the competency, but still design the lesson from the full competency and standards.
- If uploaded source text is provided, ground the lesson content in the relevant source text. Use source-based examples/resources/activities where useful and label them generically as Source 1, Source 2, etc. Do not use uploaded source text only for the References row.
- Run these internal design passes before writing JSON: source/filter check; KSA unpacking; Revised Bloom progression; one SMART objective per selected day/session; I Do-We Do-You Do flow; assessment evidence and feedback; inclusion/accommodations; ways forward; final alignment check against the competency and standards.
- References must be blank unless actual uploaded filenames or teacher-provided explicit references are available.
- If Topic / Lesson is blank, generate a concise lesson title from the learning competency, learning area, and standards.
- Restate the Learning Competency clearly in the Intentions section.
- Create one measurable SMART objective for each selected session/day. Use one objective only per day unless the teacher selected Comprehensive output, where supporting sub-objectives may be added. In the JSON array, write objectives as short observable action phrases, not repeated full stems. Do not start every item with "By the end of Day..." or "learners will be able to...". Do not include phrases such as "within the ${durationMinutes}-minute session"; timing belongs only in the day/session header.
- Session pacing and competency coverage rule: use the selected session count to divide the full weekly Learning Competency input into the same number of instructional chunks. If the teacher pasted multiple competencies, MELC lines, codes, bullet points, numbered items, or semicolon-separated items, distribute all items across the selected sessions. When fewer sessions are selected than competency items, cluster related or sequential items so every budgeted competency is fully covered in the generated sessions. Do not omit, cut, postpone, or replace any teacher-provided competency.
- For each session, make the Flow, Formative Assessment, Extended Learning, and Reflection explicitly match that session's assigned competency chunk.
- Build the Learner Context from the grade level, subject, topic, and competency. Include prior knowledge, interests, strengths, misconceptions, barriers, and real-life experiences.
- Learning Experience Flow must follow the selected-session sequence:
  Day 1: Engage/Motivate; Explore; Explain.
  Day 2: Review; Guided Practice; Discussion.
  Day 3: Deepening of Understanding; Collaborative Activity.
  Day 4: Application and Real-World Connection; Independent Practice.
  Day 5: Synthesis; Performance Task or Summative Activity; Reflection.
  If fewer than 5 sessions are selected, compress the progression: Day 1 opens the lesson, middle days build practice/deepening/application when present, and the final selected day always includes synthesis, assessment evidence, and reflection.
- Learning Resources must list daily resources such as PPT, worksheets, videos, textbooks/modules, simulations/online resources, and emergency alternatives.
- Opportunities for Integration must include ICT, Values Education, Literacy, Numeracy, and related learning areas when meaningful.
- Assessment must use teacher-friendly formative checks such as multiple-choice, matching type, exit tickets, oral questioning, short quizzes, graphic organizers, and accommodations. Avoid performance-based assessment except when needed for the final selected session synthesis or summative evidence.
- Ways Forward must include daily home-based, remediation, or enrichment tasks and a teacher reflection starter for engagement, misconceptions, adjustments, support, and recommendations.
- Preserve teacher wording for Learning Competency, Content Standard, and Performance Standard. Do not invent official DepEd codes or standards.
- Write the plan in a professional table-ready style similar to the DepEd ILAW DLL, with separate session/day columns. Keep Learning Objectives compact so the table does not repeat the same phrase multiple times in one cell.

Lesson Information and Curriculum Information form fields:
${JSON.stringify(teacherFields, null, 2)}${sourceBlock}`;
}

function lessonReferences(input: LessonInput, generated: string) {
  const explicitReferences = input.references?.trim();
  if (explicitReferences) return explicitReferences;
  if (input.sourceMaterials?.trim()) {
    return generated.trim() || "Teacher-provided form inputs and uploaded source materials";
  }
  return "";
}

type SourceReference = {
  label: string;
  name: string;
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function sourceReferences(input: LessonInput) {
  const references = new Map<number, SourceReference>();

  for (const match of input.references?.matchAll(/^\s*(\d+)[.)]\s*(.+)$/gim) || []) {
    const number = Number(match[1]);
    if (Number.isFinite(number) && match[2].trim() && !/^teacher-provided/i.test(match[2].trim())) {
      references.set(number, { label: `Source ${number}`, name: match[2].trim() });
    }
  }

  for (const match of input.sourceMaterials?.matchAll(/^Source\s+(\d+):\s*(.+)$/gim) || []) {
    const number = Number(match[1]);
    if (Number.isFinite(number) && match[2].trim()) {
      references.set(number, { label: `Source ${number}`, name: match[2].trim() });
    }
  }

  return Array.from(references.entries())
    .sort(([left], [right]) => left - right)
    .map(([, reference]) => reference);
}

function keepSourceLabelsInContent(value: string, references: SourceReference[]) {
  return references.reduce((text, reference) => {
    const filenamePattern = new RegExp(escapeRegExp(reference.name), "gi");
    return text.replace(filenamePattern, reference.label);
  }, value);
}

function keepSourceLabelsInList(values: string[], references: SourceReference[]) {
  return values.map((value) => keepSourceLabelsInContent(value, references));
}

const LooseTextSchema = z.preprocess((value) => {
  if (value === null || value === undefined) return "";
  return typeof value === "string" ? value : String(value);
}, z.string());

const LooseStringArraySchema = z.preprocess((value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => (item === null || item === undefined ? "" : String(item).trim()))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed ? [trimmed] : [];
  }

  return [];
}, z.array(z.string()));

const RawSessionPlanSchema = z.object({
  sessionNumber: z.preprocess((value) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }, z.number().int().min(0).max(5)),
  label: LooseTextSchema,
  learningObjectives: LooseStringArraySchema,
  preLesson: LooseTextSchema,
  flow: LooseStringArraySchema,
  learningResources: LooseTextSchema,
  integration: LooseTextSchema,
  formativeAssessment: LooseStringArraySchema,
  extendedLearning: LooseTextSchema,
  reflectionPrompt: LooseTextSchema
}).passthrough();

const RawGeneratedLessonSchema = z.object({
  title: LooseTextSchema,
  learningArea: LooseTextSchema,
  teacherName: LooseTextSchema,
  gradeLevelSection: LooseTextSchema,
  term: LooseTextSchema,
  week: LooseTextSchema,
  schoolYear: LooseTextSchema,
  sessionLabels: LooseStringArraySchema,
  teachingDates: LooseTextSchema,
  references: LooseTextSchema,
  aiUseDeclaration: LooseTextSchema,
  intentionNarrative: LooseTextSchema,
  learningCompetency: LooseTextSchema,
  contentStandard: LooseTextSchema,
  performanceStandard: LooseTextSchema,
  curriculumStandards: LooseTextSchema,
  learnerContext: LooseTextSchema,
  learningExperienceNarrative: LooseTextSchema,
  assessmentNarrative: LooseTextSchema,
  waysForwardNarrative: LooseTextSchema,
  sessions: z.preprocess((value) => (Array.isArray(value) ? value : []), z.array(RawSessionPlanSchema))
}).passthrough();

type RawSessionPlan = z.infer<typeof RawSessionPlanSchema>;
type RawGeneratedLesson = z.infer<typeof RawGeneratedLessonSchema>;

function parseGeneratedLesson(outputText: string): RawGeneratedLesson {
  const parsedJson = extractJsonObject(outputText);
  const parsed = RawGeneratedLessonSchema.safeParse(parsedJson);

  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.length ? issue.path.join(".") : "root";
    throw new Error(
      `The AI returned JSON, but it could not be read as a lesson-plan object at ${path}: ${issue?.message || "invalid value"}.`
    );
  }

  return parsed.data;
}
function hasUsefulText(value: string | string[] | undefined) {
  const text = Array.isArray(value) ? value.join(" ") : value || "";
  return text.trim().length > 0 && !/generated by ai|generated resources|generated integration|generated extension/i.test(text);
}

function cleanObjectiveText(value: string, sessionNumber: number) {
  return stripObjectiveTiming(value
    .replace(/^\s*[-*•●▪]\s*/, "")
    .replace(new RegExp(`^\\s*by\\s+the\\s+end\\s+of\\s+(?:day|session)\\s*${sessionNumber}\\s*,?\\s*(?:the\\s+)?(?:learners?|students?|pupils?)\\s+(?:will|should|can)\\s+be\\s+able\\s+to\\s+`, "i"), "")
    .replace(/^\s*by\s+the\s+end\s+of\s+(?:the\s+)?(?:day|session)\s*,?\s*(?:the\s+)?(?:learners?|students?|pupils?)\s+(?:will|should|can)\s+be\s+able\s+to\s+/i, "")
    .replace(/^\s*(?:the\s+)?(?:learners?|students?|pupils?)\s+(?:will|should|can)\s+be\s+able\s+to\s+/i, "")
    .replace(/^\s*be\s+able\s+to\s+/i, "")
    .replace(/^\s*to\s+/i, ""))
    .trim()
    .replace(/^[a-z]/, (char) => char.toUpperCase());
}

function mergeTextItems(values: string[] | undefined, fallback: string[], minimumCount: number) {
  const primary = (values || []).map((value) => value.trim()).filter(Boolean);
  const fallbackItems = fallback.map((value) => value.trim()).filter(Boolean);
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const item of primary) {
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  for (const item of fallbackItems) {
    if (merged.length >= minimumCount) break;
    const key = item.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(item);
    }
  }

  for (const item of fallbackItems) {
    if (merged.length >= minimumCount) break;
    merged.push(item);
  }

  return merged.length ? merged : fallbackItems;
}

function normalizeLearningObjectives(objectives: string[] | undefined, fallback: string[], sessionNumber: number) {
  const cleaned = (objectives || [])
    .map((objective) => cleanObjectiveText(objective, sessionNumber))
    .filter(Boolean);
  const fallbackCleaned = fallback
    .map((objective) => cleanObjectiveText(objective, sessionNumber))
    .filter(Boolean);

  return mergeTextItems(cleaned, fallbackCleaned, 1);
}

function normalizeSession(
  session: RawSessionPlan | undefined,
  fallback: SessionPlan,
  sessionNumber: number
): SessionPlan {
  return {
    sessionNumber,
    label: `Day ${sessionNumber}`,
    learningObjectives: normalizeLearningObjectives(
      hasUsefulText(session?.learningObjectives) ? session!.learningObjectives : undefined,
      fallback.learningObjectives,
      sessionNumber
    ),
    preLesson: hasUsefulText(session?.preLesson) ? session!.preLesson : fallback.preLesson,
    flow: mergeTextItems(
      hasUsefulText(session?.flow) ? session!.flow : undefined,
      fallback.flow,
      3
    ),
    learningResources: hasUsefulText(session?.learningResources)
      ? session!.learningResources
      : fallback.learningResources,
    integration: hasUsefulText(session?.integration) ? session!.integration : fallback.integration,
    formativeAssessment: mergeTextItems(
      hasUsefulText(session?.formativeAssessment) ? session!.formativeAssessment : undefined,
      fallback.formativeAssessment,
      3
    ),
    extendedLearning: hasUsefulText(session?.extendedLearning)
      ? session!.extendedLearning
      : fallback.extendedLearning,
    reflectionPrompt: hasUsefulText(session?.reflectionPrompt)
      ? session!.reflectionPrompt
      : fallback.reflectionPrompt
  };
}
function limitArrayByDepth<T>(values: T[], depth: LessonInput["outputDepth"], kind: "objectives" | "flow" | "assessment") {
  const limits = {
    Concise: { objectives: 1, flow: 3, assessment: 3 },
    Short: { objectives: 1, flow: 4, assessment: 3 },
    Detailed: { objectives: 1, flow: 5, assessment: 4 },
    Comprehensive: { objectives: 4, flow: 7, assessment: 6 }
  } as const;
  const selectedDepth = (depth && depth in limits ? depth : "Detailed") as keyof typeof limits;
  const max = limits[selectedDepth][kind];
  return values.slice(0, max);
}

function applyDepthLimits(input: LessonInput, sessions: SessionPlan[]) {
  const depth = input.outputDepth || "Detailed";
  return sessions.map((session) => ({
    ...session,
    learningObjectives: limitArrayByDepth(session.learningObjectives, depth, "objectives"),
    flow: limitArrayByDepth(session.flow, depth, "flow"),
    formativeAssessment: limitArrayByDepth(session.formativeAssessment, depth, "assessment")
  }));
}

function normalizeGeneratedLesson(input: LessonInput, lesson: RawGeneratedLesson): GeneratedLesson {
  const sessionCount = Math.min(5, Math.max(1, input.sessionCount || 5));
  const fallback = buildFallbackLesson(input);
  const sourceRefs = sourceReferences(input);
  const normalizedSessions = Array.from({ length: sessionCount }, (_, index) => {
    const sessionNumber = index + 1;
    const existing =
      lesson.sessions.find((session) => Number(session.sessionNumber) === sessionNumber) ||
      lesson.sessions[index];

    const normalized = normalizeSession(existing, fallback.sessions[index], sessionNumber);
    return {
      ...normalized,
      learningObjectives: keepSourceLabelsInList(normalized.learningObjectives, sourceRefs),
      preLesson: keepSourceLabelsInContent(normalized.preLesson, sourceRefs),
      flow: keepSourceLabelsInList(normalized.flow, sourceRefs),
      learningResources: keepSourceLabelsInContent(normalized.learningResources, sourceRefs),
      integration: keepSourceLabelsInContent(normalized.integration, sourceRefs),
      formativeAssessment: keepSourceLabelsInList(normalized.formativeAssessment, sourceRefs),
      extendedLearning: keepSourceLabelsInContent(normalized.extendedLearning, sourceRefs),
      reflectionPrompt: keepSourceLabelsInContent(normalized.reflectionPrompt, sourceRefs)
    };
  });
  const sessions = applyDepthLimits(input, normalizedSessions);

  const normalizedLesson = {
    ...lesson,
    title: lesson.title || input.lessonTitle || fallback.title,
    learningArea: lesson.learningArea || input.learningArea || fallback.learningArea,
    teacherName: lesson.teacherName || input.teacherName || fallback.teacherName,
    gradeLevelSection:
      lesson.gradeLevelSection || input.gradeLevelSection || fallback.gradeLevelSection,
    term: input.term,
    week: input.week || lesson.week,
    teachingDates: input.teachingDates || lesson.teachingDates || fallback.teachingDates,
    schoolYear: input.schoolYear || lesson.schoolYear,
    references: lessonReferences(input, lesson.references),
    aiUseDeclaration:
      lesson.aiUseDeclaration || input.aiUseDeclaration || fallback.aiUseDeclaration,
    learningCompetency:
      lesson.learningCompetency || input.learningCompetency || fallback.learningCompetency,
    contentStandard:
      lesson.contentStandard || input.contentStandard || fallback.contentStandard,
    performanceStandard:
      lesson.performanceStandard || input.performanceStandard || fallback.performanceStandard,
    curriculumStandards:
      lesson.curriculumStandards || composeCurriculumStandards(input) || fallback.curriculumStandards,
    learnerContext: lesson.learnerContext || input.learnerContext || fallback.learnerContext,
    intentionNarrative: OFFICIAL_TEMPLATE_NARRATIVES.intentions,
    learningExperienceNarrative: OFFICIAL_TEMPLATE_NARRATIVES.learningExperience,
    assessmentNarrative: OFFICIAL_TEMPLATE_NARRATIVES.assessment,
    waysForwardNarrative: OFFICIAL_TEMPLATE_NARRATIVES.waysForward,
    sessionLabels: sessions.map((session) => session.label),
    sessions
  };

  return GeneratedLessonSchema.parse(normalizedLesson);
}

async function generateWithResponses(client: OpenAI, model: string, input: LessonInput) {
  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ],
    reasoning: { effort: "low" }
  });

  return parseGeneratedLesson(getResponseText(response));
}

async function generateWithChat(client: OpenAI, model: string, input: LessonInput, options: { jsonMode?: boolean } = {}) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT
      },
      {
        role: "user",
        content: buildUserPrompt(input)
      }
    ],
    ...(options.jsonMode === false ? {} : { response_format: { type: "json_object" as const } })
  });

  return parseGeneratedLesson(response.choices[0]?.message?.content || "");
}

export async function generateLesson(input: LessonInput, providerOptions: GenerationProviderOptions = {}): Promise<GenerationResult> {
  const model = providerOptions.model || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = providerOptions.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = providerOptions.apiKey || process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    throw new Error("AI generation is not configured. Add an Admin API key or set OPENAI_API_KEY before generating a lesson plan.");
  }

  const client = new OpenAI({
    apiKey,
    baseURL
  });

  if (isGeminiProvider(model, baseURL)) {
    try {
      return {
        lesson: normalizeGeneratedLesson(input, await generateWithChat(client, model, input)),
        model,
        usedAI: true
      };
    } catch (chatError) {
      if (!isUnsupportedJsonMode(chatError)) {
        const status = providerStatus(chatError);
        const statusText = status ? ` Provider status: ${status}.` : "";
        throw new Error(
          `AI generation failed. No lesson plan was generated.${statusText} Gemini Chat: ${providerMessage(chatError)}`
        );
      }

      try {
        return {
          lesson: normalizeGeneratedLesson(input, await generateWithChat(client, model, input, { jsonMode: false })),
          model,
          usedAI: true
        };
      } catch (retryError) {
        const status = providerStatus(retryError) || providerStatus(chatError);
        const statusText = status ? ` Provider status: ${status}.` : "";
        throw new Error(
          `AI generation failed. No lesson plan was generated.${statusText} Gemini Chat: ${providerMessage(chatError)} Retry without JSON mode: ${providerMessage(retryError)}`
        );
      }
    }
  }

  try {
    return {
      lesson: normalizeGeneratedLesson(input, await generateWithResponses(client, model, input)),
      model,
      usedAI: true
    };
  } catch (responsesError) {
    try {
      return {
        lesson: normalizeGeneratedLesson(input, await generateWithChat(client, model, input)),
        model,
        usedAI: true
      };
    } catch (chatError) {
      const firstMessage = providerMessage(responsesError);
      const secondMessage = providerMessage(chatError);
      const status = providerStatus(responsesError) || providerStatus(chatError);
      const statusText = status ? ` Provider status: ${status}.` : "";

      throw new Error(
        `AI generation failed. No lesson plan was generated.${statusText} Responses: ${firstMessage} Chat: ${secondMessage}`
      );
    }
  }
}
