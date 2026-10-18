import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import mammoth from "mammoth";
import { generateLesson } from "../lib/ai";
import { packDocx } from "../lib/docx";
import { buildFallbackLesson } from "../lib/fallback";
import { applyGadToLesson, gadInstructions, GAD_POLICY_REFERENCE, withGadReference } from "../lib/gad";
import { buildGammaInputText } from "../lib/gamma";
import { generateLAS, packLASDocx } from "../lib/las";
import { formatIntegrationText } from "../lib/lesson-format";
import { defaultInput, GeneratedLessonSchema, LessonInputSchema, lessonLanguages, outputDepths } from "../lib/schemas";

const input = LessonInputSchema.parse({
  ...defaultInput,
  sessionCount: 3,
  learningArea: "General Mathematics",
  gradeLevelSection: "Grade 11",
  lessonTitle: "Practical Measurement in Residential Spaces",
  learningCompetency: "Measure lengths; calculate areas; justify a residential layout.",
  contentStandard: "Apply measurement to residential spaces.",
  performanceStandard: "Prepare and explain an accurate residential layout.",
  references: "Teacher-provided measurement activity",
  gadFocusNotes: "Rotate measuring, drawing, calculating, and reporting roles."
});

async function withTextProvider<T>(responseContent: unknown, action: (provider: { apiKey: string; model: string; baseURL: string }, requests: string[]) => Promise<T>) {
  const requests: string[] = [];
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    requests.push(body);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify(responseContent) } }] }));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    return await action({ apiKey: "local-test-key", model: "gemini-test", baseURL: `http://127.0.0.1:${address.port}/v1` }, requests);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("older clients default to GAD on; disabled and oversized settings are validated", () => {
  const legacy = { ...input } as Partial<typeof input>;
  delete legacy.gadIntegrationEnabled;
  delete legacy.gadFocusNotes;
  assert.equal(LessonInputSchema.parse(legacy).gadIntegrationEnabled, true);
  assert.equal(LessonInputSchema.parse({ ...input, gadIntegrationEnabled: false }).gadIntegrationEnabled, false);
  assert.equal(LessonInputSchema.safeParse({ ...input, gadIntegrationEnabled: "false" }).success, false);
  assert.equal(LessonInputSchema.safeParse({ ...input, gadFocusNotes: "a".repeat(2001) }).success, false);
});

test("all session counts, depths, and languages retain subject content and actionable GAD directions", () => {
  for (const sessionCount of [1, 2, 3, 4, 5]) {
    for (const outputDepth of outputDepths) {
      for (const language of lessonLanguages) {
        const settings = { ...input, sessionCount, outputDepth, language };
        const original = buildFallbackLesson({ ...settings, gadIntegrationEnabled: false });
        const snapshot = JSON.stringify(original);
        const result = GeneratedLessonSchema.parse(applyGadToLesson(settings, original));
        assert.equal(JSON.stringify(original), snapshot, "do not mutate the approved source");
        assert.equal(result.sessions.length, sessionCount);
        assert.equal(result.learningCompetency, settings.learningCompetency);
        assert.equal(result.contentStandard, settings.contentStandard);
        assert.equal(result.performanceStandard, settings.performanceStandard);
        assert.match(result.references, /DepEd Order No\. 32, s\. 2017/);
        for (const [index, session] of result.sessions.entries()) {
          assert.deepEqual(session.learningObjectives, original.sessions[index].learningObjectives);
          assert.equal(session.flow.length, original.sessions[index].flow.length);
          assert.equal(session.formativeAssessment.length, original.sessions[index].formativeAssessment.length);
          original.sessions[index].flow.forEach((text, i) => assert.ok(session.flow[i].startsWith(text)));
          assert.match(session.integration, /GAD:/);
          assert.match(session.flow.join("\n"), /GAD Participation:/);
          assert.match(session.formativeAssessment.join("\n"), /GAD Fair Assessment:/);
          assert.match(session.reflectionPrompt, /GAD Reflection:.*\?/);
          if (language === "Filipino") assert.match(session.integration, /patas na pakikilahok/);
        }
        assert.deepEqual(applyGadToLesson(settings, result), result, "repeated exports must not duplicate directions");
      }
    }
  }
});

test("disabled GAD leaves source content and references unchanged while retaining inclusive prompt rules", () => {
  const settings = { ...input, gadIntegrationEnabled: false };
  const original = buildFallbackLesson(settings);
  assert.strictEqual(applyGadToLesson(settings, original), original);
  assert.doesNotMatch(original.references, /DepEd Order No\. 32/);
  assert.doesNotMatch(original.sessions[0].integration, /GAD:/);
  assert.match(gadInstructions(settings, "lesson"), /gender-fair language/);
  assert.doesNotMatch(gadInstructions(settings, "lesson"), /Policy reference/);
  assert.equal(withGadReference(GAD_POLICY_REFERENCE), GAD_POLICY_REFERENCE);
  assert.equal(withGadReference("DepEd Order No. 32, s. 2017"), "DepEd Order No. 32, s. 2017");
});

test("three-session AI lesson repair survives concise truncation and reaches the unchanged DOCX table", async () => {
  const settings = { ...input, outputDepth: "Concise" as const };
  const raw = buildFallbackLesson({ ...settings, gadIntegrationEnabled: false });
  raw.sessions.forEach((session) => {
    session.flow.push("GAD Participation: rotate roles in this late item.");
    session.formativeAssessment.push("GAD Fair Assessment: check participation in this late item.");
  });
  await withTextProvider(raw, async (provider, requests) => {
    const { lesson } = await generateLesson(settings, provider);
    const prompt = requests.join("\n");
    assert.match(prompt, /Rotate measuring, drawing, calculating, and reporting roles/);
    assert.match(prompt, /EVERY selected session/);
    assert.equal(lesson.sessions.length, 3);
    for (const session of lesson.sessions) {
      assert.equal(session.flow.length, 3);
      assert.match(session.flow.join("\n"), /GAD Participation:/);
      assert.match(session.formativeAssessment.join("\n"), /GAD Fair Assessment:/);
    }
    const baseline = buildFallbackLesson({ ...settings, gadIntegrationEnabled: false });
    const enhancedHtml = await mammoth.convertToHtml({ buffer: await packDocx(settings, lesson) });
    const baselineHtml = await mammoth.convertToHtml({ buffer: await packDocx(settings, baseline) });
    for (const tag of ["table", "tr", "td"]) {
      const pattern = new RegExp(`<${tag}(?:>| )`, "g");
      assert.equal(enhancedHtml.value.match(pattern)?.length, baselineHtml.value.match(pattern)?.length, `${tag} layout is unchanged`);
    }
    assert.equal(enhancedHtml.value.match(/GAD Participation:/g)?.length, 3);
    assert.equal(enhancedHtml.value.match(/GAD Reflection:/g)?.length, 3);
    assert.match(enhancedHtml.value, /Opportunities for integration:/);
  });
});

test("LAS requests carry the approved session integration and repaired participation survives DOCX export", async () => {
  const lesson = buildFallbackLesson(input);
  const raw = {
    sessions: lesson.sessions.map((session) => ({
      objectives: session.learningObjectives,
      letUsApply: {
        context: "Plan a shared residential space using measured dimensions.",
        output: "A labeled layout and checked area calculations.",
        instructions: ["Measure dimensions.", "Draw and label the plan.", "Calculate and explain each area."]
      }
    }))
  };
  await withTextProvider(raw, async (provider, requests) => {
    const las = await generateLAS(input, lesson, provider);
    assert.match(requests[0], /GAD integration|Gender and Development/);
    assert.match(requests[0], /Rotate measuring, drawing, calculating/);
    for (const [index, session] of las.sessions.entries()) {
      assert.deepEqual(session.objectives, lesson.sessions[index].learningObjectives);
      assert.match(session.letUsApply.instructions.join("\n"), /GAD Participation:/);
      assert.ok(session.references.some((ref) => ref.includes("DepEd Order No. 32")));
    }
    const result = await mammoth.extractRawText({ buffer: await packLASDocx(las) });
    assert.equal(result.value.match(/GAD Participation:/g)?.length, 3);
    assert.match(result.value, /Calculate and explain each area/);
  });
  const disabled = { ...input, gadIntegrationEnabled: false };
  await withTextProvider(raw, async (provider) => {
    const las = await generateLAS(disabled, buildFallbackLesson(disabled), provider);
    assert.doesNotMatch(las.sessions[0].letUsApply.instructions.join("\n"), /GAD Participation:/);
    assert.ok(las.sessions[0].references.every((ref) => !ref.includes("DepEd Order No. 32")));
  });
});

test("presentation instructions retain each session's integration, objectives, reflection, and visual safeguards", () => {
  const lesson = buildFallbackLesson(input);
  const prompt = buildGammaInputText(input, lesson);
  for (const session of lesson.sessions) {
    assert.ok(prompt.includes(session.integration));
    assert.ok(prompt.includes(session.reflectionPrompt));
    assert.ok(prompt.includes(session.learningObjectives[0]));
  }
  assert.match(prompt, /stereotyped occupations/);
  assert.match(prompt, /Keep the requested slide count/);
  assert.equal(formatIntegrationText("ICT: Use a diagram. GAD: Share tools. Numeracy: Check units."), "ICT: Use a diagram.\nGAD: Share tools.\nNumeracy: Check units.");
});
