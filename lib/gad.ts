import type { GeneratedLesson, LessonInput } from "./schemas";

export const GAD_POLICY_TITLE = "DepEd Order No. 32, s. 2017 — Gender-Responsive Basic Education Policy";
export const GAD_POLICY_URL = "https://www.deped.gov.ph/2017/06/29/do-32-s-2017-gender-responsive-basic-education-policy/";
export const GAD_POLICY_REFERENCE = `${GAD_POLICY_TITLE}. ${GAD_POLICY_URL}`;

export function gadEnabled(input: LessonInput) {
  // Match the input-schema default for older clients that omit this setting.
  return input.gadIntegrationEnabled !== false;
}

export function gadInstructions(input: LessonInput, target: "lesson" | "las" | "presentation") {
  const baseline = "Use respectful, gender-fair language and stereotype-free examples. Never infer a learner's gender from names, appearance, interests, or performance; never require disclosure of gender identity, sexuality, or personal experiences of violence.";
  if (!gadEnabled(input)) return baseline;

  return `Gender and Development (GAD) integration for every ${target} session:
- Policy reference supplied by this application: ${GAD_POLICY_REFERENCE}. This is a design reference, not certification of policy compliance.
- Preserve the exact teacher-entered competencies, standards, subject objectives, session count, and existing document template. Integrate GAD through subject learning rather than adding an unrelated lecture or replacing curriculum content.
- ${baseline}
- In EVERY selected session, connect a concrete GAD action to that session's competency, practice task, and evidence of learning. Use age-appropriate scenarios showing people of different genders sharing technical, leadership, caregiving, household, and professional roles without stereotypes. Never claim one gender has an inherent ability or interest.
- Give every learner equitable access to tools, speaking turns, leadership, practice, feedback, and appropriate support. Rotate group roles by turn or choice, not by gender. Avoid boys-versus-girls teams and compulsory gender grouping.
- Use the same competency-based success criteria for all learners, with accessible response options assessing the same skill. Do not grade gender identity, conformity, or agreement with a personal belief. Do not collect sensitive personal data for a classroom GAD task.
- Include a teacher reflection QUESTION about who participated, who encountered barriers, and what support to adjust. Do not invent participation statistics, gender gaps, achievements, disclosures, or completed reflections.
- Write in the selected language (${input.language}); retain the short GAD labels where requested.
${target === "lesson" ? `- Put a clearly labeled "GAD:" entry in each existing Opportunities for integration cell. Within the existing Flow array include "GAD Participation:" with a concrete role/tool/turn-taking action early enough to survive concise output. Within an existing formative-assessment item include "GAD Fair Assessment:" and in the reflection include "GAD Reflection:". Keep normal subject instruction and evidence tasks intact; do not add template rows or extra array items beyond the selected depth limits.` : ""}
${target === "las" ? `- Carry the matching approved lesson session's GAD integration into its examples and Let Us Try/Do/Apply tasks. Copy the approved lesson objectives exactly. Include a concise "GAD Participation:" direction in the existing Let Us Apply instructions and use fair, competency-based rubric criteria. Keep the LAS section layout unchanged.` : ""}
${target === "presentation" ? `- Carry each approved session's GAD integration into its practice/discussion/quick check. Give a visible learner-facing participation cue in each session. All generated images must represent diverse people with equal agency in varied roles; avoid gender-coded colors, stereotyped occupations, sexualization, and gender caricatures. Keep the requested slide count and exact lesson objectives.` : ""}
Teacher's optional GAD context (use only when consistent with the competency and principles above):
${input.gadFocusNotes?.trim() || "Use equal participation, shared responsibilities, and equitable access in the topic's own context."}`;
}

export function withGadReference(references: string) {
  const existing = references.trim();
  if (/DO_s2017_032|(?:DepEd\s+Order\s+(?:No\.?\s*)?|DO\s*)0?32[,\s]+s\.?\s*2017|gender-responsive basic education policy/i.test(existing)) return existing;
  return [existing, GAD_POLICY_REFERENCE].filter(Boolean).join("\n");
}

function appendLabeled(text: string, label: string, note: string) {
  return text.includes(label) ? text : [text.trim(), `${label} ${note}`].filter(Boolean).join("\n");
}

export function gadSessionSupport(input: LessonInput, sessionIndex: number) {
  const filipino = input.language === "Filipino";
  const participation = filipino ? [
    "Sa gabay na pagsasanay, salit-salitan ang paggamit ng kagamitan at pagpapaliwanag; pumili ng tungkulin ayon sa pagkakataon, hindi sa kasarian.",
    "Sa gawaing pangkat, paikutin ang tungkulin ng tagapanguna, tagatala, tagasuri, at tagapag-ulat upang lahat ay makapagsanay ng parehong kasanayan.",
    "Bago ibahagi ang sagot, bigyan ang bawat kasapi ng pagkakataong magmungkahi at magsuri; isama ang ideya ng tahimik na kasapi nang may paggalang.",
    "Bigyan ang lahat ng pantay na pagkakataong gumamit ng kagamitan at magpakita ng solusyon o produkto; maglaan ng angkop na tulong ayon sa pangangailangan.",
    "Salit-salitan sa pagpapakita at pagsusuri ng output; gumamit ng magalang na puna batay sa ebidensiya, hindi sa kasarian."
  ] : [
    "During guided practice, take turns using the learning tools and explaining the task; assign roles by turn or choice rather than gender.",
    "During the group task, rotate facilitator, recorder, checker, and reporter roles so every learner practices the same subject skill.",
    "Before sharing an answer, give each member a turn to propose and check an idea; invite quieter members to contribute respectfully.",
    "Give every learner access to the task materials and a turn to demonstrate the solution or product, with support based on need.",
    "Take turns demonstrating and reviewing the output; give respectful, evidence-based feedback without assumptions about gender."
  ];
  return {
    participation: participation[sessionIndex % participation.length],
    integration: filipino
      ? "Iugnay ang kasanayan ng sesyon sa patas na pakikilahok at sama-samang pananagutan; gumamit ng mga halimbawang walang stereotype at huwag italaga ang kakayahan o tungkulin ayon sa kasarian."
      : "Connect this session's subject task to equitable participation and shared responsibilities; use stereotype-free examples and avoid assigning abilities or roles by gender.",
    assessment: filipino
      ? "Gamitin ang parehong pamantayan ng kasanayan para sa lahat at magbigay ng angkop na paraan ng pagsagot na sumusukat sa parehong kasanayan; huwag humingi ng personal na pagsisiwalat."
      : "Use the same competency-based criteria for everyone and accessible response options that assess the same skill; do not require personal disclosures.",
    reflection: filipino
      ? "Sino ang nagkaroon ng pagkakataong magpaliwanag at gumamit ng kagamitan, anong hadlang ang napansin, at anong tulong ang iaangkop sa susunod?"
      : "Who had opportunities to explain and use materials, what participation barriers were observed, and what support should be adjusted next time?"
  };
}

// Preserve the ILAW table and all subject content. Apply after depth limiting so
// concise output cannot silently lose the minimum actionable GAD practices.
export function applyGadToLesson(input: LessonInput, lesson: GeneratedLesson): GeneratedLesson {
  if (!gadEnabled(input)) return lesson;
  return {
    ...lesson,
    references: withGadReference(lesson.references),
    sessions: lesson.sessions.map((session, index) => {
      const support = gadSessionSupport(input, index);
      const flow = [...session.flow];
      if (!flow.some((item) => item.includes("GAD Participation:"))) {
        const position = Math.min(1, flow.length - 1);
        if (position >= 0) flow[position] = appendLabeled(flow[position], "GAD Participation:", support.participation);
      }
      const assessment = [...session.formativeAssessment];
      if (!assessment.some((item) => item.includes("GAD Fair Assessment:")) && assessment.length) {
        const position = assessment.length - 1;
        assessment[position] = appendLabeled(assessment[position], "GAD Fair Assessment:", support.assessment);
      }
      return {
        ...session,
        flow,
        integration: appendLabeled(session.integration, "GAD:", support.integration),
        formativeAssessment: assessment,
        reflectionPrompt: appendLabeled(session.reflectionPrompt || "", "GAD Reflection:", support.reflection)
      };
    })
  };
}
