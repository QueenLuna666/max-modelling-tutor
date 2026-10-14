// Assembles MAX's system prompt: base rules (prompts/max_base.md) + task context + current state.
import { loadPrompt } from "./prompts";
import { getPhase, t, type Gender, type Lang, type Task } from "./tasks";
import type { Plan } from "./policy";
import type { Analysis } from "./analyzer";
import { DIFFICULTIES, PHASES, SKILLS } from "./framework";

export function loadBasePrompt(): Promise<string> {
  return loadPrompt("max_base");
}

const LANG_NAME: Record<Lang, string> = { he: "Hebrew", ar: "Arabic", en: "English" };

export function buildSystemPrompt(opts: {
  base: string;
  task: Task;
  lang: Lang;
  gender: Gender;
  phaseId: string;
  phaseAttempts: number;
  plan: Plan | null;
  analysis?: Analysis | null;
}): string {
  const { base, task, lang, gender, phaseId, phaseAttempts, plan, analysis } = opts;
  const phase = getPhase(task, phaseId);
  const phaseList = task.phases
    .map((p, i) => `${i + 1}. ${p.id} — ${t(p.label, "en")}${p.id === phase.id ? "   ← CURRENT" : ""}`)
    .join("\n");

  // The task's prepared hints are written per phase at three strengths; they serve as material for
  // H1 (light), H2 (medium) and H3 (strong). H4 is composed by MAX (another small example or a limited choice).
  const hintBlock = (() => {
    const material = `Prepared hint material for this step (adapt it to the student's actual gap; do not paste it):\n- H1: ${phase.hints.light}\n- H2: ${phase.hints.medium}\n- H3: ${phase.hints.strong}`;
    if (!plan || ["none", "light", "medium", "strong", "step"].indexOf(plan.hintLevel) < 1) return material;
    if (plan.hintLevel === "step") return `${material}\nThis turn is H4: build a tiny solved example with DIFFERENT numbers, or a limited choice, or explain one basic concept — then ask for one small action in the student's own task.`;
    const code = { light: "H1", medium: "H2", strong: "H3" }[plan.hintLevel as "light" | "medium" | "strong"];
    return `${material}\nThis turn is ${code}: base your hint on the ${code} material, aimed at the specific gap, in the student's language; do not add numbers it doesn't contain.`;
  })();

  const planBlock = plan
    ? `# Response plan for this turn (research team's hint guidelines)\n${plan.instruction}`
    : `# Response plan for this turn\nNo analysis is available. Judge from the conversation: what the student asks for, what they already did, and the smallest support that lets them take the next step (start at H1).`;

  return `${base}

# Task: ${t(task.title, "en")}
${t(task.statement, "en")}

Given values: ${JSON.stringify(task.givens)}
${task.context_for_tutor?.length ? `\n# Background for you (use it to guide, never paste it to the student)\n${task.context_for_tutor.map((c) => `- ${c}`).join("\n")}\n` : ""}
# Modelling steps for this task
${phaseList}

# Current step: ${t(phase.label, "en")} (${phase.id})
${frameworkBlock(phase.id)}
In this task, the goal of this step: ${phase.goal}
Evidence that the step is done:
${phase.evidence.map((e) => `- ${e}`).join("\n")}
Common mistakes to watch for:
${phase.misconceptions.map((m) => `- ${m}`).join("\n")}
The student has sent ${phaseAttempts} message(s) in this step.
When the step is done, you may use this compliment: "${phase.compliment}"

${hintBlock}

${planBlock}

${analysis ? analysisBlock(analysis) : ""}
# Reference (SECRET — for your own checking only, never reveal)
${Object.entries(task.reference)
    .filter(([k]) => !k.startsWith("_"))
    .map(([k, v]) => `- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("\n")}

# Language and form of address
Write your reply in ${LANG_NAME[lang]}.
The student chose to be addressed as ${gender === "female" ? "a girl (בת / بنت)" : "a boy (בן / ولد)"}. ${
    lang === "en"
      ? "English has no grammatical gender; just be consistent."
      : `Always use ${gender === "female" ? "FEMININE" : "MASCULINE"} grammatical forms when addressing the student (verbs, adjectives, pronouns), every message.`
  }`;
}

// The research team's general definition of the current phase: what it is, the desired outcome,
// the skills to look for and the difficulties to expect (with how to tell them apart).
function frameworkBlock(phaseId: string): string {
  const f = PHASES.find((p) => p.id === phaseId);
  if (!f) return "";
  const skills = SKILLS.filter((s) => s.phase === phaseId);
  const diffs = DIFFICULTIES.filter((d) => d.phase === phaseId);
  return `What this step is (research team's definition): ${f.desc}
Desired outcome of this step: ${f.product}
Skills to draw out with your questions: ${skills.map((s) => s.en).join("; ")}.
Difficulties to watch for, and respond to the specific one you see: ${diffs.map((d) => d.en).join("; ")}.`;
}

const LEVEL_EN: Record<string, string> = {
  strong: "strong",
  intermediate: "intermediate (understands parts, a focused gap)",
  significant_difficulty: "significant difficulty (basic meaning/relations not yet in place)",
  insufficient_evidence: "not enough evidence yet",
};

// What the analyzer saw in the student's latest message, coded by the research team's rules.
function analysisBlock(a: Analysis): string {
  const seen = a.phases.length
    ? a.phases
        .map((p) => {
          const name = PHASES.find((f) => f.id === p.phase)?.en ?? p.phase;
          return `- ${name}: ${LEVEL_EN[p.level]}${p.aspect ? ` — ${p.aspect}` : ""}${p.after_support ? " (mostly repeats what you or the task already gave)" : ""}`;
        })
        .join("\n")
    : "- no modelling phase identified in this message (e.g. \"I didn't understand\", a short reply, a general request)";
  return `# The analyzer's reading of the student's latest message (research team's rules — never mention it)
Phases the student is actually working in now (the process is NOT linear — respond to where the student really is, even if it differs from the current step above):
${seen}
Overall pattern so far: ${LEVEL_EN[a.student_pattern]}.${a.asks_for_answer ? "\nThe student explicitly asked you to replace their work with a ready answer: refuse kindly and invite them back in with one small step — whatever their level." : ""}
Use the level in the aspect being discussed now, not a general label of the student; the Response plan below already applies the research team's hint guidelines. Never tell the student their level or pattern.
`;
}
