// Task types and helpers. Built-in tasks live in tasks/<id>.json (imported, so they are bundled
// on Vercel); tasks written in the studio live in the database — see lib/taskStore.ts.
import speedometer from "../tasks/speedometer.json";

export type Lang = "he" | "ar" | "en";
export type Localized = Partial<Record<Lang, string>> & { he: string };
export type HintLevel = "none" | "light" | "medium" | "strong" | "step"; // H0–H4, see lib/hints.ts
export type Gender = "male" | "female";
export type Gendered = { male: string; female: string };

export type Phase = {
  id: string;
  label: Localized;
  goal: string;
  evidence: string[];
  misconceptions: string[];
  hints: { light: string; medium: string; strong: string };
  compliment: string;
};

export type TaskCardText = { title: string; definition: string; image_alt: string; points: string[]; question: string };

export type Task = {
  id: string;
  title: Localized;
  statement: Localized;
  image?: string;
  card?: { image?: string } & Partial<Record<Lang, TaskCardText>>;
  givens: Record<string, number>;
  context_for_tutor?: string[]; // background MAX may rely on (never pasted to the student as-is)
  reference: { path: string; [k: string]: unknown };
  opening: Partial<Record<Lang, Gendered>> & { he: Gendered };
  phases: Phase[];
};

const BUILT_IN: Record<string, Task> = {
  speedometer: speedometer as unknown as Task,
};

export function builtInTasks(): Record<string, Task> {
  return BUILT_IN;
}

export function getPhase(task: Task, phaseId: string): Phase {
  return task.phases.find((p) => p.id === phaseId) ?? task.phases[0];
}

export function nextPhaseId(task: Task, phaseId: string): string | null {
  const i = task.phases.findIndex((p) => p.id === phaseId);
  return i >= 0 && i < task.phases.length - 1 ? task.phases[i + 1].id : null;
}

export function t(text: Localized, lang: Lang): string {
  return text[lang] ?? text.he;
}

export function openingFor(task: Task, lang: Lang, gender: Gender): string {
  return (task.opening[lang] ?? task.opening.he)[gender];
}

// What the student's screen needs — never includes the reference answer or hints.
export function publicTask(task: Task, lang: Lang) {
  return {
    id: task.id,
    title: t(task.title, lang),
    statement: t(task.statement, lang),
    image: task.image ?? null,
    card: task.card ? { image: task.card.image ?? null, ...(task.card[lang] ?? task.card.he ?? null) } : null,
    phases: task.phases.map((p) => ({ id: p.id, label: t(p.label, lang) })),
  };
}
