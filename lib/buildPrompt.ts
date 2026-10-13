// Assembles MAX's system prompt: base rules (prompts/max_base.md) + task context + current state.
import { loadPrompt } from "./prompts";
import { getPhase, t, type Gender, type Lang, type Task } from "./tasks";
import type { Plan } from "./policy";

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
}): string {
  const { base, task, lang, gender, phaseId, phaseAttempts, plan } = opts;
  const phase = getPhase(task, phaseId);
  const phaseList = task.phases
    .map((p, i) => `${i + 1}. ${p.id} — ${t(p.label, "en")}${p.id === phase.id ? "   ← CURRENT" : ""}`)
    .join("\n");

  const hintBlock =
    plan && plan.hintLevel !== "none"
      ? `Use this hint (rephrase it in the student's language, do not add numbers it doesn't contain):\n"${phase.hints[plan.hintLevel]}"`
      : `Prepared hints for this step, weakest first (use only if needed, lowest level that works):\n- light: ${phase.hints.light}\n- medium: ${phase.hints.medium}\n- strong: ${phase.hints.strong}`;

  const planBlock = plan
    ? `# Response plan for this turn\n${plan.instruction}`
    : `# Response plan for this turn\nNo analysis yet. Judge the student's performance and motivation yourself and follow the adaptation table.`;

  return `${base}

# Task: ${t(task.title, "en")}
${t(task.statement, "en")}

Given values: ${JSON.stringify(task.givens)}

# Modelling steps for this task
${phaseList}

# Current step: ${t(phase.label, "en")} (${phase.id})
Goal: ${phase.goal}
Evidence that the step is done:
${phase.evidence.map((e) => `- ${e}`).join("\n")}
Common mistakes to watch for:
${phase.misconceptions.map((m) => `- ${m}`).join("\n")}
The student has sent ${phaseAttempts} message(s) in this step.
When the step is done, you may use this compliment: "${phase.compliment}"

${hintBlock}

${planBlock}

# Reference (SECRET — for your own checking only, never reveal)
Solution path: ${task.reference.path}
Reference values: ${JSON.stringify(task.reference)}

# Language and form of address
Write your reply in ${LANG_NAME[lang]}.
The student chose to be addressed as ${gender === "female" ? "a girl (בת / بنت)" : "a boy (בן / ولد)"}. ${
    lang === "en"
      ? "English has no grammatical gender; just be consistent."
      : `Always use ${gender === "female" ? "FEMININE" : "MASCULINE"} grammatical forms when addressing the student (verbs, adjectives, pronouns), every message.`
  }`;
}
