from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file_path = Path(path)
    text = file_path.read_text()
    if old not in text:
        raise SystemExit(f"Expected text not found in {path}: {old[:120]!r}")
    file_path.write_text(text.replace(old, new, 1))


# 1) Shared request schema: expose one provider-neutral thinking control.
replace_once(
    "lib/schemas.ts",
    'export const outputDepths = ["Concise", "Short", "Detailed", "Comprehensive"] as const;\n',
    'export const outputDepths = ["Concise", "Short", "Detailed", "Comprehensive"] as const;\n'
    'export const reasoningEfforts = ["low", "medium", "high"] as const;\n'
)
replace_once(
    "lib/schemas.ts",
    '  outputDepth: z.enum(outputDepths).optional().default("Detailed"),\n',
    '  outputDepth: z.enum(outputDepths).optional().default("Detailed"),\n'
    '  reasoningEffort: z.enum(reasoningEfforts).optional().default("medium"),\n'
)
replace_once(
    "lib/schemas.ts",
    '  outputDepth: "Detailed",\n',
    '  outputDepth: "Detailed",\n'
    '  reasoningEffort: "medium",\n'
)

# 2) Lesson generator: keep existing ILAW quality controls, strengthen subject adaptation and pacing,
#    and drive both Responses and OpenAI-compatible Chat/Gemini with the selected effort.
replace_once(
    "lib/ai.ts",
    'type ProviderError = {\n  status?: unknown;\n};\n',
    'type ProviderError = {\n  status?: unknown;\n};\n\n'
    'type ReasoningEffort = NonNullable<LessonInput["reasoningEffort"]>;\n\n'
    'function reasoningEffort(input: LessonInput): ReasoningEffort {\n'
    '  return input.reasoningEffort || "medium";\n'
    '}\n'
)
replace_once(
    "lib/ai.ts",
    'Task: Create a complete Daily Lesson Log (DLL) using the ILAW format for the exact number of sessions selected in the teacher form. If uploaded source text is provided, use it as supporting reference while keeping teacher-entered curriculum fields authoritative.\n\nGenerate only the lesson-specific fillable content for the official ILAW table.',
    'Task: Create a complete Daily Lesson Log (DLL) using the ILAW format for the exact number of sessions selected in the teacher form. If uploaded source text is provided, use it as supporting reference while keeping teacher-entered curriculum fields authoritative.\n\n'
    'Subject-general design rule: never assume Mathematics or any other subject. First infer the discipline from Learning Area, grade level, competency, standards, and uploaded sources, then use pedagogy appropriate to that discipline. Language subjects should emphasize comprehension, communication, language use, and authentic texts; Science should emphasize inquiry, evidence, models, investigation, and safety when relevant; Mathematics should use representations, reasoning, worked examples, and problem solving when relevant; Araling Panlipunan/social sciences should use sources, chronology, geography, evidence, perspective, and civic reasoning; TLE/TVL should use demonstration, procedure, safety, quality criteria, and authentic performance; MAPEH/Arts/PE should use technique, rehearsal/practice, critique, performance, wellness, or movement as appropriate; Values/GMRC/EsP should use ethical situations, dialogue, reflection, and observable choices; Research/ICT should use inquiry, data, information literacy, digital tools, and authentic products. Do not force formulas, computation, experiments, essays, role-play, or performance tasks when the competency does not call for them.\n\n'
    'Generate only the lesson-specific fillable content for the official ILAW table.'
)
replace_once(
    "lib/ai.ts",
    '- Each selected session is ${durationMinutes} minutes. The app will display this in the day/session header as Day 1 (${durationMinutes}m), Day 2 (${durationMinutes}m), and so on. Use the duration to keep objectives and activities achievable, but do not write minute/session timing phrases inside the objective text.\n',
    '- Each selected session is ${durationMinutes} minutes. The app will display this in the day/session header as Day 1 (${durationMinutes}m), Day 2 (${durationMinutes}m), and so on. Use the duration to keep objectives and activities achievable, but do not write minute/session timing phrases inside the objective text.\n'
    '- Time-budget rule: silently build a realistic minute-by-minute budget before writing each session. The Flow array must represent the complete instructional period and each flow item must begin with a compact allocation such as "10 min — Engage: ...". The minutes across all Flow items for a session must total exactly ${durationMinutes}. Treat Pre-Lesson as preparation/readiness guidance that is incorporated into that same budget, not extra time outside the session. Keep transitions, checking for understanding, practice, feedback, and closure feasible within the allotted time.\n'
    '- Session-count rule: the selected ${selectedSessionCount} session(s) are the entire instructional container. Design exactly ${selectedSessionCount} complete and coherent learning arcs, distribute every teacher-provided competency across them, and make the final selected session include synthesis plus sufficient assessment evidence. If 3 sessions are selected, the complete plan must fit exactly three ${durationMinutes}-minute sessions rather than assuming a five-day sequence.\n'
    '- Subject-adaptation rule: choose teaching moves, learner tasks, evidence, resources, and assessment formats that match the actual learning area and competency. Avoid generic Mathematics-style exercises in non-Mathematics subjects and avoid generic essay/performance tasks when another evidence type is more authentic.\n'
)
replace_once(
    "lib/ai.ts",
    '    reasoning: { effort: "low" }\n',
    '    reasoning: { effort: reasoningEffort(input) }\n'
)
replace_once(
    "lib/ai.ts",
    'async function generateWithChat(client: OpenAI, model: string, input: LessonInput, options: { jsonMode?: boolean } = {}) {\n  const response = await client.chat.completions.create({\n',
    'async function generateWithChat(client: OpenAI, model: string, input: LessonInput, options: { jsonMode?: boolean } = {}) {\n'
    '  const response = await client.chat.completions.create({\n'
)
replace_once(
    "lib/ai.ts",
    '    ],\n    ...(options.jsonMode === false ? {} : { response_format: { type: "json_object" as const } })\n',
    '    ],\n'
    '    reasoning_effort: reasoningEffort(input),\n'
    '    ...(options.jsonMode === false ? {} : { response_format: { type: "json_object" as const } })\n'
)

# 3) LAS generator: same selected thinking level, exact session/time fit, and stronger subject authenticity.
replace_once(
    "lib/las.ts",
    'type ProviderError = Error & { status?: number };\n',
    'type ProviderError = Error & { status?: number };\n\n'
    'type ReasoningEffort = NonNullable<LessonInput["reasoningEffort"]>;\n\n'
    'function reasoningEffort(input: LessonInput): ReasoningEffort {\n'
    '  return input.reasoningEffort || "medium";\n'
    '}\n'
)
replace_once(
    "lib/las.ts",
    'async function callResponses(client: OpenAI, model: string, prompt: string) {\n',
    'async function callResponses(client: OpenAI, model: string, prompt: string, effort: ReasoningEffort) {\n'
)
replace_once(
    "lib/las.ts",
    '    reasoning: { effort: "low" }\n',
    '    reasoning: { effort }\n'
)
replace_once(
    "lib/las.ts",
    'async function callChat(client: OpenAI, model: string, prompt: string, jsonMode = true) {\n',
    'async function callChat(client: OpenAI, model: string, prompt: string, effort: ReasoningEffort, jsonMode = true) {\n'
)
replace_once(
    "lib/las.ts",
    '    ],\n    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {})\n',
    '    ],\n'
    '    reasoning_effort: effort,\n'
    '    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {})\n'
)
replace_once(
    "lib/las.ts",
    'function buildLasPrompt(input: LessonInput, lesson: GeneratedLesson) {\n  const sourceMaterials = truncate(input.sourceMaterials || "");\n',
    'function buildLasPrompt(input: LessonInput, lesson: GeneratedLesson) {\n'
    '  const sourceMaterials = truncate(input.sourceMaterials || "");\n'
    '  const durationMinutes = Math.min(240, Math.max(10, Number(input.sessionDurationMinutes || 60)));\n'
)
replace_once(
    "lib/las.ts",
    '- Generate exactly ${sessionCount} LAS sessions in one output.\n- Each LAS must correspond to the matching lesson-plan session.\n',
    '- Generate exactly ${sessionCount} LAS sessions in one output.\n'
    '- Each LAS must correspond to the matching lesson-plan session and must be feasible within the same ${durationMinutes}-minute class period. Do not design an activity sheet whose reading, practice, application, and reflection workload obviously exceeds the available session time.\n'
    '- Preserve the lesson plan pacing: if the teacher selected ${sessionCount} sessions, the LAS package must contain exactly ${sessionCount} coherent session sheets and must not assume extra unselected days.\n'
    '- Use discipline-authentic learner work. Match the actual subject: reading/speaking/writing for languages when relevant; investigation/evidence/data for science; representations/reasoning/problems for mathematics; source/map/timeline/perspective work for social studies; demonstration/procedure/safety/product quality for TLE/TVL; movement/practice/critique/performance for MAPEH/arts/PE; ethical scenarios/reflection/dialogue for Values/GMRC/EsP; inquiry/data/information literacy/digital products for Research/ICT. Avoid forcing mathematics-style numbered computations into other subjects.\n'
)
replace_once(
    "lib/las.ts",
    '  const client = new OpenAI({ apiKey, baseURL });\n  const prompt = buildLasPrompt(input, lesson);\n',
    '  const client = new OpenAI({ apiKey, baseURL });\n'
    '  const prompt = buildLasPrompt(input, lesson);\n'
    '  const effort = reasoningEffort(input);\n'
)
replace_once(
    "lib/las.ts",
    '      return await parseText(await callChat(client, model, prompt));\n',
    '      return await parseText(await callChat(client, model, prompt, effort));\n'
)
replace_once(
    "lib/las.ts",
    '      return parseText(await callChat(client, model, prompt, false));\n',
    '      return parseText(await callChat(client, model, prompt, effort, false));\n'
)
replace_once(
    "lib/las.ts",
    '    return await parseText(await callResponses(client, model, prompt));\n',
    '    return await parseText(await callResponses(client, model, prompt, effort));\n'
)
replace_once(
    "lib/las.ts",
    '      return await parseText(await callChat(client, model, prompt));\n',
    '      return await parseText(await callChat(client, model, prompt, effort));\n'
)

# 4) Fallback/normalization language: remove remaining mathematics-specific assumptions.
replacements = {
    'Think aloud about the reasoning, formula, or decision point before learners try a similar task.':
        'Think aloud about the reasoning, process, language structure, procedure, technique, or decision point before learners try a similar task.',
    'Use pair-share, small-group work, or math stations so learners can compare strategies and explain their reasoning using clear academic language.':
        'Use pair-share, small-group work, learning stations, rehearsal, source analysis, investigation, or another discipline-appropriate collaborative structure so learners can compare strategies and explain their thinking using clear academic language.',
    'Allow oral explanation, partner assistance, visual cues, calculators, or teacher conferencing so all learners can show understanding.':
        'Allow oral explanation, partner assistance, visual cues, assistive tools, alternative response formats, or teacher conferencing so all learners can show understanding.'
}
path = Path("lib/fallback.ts")
text = path.read_text()
for old, new in replacements.items():
    if old not in text:
        raise SystemExit(f"Expected fallback text not found: {old}")
    text = text.replace(old, new)
path.write_text(text)

print("AI quality preview transformations applied successfully.")
