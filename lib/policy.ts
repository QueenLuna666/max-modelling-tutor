// The MAX decision table (performance × motivation) as code.
// Today: used only when an annotation exists. Tomorrow the analyzer fills annotations,
// and this table decides the hint level MAX gets told to use.
import type { HintLevel } from "./tasks";

export type Performance = "high" | "partial" | "low";
export type Motivation = "high" | "low";
export type Move =
  | "challenge"
  | "praise_confirm"
  | "guiding_question"
  | "encourage_plus_hint"
  | "structured_hint"
  | "shrink_task"
  | "refuse_answer_shrink";
export type ScaffoldType = "in_step" | "transition" | "motivation";

export type Plan = {
  move: Move;
  hintLevel: HintLevel;
  scaffoldType: ScaffoldType;
  instruction: string; // plain-English line injected into MAX's system prompt
};

const TABLE: Record<Performance, Record<Motivation, { move: Move; hint: HintLevel; text: string }>> = {
  high: {
    high: { move: "challenge", hint: "none", text: "Give a short challenge or extension, then move toward the next step." },
    low: { move: "praise_confirm", hint: "none", text: "Praise the thinking and confirm briefly. Keep it short." },
  },
  partial: {
    high: { move: "guiding_question", hint: "light", text: "Ask one guiding question." },
    low: { move: "encourage_plus_hint", hint: "medium", text: "Encourage first, then give a small hint." },
  },
  low: {
    high: { move: "structured_hint", hint: "strong", text: "Give a structured hint." },
    low: {
      move: "shrink_task",
      hint: "strong",
      text: "Make the task smaller: give only the first small step, and compliment the effort.",
    },
  },
};

const LEVELS: HintLevel[] = ["none", "light", "medium", "strong"];

export function planResponse(input: {
  performance: Performance;
  motivation: Motivation;
  asksForAnswer?: boolean;
  phaseComplete?: boolean;
  phaseAttempts?: number; // student messages already spent in this phase
}): Plan {
  if (input.asksForAnswer) {
    return {
      move: "refuse_answer_shrink",
      hintLevel: "medium",
      scaffoldType: "motivation",
      instruction:
        "The student asked for the answer. Kindly say you won't give it, then make the next step smaller with one small hint.",
    };
  }

  const row = TABLE[input.performance][input.motivation];
  let hint = row.hint;
  const attempts = input.phaseAttempts ?? 1;

  // Hints escalate gradually inside a step: light on the first try, medium on the second,
  // strong only from the third. Stuck for long (5+) → one level stronger than the table says.
  if (hint !== "none") {
    const cap: HintLevel = attempts <= 1 ? "light" : attempts === 2 ? "medium" : "strong";
    if (LEVELS.indexOf(hint) > LEVELS.indexOf(cap)) hint = cap;
    if (attempts >= 5) hint = LEVELS[Math.min(LEVELS.indexOf(hint) + 1, LEVELS.length - 1)];
  }
  const hintLine = hint === "none" ? " Do not give a hint." : ` Use at most the ${hint.toUpperCase()} hint for this step.`;

  const scaffoldType: ScaffoldType = input.phaseComplete
    ? "transition"
    : input.motivation === "low"
      ? "motivation"
      : "in_step";

  const transition = input.phaseComplete
    ? " The student completed this step: sum up in one sentence what they achieved, then open the next step with one question."
    : "";

  return { move: row.move, hintLevel: hint, scaffoldType, instruction: row.text + hintLine + transition };
}
