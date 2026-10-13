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
    high: { move: "guiding_question", hint: "light", text: "Ask one guiding question. Use at most the LIGHT hint." },
    low: { move: "encourage_plus_hint", hint: "medium", text: "Encourage first, then give the MEDIUM hint." },
  },
  low: {
    high: { move: "structured_hint", hint: "strong", text: "Give the STRONG (structured) hint." },
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
        "The student asked for the answer. Kindly say you won't give it, then make the next step smaller using the MEDIUM hint.",
    };
  }

  const row = TABLE[input.performance][input.motivation];
  let hint = row.hint;

  // Stuck for a while in the same phase → one level stronger (never above strong).
  if ((input.phaseAttempts ?? 0) >= 4 && hint !== "none") {
    hint = LEVELS[Math.min(LEVELS.indexOf(hint) + 1, LEVELS.length - 1)];
  }

  const scaffoldType: ScaffoldType = input.phaseComplete
    ? "transition"
    : input.motivation === "low"
      ? "motivation"
      : "in_step";

  const transition = input.phaseComplete
    ? " The student completed this step: sum up in one sentence what they achieved, then open the next step with one question."
    : "";

  return { move: row.move, hintLevel: hint, scaffoldType, instruction: row.text + transition };
}
