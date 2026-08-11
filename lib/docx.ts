import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType
} from "docx";
import type { GeneratedLesson, LessonInput, SessionPlan } from "./schemas";
import { rubricItems } from "./schemas";
import { OFFICIAL_TEMPLATE_HELPERS, OFFICIAL_TEMPLATE_NARRATIVES, SELF_CHECK_RUBRIC_TITLE } from "./template-constants";
import { cleanObjectiveText, formatIntegrationText, formatSessionHeaderLabel } from "./lesson-format";

type CellBorder = {
  style: (typeof BorderStyle)[keyof typeof BorderStyle];
  size: number;
  color: string;
};

type CellBorders = {
  top: CellBorder;
  bottom: CellBorder;
  left: CellBorder;
  right: CellBorder;
};

const blackBorder: CellBorder = {
  style: BorderStyle.SINGLE,
  size: 8,
  color: "000000"
};

const dottedBorder: CellBorder = {
  style: BorderStyle.DOTTED,
  size: 8,
  color: "333333"
};

const allBorders: CellBorders = {
  top: blackBorder,
  bottom: blackBorder,
  left: blackBorder,
  right: blackBorder
};

const FONT_FACE = "Aptos";
const BODY_SIZE = 20; // 10 pt
const SMALL_SIZE = 15; // 7.5 pt helper text
const LABEL_SIZE = 20;
const SECTION_TITLE_SIZE = 25; // 12.5 pt
const TABLE_SHADE = "D9D9D9";

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

function pageSize(input: LessonInput) {
  const sizes = {
    A4: { width: 11906, height: 16838 },
    Letter: { width: 12240, height: 15840 },
    Legal: { width: 12240, height: 20160 },
    Folio: { width: 12240, height: 18720 }
  } satisfies Record<LessonInput["paperSize"], { width: number; height: number }>;

  return {
    ...sizes[input.paperSize],
    orientation:
      input.pageOrientation === "Landscape"
        ? PageOrientation.LANDSCAPE
        : PageOrientation.PORTRAIT
  };
}

function textRun(
  text: string,
  options: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}
) {
  return new TextRun({
    text,
    bold: options.bold,
    italics: options.italic,
    font: FONT_FACE,
    size: options.size ?? BODY_SIZE,
    color: options.color
  });
}


function shouldEmphasizeLabel(label: string) {
  const cleaned = label.trim();
  if (!cleaned || cleaned.length > 72) return false;
  // Allow slash-based teaching labels such as "Guided Practice/CFU" and
  // "Social Learning / Collaboration". Only reject labels that look like
  // URLs, emails, or file paths.
  if (/https?:|www\.|@|\.com\b|\.gov\b|\.edu\b/i.test(cleaned)) return false;
  if (/^[A-Za-z]:\\/.test(cleaned) || /^\//.test(cleaned)) return false;
  return /[A-Za-z]/.test(cleaned);
}

function emphasisRuns(value: string, options: { bold?: boolean; italic?: boolean; size?: number; color?: string } = {}) {
  if (/^(Textbooks and Modules|Websites)$/i.test(value.trim())) {
    return [textRun(value, { ...options, bold: true })];
  }
  const bullet = value.match(/^(\s*•\s*)(.*)$/);
  const prefix = bullet ? bullet[1] : "";
  const body = bullet ? bullet[2] : value;
  const match = body.match(/^([^:]{1,62}):\s*(.*)$/);

  if (!match || !shouldEmphasizeLabel(match[1])) {
    return [textRun(value, options)];
  }

  return [
    ...(prefix ? [textRun(prefix, options)] : []),
    textRun(`${match[1].trim()}:`, { ...options, bold: true }),
    textRun(match[2] ? ` ${match[2]}` : "", options)
  ];
}

function richPara(
  value: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
  } = {}
) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { after: options.after ?? 38, line: 230 },
    children: emphasisRuns(value, {
      bold: options.bold,
      italic: options.italic,
      size: options.size,
      color: options.color
    })
  });
}

function para(
  value: string,
  options: {
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
  } = {}
) {
  return new Paragraph({
    alignment: options.alignment,
    spacing: { after: options.after ?? 38, line: 230 },
    children: [
      textRun(value, {
        bold: options.bold,
        italic: options.italic,
        size: options.size,
        color: options.color
      })
    ]
  });
}

function textParagraphs(value: string, options: { bold?: boolean; italic?: boolean } = {}) {
  const lines = clean(value)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines.map((line) => richPara(line, options)) : [para(" ")];
}

function bulleted(values: string[]) {
  return (values.length ? values : [" "]).map((value) => richPara(`• ${value}`));
}

function learningObjectiveParagraphs(session: SessionPlan) {
  return [
    para(`By the end of ${session.label}, learners will be able to:`, { after: 28 }),
    ...bulleted(session.learningObjectives.map((objective) => cleanObjectiveText(objective, session.sessionNumber)))
  ];
}

function paragraphs(values: string[]) {
  return (values.length ? values : [" "]).map((value) => richPara(value));
}

function tableCell(
  children: string | Paragraph[],
  options: {
    width?: number;
    columnSpan?: number;
    shade?: string;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    verticalAlign?: "top" | "center";
    bold?: boolean;
    italic?: boolean;
    size?: number;
    color?: string;
    borders?: CellBorders;
  } = {}
) {
  return new TableCell({
    width: options.width
      ? {
          size: options.width,
          type: WidthType.PERCENTAGE
        }
      : undefined,
    columnSpan: options.columnSpan,
    verticalAlign: options.verticalAlign,
    borders: options.borders || allBorders,
    shading: options.shade ? { fill: options.shade } : undefined,
    margins: {
      top: 70,
      bottom: 70,
      left: 95,
      right: 95
    },
    children:
      typeof children === "string"
        ? (() => {
            const lines = clean(children)
              .split(/\r?\n/)
              .map((line) => line.trim())
              .filter(Boolean);

            return lines.length
              ? lines.map((line) =>
                  richPara(line, {
                    bold: options.bold,
                    italic: options.italic,
                    size: options.size,
                    color: options.color,
                    alignment: options.align,
                    after: 35
                  })
                )
              : [para(" ", { after: 35 })];
          })()
        : children
  });
}

function labelCell(title: string, helper?: string) {
  return tableCell(
    [
      para(title, { bold: true, italic: true, size: LABEL_SIZE, after: 18 }),
      ...(helper
        ? helper
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => para(line, { italic: true, size: SMALL_SIZE, color: "444444", after: 16 }))
        : [])
    ],
    { width: 18 }
  );
}

function sectionCell(title: string) {
  return tableCell(
    [para(title, { bold: true, size: SECTION_TITLE_SIZE, after: 0 })],
    {
      width: 18,
      shade: TABLE_SHADE,
      verticalAlign: "center"
    }
  );
}

function row(cells: TableCell[]) {
  return new TableRow({ children: cells });
}

function valueRow(label: string, value: string, sessionCount: number, helper?: string) {
  return row([
    labelCell(label, helper),
    tableCell(value, { columnSpan: sessionCount, width: 82 })
  ]);
}

function sectionRow(title: string, narrative: string, sessionCount: number) {
  return row([
    sectionCell(title),
    tableCell(narrative, {
      columnSpan: sessionCount,
      shade: TABLE_SHADE
    })
  ]);
}

function sessionHeaderRow(sessions: SessionPlan[], durationMinutes: unknown) {
  const sessionWidth = 82 / sessions.length;

  return row([
    tableCell(" ", { width: 18, shade: "D9D9D9" }),
    ...sessions.map((session) =>
      tableCell(formatSessionHeaderLabel(session.label, durationMinutes), {
        width: sessionWidth,
        bold: true,
        align: AlignmentType.CENTER,
        shade: TABLE_SHADE
      })
    )
  ]);
}

function sessionRow(
  label: string,
  helper: string,
  sessions: SessionPlan[],
  render: (session: SessionPlan) => string | Paragraph[]
) {
  const sessionWidth = 82 / sessions.length;

  return row([
    labelCell(label, helper),
    ...sessions.map((session) =>
      tableCell(render(session), {
        width: sessionWidth,
        borders: {
          top: blackBorder,
          bottom: blackBorder,
          left: dottedBorder,
          right: dottedBorder
        }
      })
    )
  ]);
}

function competencyAndStandards(lesson: GeneratedLesson) {
  const contentStandard = lesson.contentStandard?.trim() || " ";
  const performanceStandard = lesson.performanceStandard?.trim() || " ";
  return [
    lesson.learningCompetency ? `Learning Competency:\n${lesson.learningCompetency}` : "Learning Competency:\n ",
    `Content Standard:\n${contentStandard}`,
    `Performance Standard:\n${performanceStandard}`
  ].join("\n\n");
}

function officialLessonTable(input: LessonInput, lesson: GeneratedLesson) {
  const sessions = lesson.sessions.slice(0, input.sessionCount);
  const sessionCount = Math.max(1, sessions.length);
  const sessionLabel = `${sessionCount} Session${sessionCount === 1 ? "" : "s"}`;

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      valueRow("Lesson Title", lesson.title, sessionCount),
      valueRow("Learning Area/s", lesson.learningArea, sessionCount),
      valueRow("Name of Teacher/s", lesson.teacherName, sessionCount),
      valueRow("Grade Level and Section", lesson.gradeLevelSection, sessionCount),
      valueRow("Term / Week / Teaching Dates / School Year", `${clean(lesson.term)} | ${clean(lesson.week)} | ${clean(lesson.teachingDates || input.teachingDates)} | S.Y. ${clean(lesson.schoolYear)}`, sessionCount),
      valueRow("No. of Sessions", sessionLabel, sessionCount),
      valueRow("Duration of Each Session", `${clean(String(input.sessionDurationMinutes || 60))} minutes`, sessionCount),
      valueRow(
        "References",
        lesson.references,
        sessionCount,
        OFFICIAL_TEMPLATE_HELPERS.references
      ),
      valueRow(
        "Declaration of AI use",
        lesson.aiUseDeclaration,
        sessionCount,
        OFFICIAL_TEMPLATE_HELPERS.aiUse
      ),
      sectionRow("Intentions.", OFFICIAL_TEMPLATE_NARRATIVES.intentions, sessionCount),
      valueRow(
        "Learning Competency and Curriculum Standards:",
        competencyAndStandards(lesson),
        sessionCount,
        OFFICIAL_TEMPLATE_HELPERS.competency
      ),
      sessionHeaderRow(sessions, input.sessionDurationMinutes),
      sessionRow(
        "Learning Objectives:",
        OFFICIAL_TEMPLATE_HELPERS.objectives,
        sessions,
        (session) => learningObjectiveParagraphs(session)
      ),
      valueRow(
        "Learner Context:",
        lesson.learnerContext,
        sessionCount,
        OFFICIAL_TEMPLATE_HELPERS.learnerContext
      ),
      sectionRow("Learning Experience.", OFFICIAL_TEMPLATE_NARRATIVES.learningExperience, sessionCount),
      sessionRow(
        "Pre-Lesson:",
        OFFICIAL_TEMPLATE_HELPERS.preLesson,
        sessions,
        (session) => textParagraphs(session.preLesson)
      ),
      sessionRow(
        "Flow:",
        OFFICIAL_TEMPLATE_HELPERS.flow,
        sessions,
        (session) => paragraphs(session.flow)
      ),
      sessionRow(
        "Learning Resources:",
        OFFICIAL_TEMPLATE_HELPERS.resources,
        sessions,
        (session) => textParagraphs(session.learningResources)
      ),
      sessionRow(
        "Opportunities for integration:",
        OFFICIAL_TEMPLATE_HELPERS.integration,
        sessions,
        (session) => textParagraphs(formatIntegrationText(session.integration) || session.integration)
      ),
      sectionRow("Assessment.", OFFICIAL_TEMPLATE_NARRATIVES.assessment, sessionCount),
      sessionRow(
        "Formative Assessment:",
        OFFICIAL_TEMPLATE_HELPERS.formativeAssessment,
        sessions,
        (session) => paragraphs(session.formativeAssessment)
      ),
      sectionRow("Ways Forward.", OFFICIAL_TEMPLATE_NARRATIVES.waysForward, sessionCount),
      sessionRow(
        "Extended learning opportunities:",
        OFFICIAL_TEMPLATE_HELPERS.extendedLearning,
        sessions,
        (session) => textParagraphs(session.extendedLearning)
      ),
      sessionRow(
        "Reflections:",
        OFFICIAL_TEMPLATE_HELPERS.reflections,
        sessions,
        (session) => textParagraphs(session.reflectionPrompt || "Possible teacher reflection: note learner engagement, misconceptions, adjustments, support for struggling learners, and recommendation for the next lesson.")
      )
    ]
  });
}

function teacherSignatureTable(input: LessonInput, lesson: GeneratedLesson) {
  const teacherName = clean(input.teacherName || lesson.teacherName);
  const teacherRole = clean(input.teacherRole);
  const checkerName = clean(input.checkedBy);
  const checkerRole = clean(input.checkerRole);

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        tableCell([
          para("Prepared by:", { bold: true, after: 18 }),
          para(teacherName, { bold: true, after: 18 }),
          para(teacherRole, { after: 18 })
        ], { width: 50 }),
        tableCell([
          para("Checked by:", { bold: true, after: 18 }),
          para(checkerName, { bold: true, after: 18 }),
          para(checkerRole, { after: 18 })
        ], { width: 50 })
      ])
    ]
  });
}

function rubricTable() {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      row([
        tableCell("I can say that in my lesson plan...", { width: 45, bold: true }),
        tableCell("Yes", { width: 10, bold: true, align: AlignmentType.CENTER }),
        tableCell("Not Yet", { width: 10, bold: true, align: AlignmentType.CENTER }),
        tableCell("Why?/ What will make it better?", { width: 35, bold: true })
      ]),
      ...rubricItems.map((item) =>
        row([
          tableCell(item, { width: 45 }),
          tableCell(" ", { width: 10 }),
          tableCell(" ", { width: 10 }),
          tableCell(" ", { width: 35 })
        ])
      ),
      row([
        tableCell("Notes for my instructional coaching session:", {
          columnSpan: 4,
          bold: true
        })
      ]),
      row([
        tableCell(" ", {
          columnSpan: 4,
          borders: allBorders
        })
      ])
    ]
  });
}

export function buildDocx(input: LessonInput, lesson: GeneratedLesson) {
  return new Document({
    creator: "ILAW Lesson Plan Generator",
    title: lesson.title,
    description:
      "Official ILAW lesson plan template aligned to teacher-provided DepEd reference materials, generated for teacher review and printing.",
    styles: {
      default: {
        document: {
          run: {
            font: FONT_FACE,
            size: BODY_SIZE
          },
          paragraph: {
            spacing: { after: 38 }
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: pageSize(input),
            margin: {
              top: 430,
              right: 420,
              bottom: 430,
              left: 420
            }
          }
        },
        children: [
          para("LESSON PLAN TEMPLATE", {
            bold: true,
            size: 25,
            alignment: AlignmentType.CENTER,
            after: 100
          }),
          officialLessonTable(input, lesson),
          para(" ", { after: 120 }),
          teacherSignatureTable(input, lesson),
          para(" ", { after: 170 }),
          para(SELF_CHECK_RUBRIC_TITLE, {
            bold: true,
            size: 22,
            alignment: AlignmentType.CENTER,
            after: 100
          }),
          rubricTable()
        ]
      }
    ]
  });
}

export async function packDocx(input: LessonInput, lesson: GeneratedLesson) {
  const doc = buildDocx(input, lesson);
  return Packer.toBuffer(doc);
}

export function buildFileName(input: LessonInput, lesson?: GeneratedLesson) {
  const title = filenameSafe(input.lessonTitle || lesson?.title || "Lesson-Plan");
  return `ILAW-Official-LP-${title}.docx`;
}
