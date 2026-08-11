import OpenAI from "openai";
import { existsSync, readFileSync } from "fs";
import path from "path";
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import { z } from "zod";
import { extractJsonObject, getResponseText } from "./json";
import type { GeneratedLesson, LessonInput } from "./schemas";

const FONT_FACE = "Aptos";
const HEADER_OLD_ENGLISH_FONT = "Old English Text MT";
const HEADER_SCHOOL_FONT = "Bookman Old Style";
const HEADER_TITLE_FONT = "Verdana";
const HEADER_FIELD_FONT = "Arial";
const BODY_SIZE = 22;
const SMALL_SIZE = 18;
const TITLE_SIZE = 30;
const SECTION_SIZE = 29;
const BLUE = "000000";
const GOLD = "000000";
const DARK = "000000";
const MID_GRAY = "000000";
const LIGHT_BLUE = "FFFFFF";
const LIGHT_GOLD = "FFFFFF";
const LIGHT_GRAY = "FFFFFF";

const blackBorder = { style: BorderStyle.SINGLE, size: 6, color: "000000" };
const noBorder = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const underlineBorder = { style: BorderStyle.SINGLE, size: 8, color: DARK };
const thickDivider = { style: BorderStyle.SINGLE, size: 18, color: "666666" };
const allBorders = { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder };

const LASRubricRowSchema = z.object({
  criteria: z.string(),
  excellent: z.string(),
  satisfactory: z.string(),
  needsImprovement: z.string()
});

const LASSessionSchema = z.object({
  sessionNumber: z.number().int().min(1).max(5),
  sessionTitle: z.string(),
  learningCompetencies: z.string(),
  objectives: z.array(z.string()).min(1).max(4),
  letUsLearn: z.object({
    concept: z.string(),
    blueprint: z.array(z.string()).min(2).max(8),
    models: z.array(z.string()).min(1).max(3)
  }),
  letUsTry: z.array(z.string()).min(2).max(5),
  letUsDo: z.array(z.string()).min(5).max(10),
  letUsApply: z.object({
    context: z.string(),
    output: z.string(),
    instructions: z.array(z.string()).min(2).max(6)
  }),
  rubric: z.array(LASRubricRowSchema).min(3).max(5),
  references: z.array(z.string()).min(1).max(8)
});

const GeneratedLASSchema = z.object({
  title: z.string(),
  learningArea: z.string(),
  gradeLevel: z.string(),
  school: z.string().optional().default(""),
  division: z.string().optional().default(""),
  term: z.string(),
  week: z.string(),
  teachingDates: z.string(),
  sessions: z.array(LASSessionSchema).min(1).max(5)
});

const LooseLASRubricRowSchema = z.object({
  criteria: z.string().optional().default(""),
  excellent: z.string().optional().default(""),
  satisfactory: z.string().optional().default(""),
  needsImprovement: z.string().optional().default("")
}).passthrough();

const LooseLASSessionSchema = z.object({
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
  rubric: z.array(LooseLASRubricRowSchema).optional().default([]),
  references: z.array(z.string()).optional().default([])
}).passthrough();

const LooseGeneratedLASSchema = z.object({
  title: z.string().optional().default(""),
  learningArea: z.string().optional().default(""),
  gradeLevel: z.string().optional().default(""),
  school: z.string().optional().default(""),
  division: z.string().optional().default(""),
  term: z.string().optional().default(""),
  week: z.string().optional().default(""),
  teachingDates: z.string().optional().default(""),
  sessions: z.array(LooseLASSessionSchema).optional().default([])
}).passthrough();

export type GeneratedLAS = z.infer<typeof GeneratedLASSchema>;

type LASProviderOptions = {
  apiKey?: string;
  model?: string;
  baseURL?: string;
  source?: string;
  globalKeyId?: number | null;
  lasHeaderDivision?: string;
  lasHeaderSchoolName?: string;
};

function maskProviderKey(apiKey: string) {
  if (!apiKey) return "none";
  if (apiKey.length <= 8) return "configured";
  return `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`;
}

function logLasProvider(provider: Required<Pick<LASProviderOptions, "apiKey" | "model" | "baseURL">> & Pick<LASProviderOptions, "source" | "globalKeyId">) {
  if ((process.env.ADMIN_API_DEBUG || process.env.ILAW_API_DEBUG || "").toLowerCase() !== "true") return;
  console.log("LAS provider selected", {
    source: provider.source || "env",
    globalKeyId: provider.globalKeyId ?? null,
    model: provider.model,
    baseURL: provider.baseURL,
    key: maskProviderKey(provider.apiKey)
  });
}

type ProviderError = Error & { status?: number };

function clean(value?: string) {
  return value?.trim() || " ";
}

function filenameSafe(value: string) {
  return value
    .replace(/[^a-z0-9-_ ]/gi, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

function truncate(value: string, max = 80000) {
  return value.length > max ? `${value.slice(0, max)}\n\n[Source text truncated for LAS generation.]` : value;
}

function stripLeadingMarker(value: string) {
  return clean(value).replace(/^\s*(?:\d+|[A-Za-z])[.)]\s+/, "");
}

function compactScheduleValue(value?: string, label?: "term" | "week") {
  const cleaned = clean(value);
  if (label === "term") return cleaned.replace(/^term\s*/i, "").trim() || cleaned;
  if (label === "week") return cleaned.replace(/^week\s*/i, "").trim() || cleaned;
  return cleaned;
}

function envValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function resolveLasSchoolName(fallback?: string, preferred?: string) {
  return preferred?.trim() || envValue(
    "LAS_HEADER_SCHOOL_NAME",
    "LAS_SCHOOL_NAME",
    "SCHOOL_NAME",
    "NEXT_PUBLIC_LAS_HEADER_SCHOOL_NAME"
  ) || clean(fallback);
}

function resolveLasDivision(fallback?: string, preferred?: string) {
  const value = preferred?.trim() || envValue(
    "LAS_HEADER_DIVISION",
    "LAS_SCHOOL_DIVISION",
    "SCHOOL_DIVISION",
    "NEXT_PUBLIC_LAS_HEADER_DIVISION"
  ) || clean(fallback);

  if (!value || value === " ") return "Division of __________________________";
  if (/^division\s+of\b/i.test(value)) return value;
  if (/^division[:\s]+/i.test(value)) return `Division of ${value.replace(/^division[:\s]+/i, "").trim()}`;
  return `Division of ${value}`;
}

function textRun(text: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string } = {}) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italic,
    size: options.size ?? BODY_SIZE,
    color: options.color,
    font: options.font || FONT_FACE
  });
}

function stripMarkdownArtifacts(value: string) {
  return value
    .replace(/\*\*|__/g, "")
    .replace(/\*([^*\s][^*]*?)\*/g, "$1")
    .replace(/_([^_\s][^_]*?)_/g, "$1");
}

function inlineTextRuns(value: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: string; font?: string } = {}) {
  const text = value || " ";
  const runs: TextRun[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const normal = stripMarkdownArtifacts(text.slice(lastIndex, match.index));
      if (normal) runs.push(textRun(normal, options));
    }

    const boldText = match[0].replace(/^\*\*|\*\*$/g, "").replace(/^__|__$/g, "");
    if (boldText) runs.push(textRun(boldText, { ...options, bold: true }));
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    const normal = stripMarkdownArtifacts(text.slice(lastIndex));
    if (normal) runs.push(textRun(normal, options));
  }

  return runs.length ? runs : [textRun(" ", options)];
}

function templateAsset(name: string) {
  return path.join(process.cwd(), "public", "las-template", name);
}

function iconRun(fileName: string, width = 54, height = 54) {
  const filePath = templateAsset(fileName);
  if (!existsSync(filePath)) return textRun("", { size: 2 });
  return new ImageRun({
    data: readFileSync(filePath),
    type: "png",
    transformation: { width, height }
  });
}

function dividerLine() {
  return new Paragraph({
    border: { bottom: thickDivider },
    spacing: { before: 90, after: 170 },
    children: [textRun(" ", { size: 2 })]
  });
}

function templateSectionHeading(title: string, iconName: string) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 11, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 0, bottom: 0, left: 0, right: 70 },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [iconRun(iconName)] })]
          }),
          new TableCell({
            width: { size: 89, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 160, bottom: 0, left: 0, right: 0 },
            children: [
              new Paragraph({
                border: { bottom: underlineBorder },
                spacing: { after: 0 },
                children: [textRun(title, { bold: true, size: SECTION_SIZE, color: DARK })]
              })
            ]
          })
        ]
      })
    ]
  });
}

function blankLine(count = 1) {
  return Array.from({ length: count }, () => para(" ", { after: 60 }));
}


function para(
  value: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    font?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  } = {}
) {
  return new Paragraph({
    alignment: options.alignment,
    heading: options.heading,
    spacing: { after: options.after ?? 90, line: 260 },
    children: inlineTextRuns(value, options)
  });
}

function bullet(value: string) {
  return new Paragraph({
    spacing: { after: 60, line: 245 },
    indent: { left: 360, hanging: 180 },
    children: [
      textRun("•", { size: BODY_SIZE - 4, color: DARK }),
      textRun("  ", { color: DARK }),
      ...inlineTextRuns(stripLeadingMarker(value), { color: DARK })
    ]
  });
}

function numbered(value: string, index: number) {
  return para(`${index + 1}. ${stripLeadingMarker(value)}`, { after: 65, color: DARK });
}

function sectionHeading(title: string) {
  const iconMap: Record<string, string> = {
    "Let Us Learn": "learn.png",
    "Let Us Try": "try.png",
    "Let Us Do": "do.png",
    "Let Us Apply": "apply.png",
    Rubrics: "rubrics.png",
    References: "references.png"
  };
  return templateSectionHeading(title, iconMap[title] || "learn.png");
}

function formulaBox(items: string[]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders,
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: allBorders,
            margins: { top: 100, bottom: 100, left: 150, right: 150 },
            children: [
              para("The Blueprint", { bold: true, color: DARK, after: 60 }),
              ...items.map((item) => bullet(item))
            ]
          })
        ]
      })
    ]
  });
}

function infoTable(rows: [string, string][]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders,
    rows: rows.map(
      ([label, value]) =>
        new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { fill: LIGHT_BLUE },
              borders: allBorders,
              margins: { top: 90, bottom: 90, left: 110, right: 110 },
              children: [para(label, { bold: true, color: BLUE, after: 10 })]
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              borders: allBorders,
              margins: { top: 90, bottom: 90, left: 110, right: 110 },
              children: [para(value, { after: 10 })]
            })
          ]
        })
    )
  });
}

function rubricTable(rows: GeneratedLAS["sessions"][number]["rubric"]) {
  const headerCells = ["Criteria", "3 - Excellent", "2 - Satisfactory", "1 - Needs Improvement"].map(
    (label) =>
      new TableCell({
        borders: allBorders,
        margins: { top: 90, bottom: 90, left: 90, right: 90 },
        children: [para(label, { bold: true, color: DARK, alignment: AlignmentType.CENTER, after: 10 })]
      })
  );

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allBorders,
    rows: [
      new TableRow({ children: headerCells }),
      ...rows.map(
        (row) =>
          new TableRow({
            children: [row.criteria, row.excellent, row.satisfactory, row.needsImprovement].map(
              (value) =>
                new TableCell({
                  borders: allBorders,
                  margins: { top: 90, bottom: 90, left: 90, right: 90 },
                  children: [para(stripLeadingMarker(value), { after: 10, size: SMALL_SIZE, color: DARK })]
                })
            )
          })
      )
    ]
  });
}

function workspaceLines(count: number) {
  return Array.from({ length: count }, () =>
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "D8DEE9" } },
      spacing: { before: 120, after: 120 },
      children: [textRun(" ")]
    })
  );
}

function lineField(label: string, widthPercent = 100) {
  return new Table({
    width: { size: widthPercent, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
            margins: { top: 0, bottom: 0, left: 0, right: 40 },
            children: [para(label, { after: 0, color: DARK, font: HEADER_FIELD_FONT, size: 22 })]
          }),
          new TableCell({
            width: { size: 82, type: WidthType.PERCENTAGE },
            borders: { top: noBorder, bottom: underlineBorder, left: noBorder, right: noBorder },
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [para(" ", { after: 0 })]
          })
        ]
      })
    ]
  });
}

function fieldCell(label: string, width: number, rightMargin = 0) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder },
    margins: { top: 40, bottom: 40, left: 0, right: rightMargin },
    children: [lineField(label)]
  });
}

function headerFieldTable(las: GeneratedLAS, session: GeneratedLAS["sessions"][number]) {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { top: noBorder, bottom: noBorder, left: noBorder, right: noBorder, insideHorizontal: noBorder, insideVertical: noBorder },
    rows: [
      new TableRow({ children: [fieldCell("Name:", 55, 260), fieldCell("Date:", 45)] }),
      new TableRow({ children: [fieldCell("Grade:", 55, 260), fieldCell("Section:", 45)] })
    ]
  });
}

function templateHeader(las: GeneratedLAS, session: GeneratedLAS["sessions"][number]) {
  const subject = clean(las.learningArea || "Learning Area").toUpperCase();
  const division = resolveLasDivision(las.division);
  const schoolName = resolveLasSchoolName(las.school).toUpperCase();

  return [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 18 },
      children: [iconRun("deped-seal.png", 58, 58)]
    }),
    para("Republic of the Philippines", {
      alignment: AlignmentType.CENTER,
      font: HEADER_OLD_ENGLISH_FONT,
      size: 24,
      after: 0
    }),
    para("Department of Education", {
      alignment: AlignmentType.CENTER,
      font: HEADER_OLD_ENGLISH_FONT,
      size: 28,
      after: 0
    }),
    para(division, {
      alignment: AlignmentType.CENTER,
      font: HEADER_SCHOOL_FONT,
      size: 24,
      after: 0
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: "000000" } },
      spacing: { after: 170 },
      children: [textRun(schoolName || "SCHOOL NAME", { bold: true, size: 24, color: DARK, font: HEADER_SCHOOL_FONT })]
    }),
    para("LEARNING ACTIVITY SHEET (LAS)", {
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 26,
      color: DARK,
      font: HEADER_TITLE_FONT,
      after: 0
    }),
    para(subject, {
      alignment: AlignmentType.CENTER,
      bold: true,
      size: 24,
      color: DARK,
      font: HEADER_TITLE_FONT,
      after: 145
    }),
    headerFieldTable(las, session),
    dividerLine(),
    para(`Term: ${compactScheduleValue(las.term, "term")}   Week: ${compactScheduleValue(las.week, "week")}   Session: ${session.sessionNumber}   LC(s): ${clean(session.learningCompetencies)}`, { bold: true, after: 55, color: DARK }),
    para("Objectives:", { bold: true, after: 30, color: DARK }),
    ...session.objectives.map((objective, index) => para(`${index + 1}. ${stripLeadingMarker(objective)}`, { after: 35, color: DARK }))
  ];
}

function sessionChildren(las: GeneratedLAS, session: GeneratedLAS["sessions"][number], includePageBreak: boolean) {
  return [
    ...(includePageBreak ? [new Paragraph({ children: [new PageBreak()] })] : []),
    ...templateHeader(las, session),
    ...blankLine(1),
    sectionHeading("Let Us Learn"),
    para(`Lesson Focus: ${session.sessionTitle}`, { bold: true, color: DARK, after: 60 }),
    para("The Concept", { bold: true, color: DARK, after: 50 }),
    para(session.letUsLearn.concept),
    formulaBox(session.letUsLearn.blueprint),
    para("Models / Worked Examples", { bold: true, color: DARK, after: 50 }),
    ...session.letUsLearn.models.map((model, index) => numbered(model, index)),
    sectionHeading("Let Us Try"),
    para("Guided Practice. Use the hints and incomplete steps to help you solve.", { italic: true, after: 70 }),
    ...session.letUsTry.map((item, index) => numbered(item, index)),
    sectionHeading("Let Us Do"),
    para("Independent Practice. Solve each item and show your complete solution.", { italic: true, after: 70 }),
    ...session.letUsDo.map((item, index) => numbered(item, index)),
    ...workspaceLines(3),
    sectionHeading("Let Us Apply"),
    para("Scenario", { bold: true, color: DARK, after: 50 }),
    para(session.letUsApply.context),
    para("Output", { bold: true, color: DARK, after: 50 }),
    para(session.letUsApply.output),
    ...session.letUsApply.instructions.map((item) => bullet(item)),
    sectionHeading("Rubrics"),
    rubricTable(session.rubric),
    sectionHeading("References"),
    ...session.references.map((reference) => bullet(reference))
  ];
}

function providerMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function isGeminiProvider(model: string, baseURL: string) {
  return /gemini/i.test(model) || /generativelanguage\.googleapis\.com/i.test(baseURL);
}

function isUnsupportedJsonMode(error: unknown) {
  return /response_format|json_object|unsupported|unknown field|invalid argument|400/i.test(providerMessage(error));
}

async function callResponses(client: OpenAI, model: string, prompt: string) {
  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: LAS_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    reasoning: { effort: "low" }
  });
  return getResponseText(response);
}

async function callChat(client: OpenAI, model: string, prompt: string, jsonMode = true) {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: LAS_SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ],
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {})
  });
  return response.choices[0]?.message?.content || "";
}

function buildLasPrompt(input: LessonInput, lesson: GeneratedLesson) {
  const sourceMaterials = truncate(input.sourceMaterials || "");
  const references = input.references || lesson.references || "Teacher-provided lesson plan and uploaded source materials";
  const sessionCount = Math.min(5, Math.max(1, input.sessionCount || lesson.sessions.length || 5));

  return `Create a complete Learning Activity Sheet package in JSON.

Required document behavior:
- Generate exactly ${sessionCount} LAS sessions in one output.
- Each LAS must correspond to the matching lesson-plan session.
- Follow the template sections: Objectives, Let Us Learn, Let Us Try, Let Us Do, Let Us Apply, Rubrics, References.
- Make the LAS learner-facing, classroom-ready, and aligned with the learning objectives, content standard, performance standard, and lesson flow.
- Use uploaded source text for examples, activities, prompts, situations, texts, data, or scenarios when appropriate.
- Do not copy long passages from sources. Adapt them into original learner-friendly activities.
- Do not output Markdown formatting. Do not wrap words with **asterisks**, __underscores__, backticks, or markdown bullets.
- Do not hard-code Mathematics, payroll, computations, formulas, or Grade 11 unless the lesson input actually says so.
- Write for the actual learning area/subject, grade level, language, competency, and standards provided in the lesson input.
- Activities must be dynamic and subject-appropriate. For example:
  - Filipino/English: close reading, vocabulary work, grammar practice, speaking tasks, writing tasks, peer review.
  - Science: observation, claim-evidence-reasoning, data interpretation, experiment planning, safety checks.
  - Araling Panlipunan: source analysis, timeline, map interpretation, cause-effect analysis, position statement.
  - Mathematics: worked examples, guided computations, problem solving, real-life application.
  - MAPEH/TLE/Values/ESP: performance tasks, demonstrations, checklists, reflection, product/output creation.
- Let Us Try must provide scaffolded practice with hints, sentence frames, guided questions, partial examples, checklists, or teacher-supported tasks.
- Let Us Do must provide independent practice or individual/small-group learning tasks aligned to the same objectives, not just fixed numbered word problems.
- Let Us Apply must be an authentic performance task with a realistic scenario, clear output, and directions.
- Rubrics must assess the expected output for the subject and performance standard. Do not use computation criteria unless computation is part of the lesson.
- Include only references that came from teacher-provided references, uploaded source names, or the generated lesson plan.
- Return only valid JSON.

JSON shape:
{
  "title": "",
  "learningArea": "",
  "gradeLevel": "",
  "school": "",
  "division": "",
  "term": "",
  "week": "",
  "teachingDates": "",
  "sessions": [
    {
      "sessionNumber": 1,
      "sessionTitle": "",
      "learningCompetencies": "",
      "objectives": ["1-4 objective statements"],
      "letUsLearn": {
        "concept": "2-4 learner-friendly plain-text sentences. Use no markdown symbols.",
        "blueprint": ["2-8 subject-appropriate rules, process steps, language structures, inquiry steps, criteria, formulas, or frameworks"],
        "models": ["1-3 subject-appropriate completed models, sample answers, worked examples, or annotated exemplars"]
      },
      "letUsTry": ["3-5 guided/scaffolded activity items or prompts with hints or support"],
      "letUsDo": ["5-10 independent activity items, prompts, tasks, or checks for mastery"],
      "letUsApply": {
        "context": "authentic real-life or discipline-based scenario",
        "output": "what learners must create, perform, write, solve, present, or submit",
        "instructions": ["3-6 clear step-by-step directions"]
      },
      "rubric": [
        { "criteria": "Subject-appropriate criterion", "excellent": "", "satisfactory": "", "needsImprovement": "" }
      ],
      "references": [""]
    }
  ]
}

Lesson input:
${JSON.stringify(input, null, 2)}

Generated lesson plan to align with:
${JSON.stringify(lesson, null, 2)}

References:
${references}

Uploaded source excerpts:
${sourceMaterials || "No uploaded source text provided."}`;
}

const LAS_SYSTEM_PROMPT = `You are an expert DepEd educational materials designer for all subjects and grade levels. Generate professional Learning Activity Sheets (LAS) that are source-grounded, learner-facing, template-aligned, and ready for classroom use. Adapt activities and assessments to the actual subject, learning objectives, content standard, and performance standard. Do not hard-code Mathematics, payroll, formulas, or any sample subject unless the user input requires it. Do not invent official DepEd references. Do not output markdown or asterisks for bold. Return JSON only.`;

function compactString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function cleanArray(values: unknown, fallback: string[] = []) {
  if (!Array.isArray(values)) return fallback;
  const cleaned = values
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean);
  return cleaned.length ? cleaned : fallback;
}

function boundedItems<T>(values: T[], fallbackFactory: (index: number) => T, min: number, max: number): T[] {
  const next = values.slice(0, max);
  for (let index = next.length; index < min; index += 1) {
    next.push(fallbackFactory(index));
  }
  return next.slice(0, max);
}

function sessionTopic(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number) {
  return lessonSession?.label?.trim() || `Session ${index + 1}`;
}

function sessionObjective(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number) {
  return lessonSession?.learningObjectives?.[0]?.trim() || `complete the learning task for Session ${index + 1}`;
}

function defaultBlueprints(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number) {
  const topic = sessionTopic(lessonSession, index);
  return [
    `Identify the main concept or skill in ${topic}.`,
    "Review the examples, source material, or teacher model before answering.",
    "Use the appropriate strategy, process, evidence, language structure, or formula for the subject.",
    "Complete the task with clear reasoning, explanation, performance, or output.",
    "Check your work against the success criteria before submitting."
  ];
}

function defaultModel(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number) {
  const objective = sessionObjective(lessonSession, index);
  return `Model: Study the example, identify the important details, follow the correct process for the subject, and explain how the output shows that you can ${objective}.`;
}

function defaultTryItem(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number, itemIndex: number) {
  const topic = sessionTopic(lessonSession, index);
  const hints = [
    "Hint: Identify the key idea or evidence first.",
    "Hint: Use the model or sentence frame provided by the teacher.",
    "Hint: Check whether the response should be an explanation, output, solution, performance, or reflection.",
    "Hint: Compare your work with a partner before finalizing."
  ];
  return `Guided Activity ${itemIndex + 1}: Complete a supported task about ${topic.toLowerCase()}. ${hints[itemIndex % hints.length]}`;
}

function defaultDoItem(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number, itemIndex: number) {
  const objective = sessionObjective(lessonSession, index);
  return `Independent Task ${itemIndex + 1}: Complete one learner task that shows you can ${objective}. Show your answer, output, explanation, or performance evidence clearly.`;
}

function defaultApplyInstruction(lessonSession: GeneratedLesson["sessions"][number] | undefined, index: number, itemIndex: number) {
  const topic = sessionTopic(lessonSession, index);
  const instructions = [
    `Read the real-life or subject-based ${topic.toLowerCase()} scenario carefully.`,
    "Identify what the task is asking you to create, explain, solve, perform, or decide.",
    "Use evidence, correct process, appropriate language, or accurate reasoning to complete the output.",
    "Write a brief explanation or reflection based on your output.",
    "Check your work using the rubric before submitting."
  ];
  return instructions[itemIndex % instructions.length];
}

function defaultRubricRows(): GeneratedLAS["sessions"][number]["rubric"] {
  return [
    {
      criteria: "Accuracy and Understanding",
      excellent: "The output shows accurate understanding of the lesson and addresses the task completely.",
      satisfactory: "The output shows mostly accurate understanding with minor gaps or errors.",
      needsImprovement: "The output shows limited understanding or several missing parts."
    },
    {
      criteria: "Process and Evidence",
      excellent: "The learner follows the appropriate process and gives clear evidence, reasoning, or support.",
      satisfactory: "The learner follows most of the process but needs more detail or support in some parts.",
      needsImprovement: "The process is unclear, incomplete, or not supported by evidence."
    },
    {
      criteria: "Application and Presentation",
      excellent: "The output applies the lesson meaningfully and is organized, clear, and ready to present or submit.",
      satisfactory: "The output applies the lesson but organization or presentation can still improve.",
      needsImprovement: "The output has weak application or is difficult to understand."
    }
  ];
}

function normalizeRubric(rows: unknown): GeneratedLAS["sessions"][number]["rubric"] {
  const parsedRows = Array.isArray(rows) ? rows : [];
  const cleaned = parsedRows
    .map((row) => {
      const value = typeof row === "object" && row ? (row as Record<string, unknown>) : {};
      return {
        criteria: compactString(value.criteria, "Criterion"),
        excellent: compactString(value.excellent, "Complete, accurate, and clearly explained."),
        satisfactory: compactString(value.satisfactory, "Mostly complete with minor errors."),
        needsImprovement: compactString(value.needsImprovement, "Incomplete or needs more support.")
      };
    })
    .filter((row) => row.criteria !== "Criterion" || row.excellent || row.satisfactory || row.needsImprovement);

  const fallback = defaultRubricRows();
  return boundedItems(cleaned, (index) => fallback[index % fallback.length], 3, 5);
}

function normalizeGeneratedLAS(input: LessonInput, lesson: GeneratedLesson, raw: unknown, providerOptions: LASProviderOptions = {}): GeneratedLAS {
  const parsed = LooseGeneratedLASSchema.parse(raw);
  const sessionCount = Math.min(5, Math.max(1, input.sessionCount || lesson.sessions.length || 5));
  const fallbackReferences = (input.references || lesson.references || "Teacher-provided lesson plan and uploaded source materials")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const safeReferences = fallbackReferences.length ? fallbackReferences : ["Teacher-provided lesson plan and uploaded source materials"];

  const sessions = Array.from({ length: sessionCount }, (_, index) => {
    const lessonSession = lesson.sessions[index];
    const rawSession = parsed.sessions[index] || {};
    const title = compactString(rawSession.sessionTitle, sessionTopic(lessonSession, index));
    const objectives = boundedItems(
      cleanArray(rawSession.objectives, lessonSession?.learningObjectives || []),
      (itemIndex) => sessionObjective(lessonSession, index) || `complete Session ${index + 1} learning task ${itemIndex + 1}`,
      1,
      4
    );
    const blueprint = boundedItems(
      cleanArray(rawSession.letUsLearn?.blueprint, defaultBlueprints(lessonSession, index)),
      (itemIndex) => defaultBlueprints(lessonSession, index)[itemIndex % defaultBlueprints(lessonSession, index).length],
      2,
      8
    );
    const models = boundedItems(
      cleanArray(rawSession.letUsLearn?.models, []),
      (itemIndex) => `${defaultModel(lessonSession, index)} Example ${itemIndex + 1}: Use the same process with the values given by your teacher.`,
      1,
      3
    );
    const tryItems = boundedItems(
      cleanArray(rawSession.letUsTry, []),
      (itemIndex) => defaultTryItem(lessonSession, index, itemIndex),
      3,
      5
    );
    const doItems = boundedItems(
      cleanArray(rawSession.letUsDo, []),
      (itemIndex) => defaultDoItem(lessonSession, index, itemIndex),
      5,
      10
    );
    const instructions = boundedItems(
      cleanArray(rawSession.letUsApply?.instructions, []),
      (itemIndex) => defaultApplyInstruction(lessonSession, index, itemIndex),
      3,
      6
    );
    const references = boundedItems(cleanArray(rawSession.references, safeReferences), (itemIndex) => safeReferences[itemIndex % safeReferences.length], 1, 8);

    return {
      sessionNumber: index + 1,
      sessionTitle: title,
      learningCompetencies: compactString(rawSession.learningCompetencies, lesson.learningCompetency || input.learningCompetency),
      objectives,
      letUsLearn: {
        concept: compactString(
          rawSession.letUsLearn?.concept,
          `This LAS focuses on ${title}. You will study the key ideas, follow a process, and apply the skill to a realistic classroom task.`
        ),
        blueprint,
        models
      },
      letUsTry: tryItems,
      letUsDo: doItems,
      letUsApply: {
        context: compactString(
          rawSession.letUsApply?.context,
          `Imagine you are helping a classmate complete a real-life task about ${title.toLowerCase()}.`
        ),
        output: compactString(rawSession.letUsApply?.output, `A completed ${title.toLowerCase()} solution with a short explanation.`),
        instructions
      },
      rubric: normalizeRubric(rawSession.rubric),
      references
    };
  });

  return GeneratedLASSchema.parse({
    title: parsed.title || lesson.title || input.lessonTitle || "Learning Activity Sheet",
    learningArea: parsed.learningArea || lesson.learningArea || input.learningArea || "Learning Area",
    gradeLevel: parsed.gradeLevel || lesson.gradeLevelSection || input.gradeLevelSection || "Grade Level",
    school: resolveLasSchoolName(input.school || parsed.school, providerOptions.lasHeaderSchoolName),
    division: resolveLasDivision(parsed.division, providerOptions.lasHeaderDivision),
    term: parsed.term || input.term,
    week: parsed.week || input.week,
    teachingDates: parsed.teachingDates || input.teachingDates,
    sessions
  });
}

export async function generateLAS(input: LessonInput, lesson: GeneratedLesson, providerOptions: LASProviderOptions = {}) {
  const model = providerOptions.model || process.env.OPENAI_MODEL || "gpt-5.4-mini";
  const baseURL = providerOptions.baseURL || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  const apiKey = providerOptions.apiKey || process.env.OPENAI_API_KEY || "";

  if (!apiKey) {
    throw new Error("AI generation is not configured. Add an Admin rotating API key, add a dedicated user API key, or set OPENAI_API_KEY before generating LAS.");
  }

  logLasProvider({
    apiKey,
    model,
    baseURL,
    source: providerOptions.source,
    globalKeyId: providerOptions.globalKeyId
  });

  const client = new OpenAI({ apiKey, baseURL });
  const prompt = buildLasPrompt(input, lesson);

  async function parseText(text: string) {
    return normalizeGeneratedLAS(input, lesson, extractJsonObject(text), providerOptions);
  }

  if (isGeminiProvider(model, baseURL)) {
    try {
      return await parseText(await callChat(client, model, prompt));
    } catch (error) {
      if (!isUnsupportedJsonMode(error)) throw error;
      return parseText(await callChat(client, model, prompt, false));
    }
  }

  try {
    return await parseText(await callResponses(client, model, prompt));
  } catch (responsesError) {
    try {
      return await parseText(await callChat(client, model, prompt));
    } catch (chatError) {
      const status =
        typeof responsesError === "object" && responsesError && "status" in responsesError
          ? (responsesError as ProviderError).status
          : typeof chatError === "object" && chatError && "status" in chatError
            ? (chatError as ProviderError).status
            : undefined;
      throw new Error(
        `LAS generation failed.${status ? ` Provider status: ${status}.` : ""} Responses: ${providerMessage(responsesError)} Chat: ${providerMessage(chatError)}`
      );
    }
  }
}

export async function packLASDocx(las: GeneratedLAS) {
  const children = las.sessions.flatMap((session, index) => sessionChildren(las, session, index > 0));

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT_FACE, size: BODY_SIZE, color: "000000" },
          paragraph: { spacing: { line: 260, after: 80 } }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 540, bottom: 540, left: 900, right: 900 }
          }
        },
        children
      }
    ]
  });

  return Packer.toBuffer(doc);
}

export function buildLASFileName(input: LessonInput, las: GeneratedLAS) {
  const base = filenameSafe(`${las.learningArea || input.learningArea || "LAS"}-${las.week || input.week || "Week"}-${las.sessions.length}-Session-LAS`);
  return `${base || "Generated-LAS"}.docx`;
}
