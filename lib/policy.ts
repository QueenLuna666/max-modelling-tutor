// How MAX chooses its response and hint level — the research team's hint guidelines
// (HINT_GUIDELINES_REPORT, 14.10.2026). Re-decided after every student message:
//   1. what the student is asking for (information, a check, the full solution, to stop, finish/continue)
//   2. the performance level in the aspect being discussed (strong / intermediate / significant difficulty)
//   3. the hint already given and how the student responded to it
// Hint scale H0–H4 (see lib/hints.ts). No fixed number of errors forces escalation; silence and
// response time are not reasons to change level; motivation is not inferred from writing style.
import type { HintLevel } from "./tasks";

export type Performance = "high" | "partial" | "low";
export type Motivation = "high" | "low";
export type Level = "strong" | "intermediate" | "significant_difficulty" | "insufficient_evidence";

export type Move =
  | "acknowledge_continue" // H0
  | "guiding_question" // H1
  | "focused_hint" // H2
  | "partial_structure" // H3
  | "small_step" // H4
  | "clarify"
  | "give_info"
  | "check_work"
  | "refuse_full_solution"
  | "acknowledge_frustration"
  | "suggest_teacher"
  | "offer_finish"
  | "close"
  | "extension";
export type ScaffoldType = "in_step" | "transition" | "motivation" | "info" | "closing";

export type Plan = {
  move: Move;
  hintLevel: HintLevel;
  scaffoldType: ScaffoldType;
  instruction: string; // plain-English line injected into MAX's system prompt
};

// What the analyzer reads in the message besides phase and level.
export type Signals = {
  request_type: "none" | "info" | "check" | "full_solution" | "stop";
  response_to_last_hint: "progressed" | "partial" | "same_difficulty" | "no_previous_hint";
  frustration_stated: boolean;
  basic_meaning_missing: boolean;
  ready_to_finish: boolean;
  choice_after_offer: "none" | "finish" | "continue" | "unclear";
};

export const HINTS: HintLevel[] = ["none", "light", "medium", "strong", "step"];
const rank = (h: HintLevel) => HINTS.indexOf(h);

// Starting point by the observed level in the aspect being discussed (a default, not a rigid map).
const START: Record<Level, { hint: HintLevel; note: string }> = {
  strong: { hint: "none", note: "H0, or H1 if a local check is needed; no obligation to add a hint or a challenge when the student is progressing well" },
  intermediate: { hint: "light", note: "H1 or H2 according to the explicit gap; keep the work already done, do not rebuild the whole solution" },
  significant_difficulty: { hint: "medium", note: "H2 or H3 in a small step; H4 if there is evidence the basis is missing; no need to restart with a general question that already did not help" },
  insufficient_evidence: { hint: "light", note: "H1 that clarifies the local action or difficulty; do not infer weakness or escalate straight to a strong hint" },
};

const HINT_MOVE: Record<HintLevel, { move: Move; text: string }> = {
  none: { move: "acknowledge_continue", text: "H0 — no content hint: acknowledge precisely what the student did and invite them to continue (an open question only if needed)." },
  light: { move: "guiding_question", text: "H1 — a light hint: point the thinking without solution content — a question about meaning, goal, unit or a self-check." },
  medium: { move: "focused_hint", text: "H2 — a focused hint: narrow the search — point to two quantities, one line, or one distinction; the student chooses the operation and explains." },
  strong: { move: "partial_structure", text: "H3 — partial structure: reveal ONE local relation or a frame with a missing part for the student to complete, apply or justify. Write any relation on its own line." },
  step: { move: "small_step", text: "H4 — small-step guidance: explain one basic concept, or show a tiny solved example with DIFFERENT numbers, or offer a limited choice; then ask for one small action in the student's own task. Never more of the solution." },
};

export function policyTable() {
  return {
    description:
      "Research team's hint guidelines: the response is re-decided after every student message from (1) what the student asks for, (2) the performance level in the aspect discussed, (3) the hint already given and the student's response to it. Hint scale H0–H4.",
    hint_scale: {
      H0: "independent work — precise acknowledgement or an invitation to continue; no content hint",
      H1: "light hint — points the thinking without solution content (meaning, goal, unit, self-check)",
      H2: "focused hint — narrows the search area (two quantities, one line, one distinction)",
      H3: "partial structure — reveals a local relation or a frame with a missing part",
      H4: "small-step guidance — basic concept, a solved example with other numbers, or a limited choice",
    },
    start_by_level: Object.fromEntries(Object.entries(START).map(([k, v]) => [k, v.note])),
    after_student_response: [
      "explanation or performance that allows continuing → reduce the content hint and return responsibility to the student",
      "partial progress → keep the focus and change the part not understood; no need to escalate if the hint already led to meaningful work",
      "the same difficulty after an accessible hint → add focus or structure (next level); first check whether the difficulty is content, wording, a term or the display",
      "no understanding even after partial structure → illustration or a tiny step (H4) instead of repeating the formula or a long explanation",
      "a correct completion after a supplied answer → do not declare independent understanding; continue with a small action that uses the meaning",
      "difficulty persists at H4 → no loop of more hints and no full solution as a reward for failure: suggest the teacher's help or a shared illustration, and name the component they are stuck on",
    ],
    requests: {
      info: "an explicit request for a known formula or established world data (or real difficulty finding it) → give it directly, each formula on its own line with symbols and units explained, conditions of use stated; choosing, applying and evaluating the model stays with the student; not an escalation",
      check: "checking a calculation the student already did → confirm a correct step or point exactly to the wrong place",
      full_solution: "asking MAX to do the work instead → acknowledge, say briefly MAX will help build it but not write it, offer one local contribution; a repeated request does not raise the hint level; no judgement",
      stop: "an explicit request to stop → respect it: short acknowledgement, no new questions",
      frustration: "an explicit statement like 'I tried and I'm frustrated' → short acknowledgement, a reduced step or the option to pause",
    },
    ending: "after a final answer to the task's goal and a real-world validation, offer once: finish here or continue with one more challenge. Finish → short closing, no new question. Continue → one challenge. Unclear → ask briefly.",
    class_setting: "the teacher's maxHint caps everything",
  };
}

export function planResponse(input: {
  level: Level; // in the aspect being discussed now (falls back to the student's pattern)
  signals: Signals;
  asksForAnswer: boolean;
  previousHint: HintLevel | null; // the hint MAX gave last turn on the same focus, or null
  previousMove: string | null; // MAX's last move (to know if finishing was already offered)
  noPhase: boolean; // the analyzer found no modelling activity in the message
  maxHint?: HintLevel; // the class's ceiling (teacher setting)
}): Plan {
  const { level, signals, previousHint, previousMove } = input;
  const cap = input.maxHint ?? "step";
  const capped = (h: HintLevel) => (rank(h) > rank(cap) ? cap : h);

  // 1. Finishing.
  if (previousMove === "offer_finish" && signals.choice_after_offer === "finish") {
    return { move: "close", hintLevel: "none", scaffoldType: "closing", instruction: 'The student chose to finish. Close in one or two short warm sentences, e.g. "We are done for today. Thanks for the work!" No new question, no hint, no challenge.' };
  }
  if (signals.request_type === "stop") {
    return { move: "close", hintLevel: "none", scaffoldType: "closing", instruction: "The student explicitly asked to stop. Respect it: one short acknowledgement and an invitation to come back later. No new questions and no pressure. Do not call the task completed." };
  }
  if (previousMove === "offer_finish" && signals.choice_after_offer === "continue") {
    return { move: "extension", hintLevel: "none", scaffoldType: "transition", instruction: "The student chose to continue. Offer ONE challenge or question related to the topic and to what they did (e.g. change an assumption, or check another situation). It is optional and not a condition for completing the task." };
  }
  if (previousMove === "offer_finish" && signals.choice_after_offer === "unclear") {
    return { move: "offer_finish", hintLevel: "none", scaffoldType: "closing", instruction: "It is not clear whether the student wants to finish or continue. Ask briefly which they prefer. Do not treat silence or an unclear answer as agreeing to a challenge." };
  }

  // 2. Requests that are not a request for a modelling hint.
  if (signals.request_type === "info") {
    return { move: "give_info", hintLevel: "none", scaffoldType: "info", instruction: "The student explicitly asked for a known formula or established reference data (or showed real difficulty finding it). Give it directly and accurately: each formula on its own line, then what each symbol means and the units; for real-world data give a well-founded range with its context (type of vehicle, what exactly is measured) and say it is reference data, not a measurement of this car. Do not offer extra information, and do not connect it into the solution: which quantity to use, how, and whether it fits stays with the student. A direct information answer does not have to end with a question." };
  }
  if (signals.request_type === "check") {
    return { move: "check_work", hintLevel: "none", scaffoldType: "in_step", instruction: "The student asks you to check a calculation they already did. Confirm a correct step precisely, or point exactly to the place that is wrong (without doing the rest). No need to hold back the confirmation to create more questions." };
  }

  // 3. The hint level for modelling support.
  const start = level === "significant_difficulty" && signals.basic_meaning_missing ? "step" : START[level].hint;
  let hint: HintLevel = start;
  let teacher = false;
  if (previousHint) {
    const r = signals.response_to_last_hint;
    if (r === "progressed") hint = HINTS[Math.max(0, Math.min(rank(previousHint) - 1, rank(start)))];
    else if (r === "partial") hint = previousHint;
    else if (r === "same_difficulty") {
      if (previousHint === "step") teacher = true;
      hint = HINTS[Math.min(rank(previousHint) + 1, HINTS.length - 1)];
    }
  }
  hint = capped(hint);

  if (input.asksForAnswer || signals.request_type === "full_solution") {
    return { move: "refuse_full_solution", hintLevel: hint, scaffoldType: "motivation", instruction: `The student asked you to do the work instead of them. Acknowledge the request, say briefly that you will help build the answer but not write it for them, and offer ONE local contribution they can make now (at the level: ${HINT_MOVE[hint].text}). No speech about effort, no blame, no assumption of low ability. If the solution is already visible in the task materials, do not hide it — focus on their explanation of it. A repeated request does not raise the hint level.` };
  }
  if (teacher) {
    return { move: "suggest_teacher", hintLevel: "step", scaffoldType: "motivation", instruction: "The same difficulty persists even after small-step guidance (H4). Do not loop with more hints and never give the full solution. Name exactly which component they are stuck on, and suggest asking the teacher for help or working through an illustration together." };
  }
  if (signals.frustration_stated) {
    return { move: "acknowledge_frustration", hintLevel: hint, scaffoldType: "motivation", instruction: `The student said explicitly that they are frustrated or tired. Acknowledge it in one short sentence based on what they really tried, then offer a reduced step (${HINT_MOVE[hint].text}) or the option to pause and come back. No automatic compliments.` };
  }
  if (signals.ready_to_finish && previousMove !== "offer_finish") {
    return { move: "offer_finish", hintLevel: "none", scaffoldType: "closing", instruction: 'The student has answered the task\'s goal and checked the result against reality, with no open contradiction. Say in one or two sentences, in the student\'s language and grammatical gender: "We\'re done! Well done" + exactly what they completed (do not repeat the whole solution), then ask ONE question: would they like a challenge? In Hebrew, e.g. "סיימנו! כל הכבוד — [מה הושלם]. רוצה שנאתגר אותך?" (feminine: "רוצה שנאתגר אותך?" works for both). The student will see two buttons: finish, or challenge me.' };
  }
  if (input.noPhase && !previousHint) {
    return { move: "clarify", hintLevel: "light", scaffoldType: "in_step", instruction: 'It is not clear what the student is working on or where they stopped. Do not guess or explain at length: refer to what they wrote and ask about ONE focus, offering two concrete options, e.g. "Where did you stop: what the sensor counts, or how to use the count?" — and allow another answer. A clarification question is not feedback on ability.' };
  }
  const m = HINT_MOVE[hint];
  return { move: m.move, hintLevel: hint, scaffoldType: "in_step", instruction: `${m.text} Focus on ONE gap (the student's request or what blocks them now); do not re-explain parts already understood.` };
}
