import type { GeneratedLesson, LessonInput, SessionPlan } from "./schemas";
import { OFFICIAL_TEMPLATE_NARRATIVES } from "./template-constants";
import { normalizeSessionDurationMinutes, stripObjectiveTiming } from "./lesson-format";

function splitLines(value: string, fallback: string[]) {
  const lines = value
    .split(/\r?\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  return lines.length ? lines : fallback;
}

function sentence(value: string, fallback: string) {
  return value.trim() || fallback;
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


function cleanCompetencyItem(value: string) {
  return value
    .replace(/^[-*•●▪]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .trim();
}

function splitCompetencyItems(value: string) {
  const normalized = value
    .replace(/\r/g, "\n")
    .replace(/[•●▪]/g, "\n")
    .replace(/\n\s*\d+[.)]\s*/g, "\n");

  const items = normalized
    .split(/\n|;/)
    .map(cleanCompetencyItem)
    .filter(Boolean);

  return items.length ? items : ["the teacher-provided learning competency for the week"];
}

function distributeCompetencies(items: string[], sessionCount: number) {
  return Array.from({ length: sessionCount }, (_, index) => {
    const start = Math.floor((index * items.length) / sessionCount);
    const end = Math.floor(((index + 1) * items.length) / sessionCount);
    const group = items.slice(start, Math.max(end, start + 1));
    return group.length ? group : items;
  });
}

function sessionRole(sessionNumber: number, sessionCount: number) {
  if (sessionCount === 1) {
    return "open, develop, apply, assess, synthesize, and reflect on the full weekly competency set";
  }
  if (sessionNumber === 1) {
    return "activate prior knowledge, introduce the competency focus, model key ideas, and begin guided practice";
  }
  if (sessionNumber === sessionCount) {
    return "complete the remaining competency focus, apply learning, gather assessment evidence, synthesize, and reflect";
  }
  return "deepen understanding through guided practice, collaboration, application, and feedback";
}

function referenceSummary(input: LessonInput, fallback: string) {
  return sentence(input.references, fallback);
}

function inferredTitle(input: LessonInput, competencyItems: string[]) {
  const providedTitle = input.lessonTitle?.trim();
  if (providedTitle) return providedTitle;

  const firstCompetency = competencyItems.find(Boolean) || "";
  const title = firstCompetency
    .replace(/\s+/g, " ")
    .replace(/^[a-z]+[\w-]*\s*:\s*/i, "")
    .replace(/[.;:,]\s*$/g, "")
    .trim();

  if (title && title !== "the teacher-provided learning competency for the week") {
    return title.length > 90 ? `${title.slice(0, 87).trim()}...` : title;
  }

  return input.learningArea?.trim() ? `${input.learningArea.trim()} Lesson` : "Generated Lesson";
}


function composeCurriculumStandards(input: LessonInput) {
  const content = input.contentStandard?.trim() || "Teacher to provide the applicable content standard.";
  const performance = input.performanceStandard?.trim() || "Teacher to provide the applicable performance standard.";
  return `Content Standard:
${content}

Performance Standard:
${performance}`;
}

function outputDepthLimits(depth?: LessonInput["outputDepth"]) {
  switch (depth) {
    case "Concise":
      return { objectives: 1, flow: 3, assessment: 3 };
    case "Short":
      return { objectives: 1, flow: 4, assessment: 3 };
    case "Comprehensive":
      return { objectives: 4, flow: 7, assessment: 6 };
    case "Detailed":
    default:
      return { objectives: 1, flow: 5, assessment: 4 };
  }
}


function sessionDurationMinutes(input: LessonInput) {
  return normalizeSessionDurationMinutes(input.sessionDurationMinutes);
}

export function buildFallbackLesson(input: LessonInput): GeneratedLesson {
  const sessionCount = Math.min(5, Math.max(1, input.sessionCount || 5));
  const durationMinutes = sessionDurationMinutes(input);
  const competencyItems = splitCompetencyItems(input.learningCompetency);
  const title = inferredTitle(input, competencyItems);
  const baseObjectives = splitLines(input.learningObjectives, [
    `Identify key ideas and prerequisite skills for ${title}.`,
    `Apply the target competency through guided and collaborative learning tasks.`,
    `Demonstrate understanding through formative assessment, reflection, and feedback.`
  ]);
  const competencyGroups = distributeCompetencies(competencyItems, sessionCount);

  const references = referenceSummary(
    input,
    ""
  );

  const curriculumStandards = composeCurriculumStandards(input);
  const contentStandard = sentence(input.contentStandard, "Teacher to provide the applicable content standard.");
  const performanceStandard = sentence(input.performanceStandard, "Teacher to provide the applicable performance standard.");

  const learnerContext = sentence(
    input.learnerContext,
    `${input.gradeLevelSection || "Learners"} have varied readiness levels and will benefit from context-responsive objectives, explicit modeling, guided practice, collaboration, inclusive supports, frequent formative checks, and feedback-based ways forward.`
  );

  const depthLimits = outputDepthLimits(input.outputDepth);

  const sessions: SessionPlan[] = Array.from({ length: sessionCount }, (_, index) => {
    const sessionNumber = index + 1;
    const mappedTitle = title;
    const partLabel = "";
    const competencyFocus = competencyGroups[index].join("; ");
    const pacingRole = sessionRole(sessionNumber, sessionCount);
    const baseObjective = baseObjectives[index]
      ? cleanObjectiveText(baseObjectives[index], sessionNumber)
      : `Demonstrate understanding of the assigned budgeted competency focus for Day ${sessionNumber}: ${competencyFocus}.`;
    const objective = `${baseObjective} Assigned competency focus: ${competencyFocus}.`;

    return {
      sessionNumber,
      label: `Day ${sessionNumber}`,
      learningObjectives: [
        `${mappedTitle}${partLabel}: ${objective}`,
        `Competency Coverage: Pace the session to ${pacingRole} while preserving the full weekly competency budget.`,
        "Evidence of Learning: Produce evidence through an oral, written, performance, or technology-supported task aligned with the assigned competency focus."
      ].slice(0, depthLimits.objectives),
      preLesson:
        sessionNumber === 1
          ? `Pre-Lesson Readiness: Activate prior knowledge through a short contextual question or word map connected to ${mappedTitle}. Tell learners that the selected ${sessionCount} session(s), each lasting ${durationMinutes} minutes, will cover the full weekly competency set, beginning with: ${competencyFocus}. Ask learners to share what they already know, then surface misconceptions before introducing the objective.`
          : `Active Retrieval: Briefly revisit the previous session using two quick questions, one learner example, and one misconception check before moving to the assigned competency focus for Day ${sessionNumber}: ${competencyFocus}. Keep this readiness segment short enough for a ${durationMinutes}-minute session.`,
      flow: [
        `Introduction / Objective Setting: Present the Day ${sessionNumber} competency focus (${competencyFocus}), the ${durationMinutes}-minute time frame, and success criteria in learner-friendly language. Connect the task to a familiar school, home, community, or work situation.`,
        "Scaffolding: Model the target process step by step using a concrete example. Think aloud about the reasoning, formula, or decision point before learners try a similar task.",
        `Guided Practice / CFU: Let learners solve or explain a parallel example aligned with ${competencyFocus}. Pause to check for common errors and provide immediate corrective feedback.`,
        "Social Learning: Use pair-share, small-group work, or math stations so learners can compare strategies and explain their reasoning using clear academic language.",
        `Independent or Collaborative Application: Learners complete a contextualized task that produces visible evidence for the assigned competency focus (${competencyFocus}), with visual supports or alternative response formats available as needed.`,
        sessionNumber === sessionCount
          ? `Synthesis / Reflection: Ask learners to explain how all budgeted competencies for the week were covered across the selected ${sessionCount} session(s), cite evidence of learning, and identify one strategy for future use.`
          : `Synthesis / Reflection: Ask learners to summarize today's competency focus (${competencyFocus}) and name what still needs practice before the next session.`
      ].slice(0, depthLimits.flow),
      learningResources: sentence(
        input.resourceNotes,
        "PPT presentation; teacher-prepared worksheet; textbook/module or learner material; short video/simulation if available; board/display; learner notebook; visual aids; locally available materials. Emergency option: printed task cards, oral discussion, or copied board work."
      ),
      integration: sentence(
        input.integrationNotes,
        "Connect the lesson to learners' daily experiences, local context, values formation, career readiness, literacy/numeracy, appropriate ICT use, and any relevant cross-curricular connection that strengthens the competency."
      ),
      formativeAssessment: splitLines(input.assessmentNotes, [
        `Quick Check: Ask one oral or written question aligned with the Day ${sessionNumber} competency focus (${competencyFocus}) and use responses to decide who needs reteaching within the ${durationMinutes}-minute session.`,
        `Guided Evidence Task: Learners solve or explain one teacher-modeled item tied to ${competencyFocus} while the teacher checks errors and gives feedback.`,
        `Independent Evidence Task: Learners complete one competency-aligned contextualized item or short task that demonstrates ${competencyFocus} and produces visible evidence.`,
        "Peer/Self-Check: Learners compare answers using success criteria, give brief feedback, and revise work when needed.",
        "Accommodation and Support: Allow oral explanation, partner assistance, visual cues, calculators, or teacher conferencing so all learners can show understanding."
      ]).slice(0, depthLimits.assessment),
      extendedLearning: sentence(
        input.waysForwardNotes,
        `Complete a short enrichment, remediation, or extension activity related to the Day ${sessionNumber} competency focus (${competencyFocus}) based on the evidence gathered during the session, using home, community, or online examples when appropriate.`
      ),
      reflectionPrompt:
        sessionNumber === 1
          ? `Possible Reflection: Which prior knowledge, interests, strengths, barriers, or misconceptions appeared while covering the first competency focus (${competencyFocus}), and what support is needed for the remaining selected session(s)?`
          : `Possible Reflection: What engagement, misconception, adjustment, struggling-learner support, and future recommendation should be noted after Day ${sessionNumber}'s competency focus (${competencyFocus})?`
    };
  });

  return {
    title,
    learningArea: input.learningArea,
    teacherName: input.teacherName,
    gradeLevelSection: input.gradeLevelSection,
    term: input.term,
    week: input.week,
    schoolYear: input.schoolYear,
    sessionLabels: sessions.map((session) => session.label),
    teachingDates: input.teachingDates,
    references,
    aiUseDeclaration: sentence(
      input.aiUseDeclaration,
      "AI was used as guided support to organize teacher-provided competencies and sources, draft possible KSA unpacking, improve clarity, and format the lesson plan using the ILAW framework. The teacher remains responsible for reviewing, validating, revising, and approving the objectives, learning sequence, assessments, accommodations, and ways forward before classroom use."
    ),
    intentionNarrative: OFFICIAL_TEMPLATE_NARRATIVES.intentions,
    learningCompetency: input.learningCompetency,
    contentStandard,
    performanceStandard,
    curriculumStandards,
    learnerContext,
    learningExperienceNarrative: OFFICIAL_TEMPLATE_NARRATIVES.learningExperience,
    assessmentNarrative: OFFICIAL_TEMPLATE_NARRATIVES.assessment,
    waysForwardNarrative: OFFICIAL_TEMPLATE_NARRATIVES.waysForward,
    sessions
  };
}
