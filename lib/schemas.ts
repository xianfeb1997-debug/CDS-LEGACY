import { z } from "zod";

export const lessonLanguages = ["English", "Filipino", "Bilingual"] as const;
export const inputModes = ["manual"] as const;
export const schoolTerms = ["Term 1", "Term 2", "Term 3"] as const;
export const pageOrientations = ["Landscape", "Portrait"] as const;
export const paperSizes = ["A4", "Letter", "Legal", "Folio"] as const;
export const outputDepths = ["Concise", "Short", "Detailed", "Comprehensive"] as const;
export const pptThemes = ["Basic Light", "Rush", "Borealis", "Cornfield", "Daydream", "Terracotta"] as const;
export const pptImageModels = ["imagen-4-fast", "flux-2-klein", "flux-kontext-fast", "ideogram-v3-turbo", "luma-photon-flash-1", "recraft-v4"] as const;
export const pptImageStylePresets = ["photo", "scene", "cinematic", "3D", "illustration", "technicalLine"] as const;

export const LessonInputSchema = z.object({
  language: z.enum(lessonLanguages),
  inputMode: z.enum(inputModes),
  schoolYear: z.string().optional().default("2026-2027"),
  term: z.enum(schoolTerms),
  pageOrientation: z.enum(pageOrientations),
  paperSize: z.enum(paperSizes),
  outputDepth: z.enum(outputDepths).optional().default("Detailed"),
  pptTheme: z.enum(pptThemes).optional().default("Basic Light"),
  pptPageCount: z.coerce.number().int().min(5).max(60).optional().default(20),
  pptImageModel: z.enum(pptImageModels).optional().default("imagen-4-fast"),
  pptImageStylePreset: z.enum(pptImageStylePresets).optional().default("3D"),
  week: z.string().optional().default(""),
  teachingDates: z.string().optional().default(""),
  school: z.string().optional().default(""),
  learningArea: z.string().optional().default(""),
  teacherName: z.string().optional().default(""),
  teacherRole: z.string().optional().default(""),
  checkedBy: z.string().optional().default(""),
  checkerRole: z.string().optional().default(""),
  gradeLevelSection: z.string().optional().default(""),
  lessonTitle: z.string().optional().default(""),
  sessionCount: z.coerce.number().int().min(1).max(5).default(5),
  sessionDurationMinutes: z.coerce.number().int().min(10).max(240).default(60),
  references: z.string().optional().default(""),
  sourceMaterials: z.string().optional().default(""),
  aiUseDeclaration: z.string().optional().default(""),
  learningCompetency: z.string().optional().default(""),
  contentStandard: z.string().optional().default(""),
  performanceStandard: z.string().optional().default(""),
  curriculumStandards: z.string().optional().default(""),
  learningObjectives: z.string().optional().default(""),
  learnerContext: z.string().optional().default(""),
  resourceNotes: z.string().optional().default(""),
  integrationNotes: z.string().optional().default(""),
  assessmentNotes: z.string().optional().default(""),
  waysForwardNotes: z.string().optional().default("")
});

export type LessonInput = z.infer<typeof LessonInputSchema>;

export const SessionPlanSchema = z.object({
  sessionNumber: z.number().int().min(1).max(5),
  label: z.string(),
  learningObjectives: z.array(z.string()).min(1).max(4),
  preLesson: z.string(),
  flow: z.array(z.string()).min(3).max(7),
  learningResources: z.string(),
  integration: z.string(),
  formativeAssessment: z.array(z.string()).min(3).max(7),
  extendedLearning: z.string(),
  reflectionPrompt: z.string().optional().default("")
});

export type SessionPlan = z.infer<typeof SessionPlanSchema>;

export const GeneratedLessonSchema = z.object({
  title: z.string(),
  learningArea: z.string(),
  teacherName: z.string(),
  gradeLevelSection: z.string(),
  term: z.enum(schoolTerms),
  week: z.string(),
  schoolYear: z.string(),
  sessionLabels: z.array(z.string()).min(1).max(5),
  teachingDates: z.string().optional().default(""),
  references: z.string(),
  aiUseDeclaration: z.string(),
  intentionNarrative: z.string().optional().default(""),
  learningCompetency: z.string(),
  contentStandard: z.string().optional().default(""),
  performanceStandard: z.string().optional().default(""),
  curriculumStandards: z.string(),
  learnerContext: z.string(),
  learningExperienceNarrative: z.string().optional().default(""),
  assessmentNarrative: z.string().optional().default(""),
  waysForwardNarrative: z.string().optional().default(""),
  sessions: z.array(SessionPlanSchema).min(1).max(5)
});

export type GeneratedLesson = z.infer<typeof GeneratedLessonSchema>;

export const defaultInput: LessonInput = {
  language: "English",
  inputMode: "manual",
  schoolYear: "2026-2027",
  term: "Term 1",
  pageOrientation: "Landscape",
  paperSize: "A4",
  outputDepth: "Detailed",
  pptTheme: "Basic Light",
  pptPageCount: 20,
  pptImageModel: "imagen-4-fast",
  pptImageStylePreset: "3D",
  week: "",
  teachingDates: "",
  school: "",
  learningArea: "",
  teacherName: "",
  teacherRole: "",
  checkedBy: "",
  checkerRole: "",
  gradeLevelSection: "",
  lessonTitle: "",
  sessionCount: 5,
  sessionDurationMinutes: 60,
  references: "",
  sourceMaterials: "",
  aiUseDeclaration:
    "AI was used as guided support to organize teacher-provided competencies and sources, draft possible KSA unpacking, improve clarity, and format the lesson plan using the ILAW framework. The teacher remains responsible for reviewing, validating, revising, and approving the objectives, learning sequence, assessments, accommodations, and ways forward before classroom use.",
  learningCompetency: "",
  contentStandard: "",
  performanceStandard: "",
  curriculumStandards: "",
  learningObjectives: "",
  learnerContext: "",
  resourceNotes: "",
  integrationNotes: "",
  assessmentNotes: "",
  waysForwardNotes: ""
};

export const rubricItems = [
  "Intentions are clearly stated, with appropriate learning competencies articulated.",
  "Intentions are evident across all sections; there is coherence.",
  "Learning experience is clear - another teacher can implement this lesson without additional explanation.",
  "Learning experience is well-designed, with intentionally embedded Learning Design Principles.",
  "Learning experience maximizes available opportunities for integration.",
  "Learning experience is inclusive, and provides opportunities to support learners with disabilities, barriers, and unique contexts.",
  "Assessment strategies are integrated throughout the session to see learners' progress or if they need support.",
  "Assessment strategies generate evidence if learning is successful.",
  "The following interventions are actionable, providing ways to extend or adjust learning based on reflections."
];
