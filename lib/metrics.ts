// Research metrics for one session, following the lab's framework:
// per phase — visits, messages, time, frequency and diversity of difficulties, skills shown, hints;
// overall — engagement, performance/motivation profile, returns to earlier phases.
import { buildJourney, THRESHOLDS, type AnnotationRow, type MessageRow } from "./insights";

export type PhaseMetrics = {
  phase: string;
  visits: number; // separate entries into the phase
  studentMessages: number;
  minutes: number; // time attributed to the phase (from each student message to the next one)
  difficulties: number; // frequency: messages coded with a difficulty in this phase
  difficultyCodes: string[]; // distinct codes (diversity = length)
  skillCodes: string[]; // distinct skills shown
  hints: { light: number; medium: number; strong: number; step: number };
  completed: boolean; // analyzer marked the guided phase complete
};

export type SessionMetrics = {
  studentMessages: number;
  minutesTotal: number;
  avgWords: number;
  avgResponseSec: number | null;
  shortAnswers: number;
  asksForAnswer: number;
  performance: { high: number; partial: number; low: number };
  lowMotivation: number;
  difficultiesTotal: number;
  difficultyDiversity: number;
  skillDiversity: number;
  backMoves: number;
  furthestPhase: string | null;
  phasesCompleted: number;
  hints: { light: number; medium: number; strong: number; step: number };
  strongestHint: string;
  perPhase: PhaseMetrics[];
};

const round1 = (n: number) => Math.round(n * 10) / 10;

export function sessionMetrics(phaseIds: string[], messages: MessageRow[], annotations: AnnotationRow[]): SessionMetrics {
  const journey = buildJourney(phaseIds, messages, annotations);
  const byMsg = new Map(annotations.map((a) => [a.message_id, a]));
  const student = messages.filter((m) => m.role === "student");
  const tutor = messages.filter((m) => m.role === "tutor");

  const perPhase = new Map<string, PhaseMetrics>(
    phaseIds.map((p) => [
      p,
      {
        phase: p,
        visits: journey.visits[p] ?? 0,
        studentMessages: journey.messages[p] ?? 0,
        minutes: 0,
        difficulties: 0,
        difficultyCodes: [],
        skillCodes: [],
        hints: { light: 0, medium: 0, strong: 0, step: 0 },
        completed: false,
      },
    ]),
  );

  // Time in phase: from each coded student message to the next student message (or the last message).
  const pts = journey.points;
  const lastAt = messages.length ? new Date(messages[messages.length - 1].created_at).getTime() : 0;
  pts.forEach((pt, i) => {
    const start = new Date(pt.at).getTime();
    const end = i + 1 < pts.length ? new Date(pts[i + 1].at).getTime() : lastAt;
    const pm = perPhase.get(pt.phase);
    if (pm) pm.minutes += Math.max(0, end - start) / 60000;
  });

  for (const m of student) {
    const a = byMsg.get(m.id);
    if (!a || m.phase === "extension") continue;
    const pm = perPhase.get(a.phase ?? m.phase ?? "");
    if (!pm) continue;
    if (a.challenge) {
      pm.difficulties += 1;
      if (!pm.difficultyCodes.includes(a.challenge)) pm.difficultyCodes.push(a.challenge);
    }
    for (const s of a.skills ?? []) if (!pm.skillCodes.includes(s)) pm.skillCodes.push(s);
  }
  // "Phase complete" refers to the phase MAX was guiding when the message was sent.
  for (const m of student) {
    if (byMsg.get(m.id)?.phase_complete && m.phase) {
      const pm = perPhase.get(m.phase);
      if (pm) pm.completed = true;
    }
  }
  for (const m of tutor) {
    const pm = perPhase.get(m.phase ?? "");
    if (pm && (m.hint_level === "light" || m.hint_level === "medium" || m.hint_level === "strong" || m.hint_level === "step")) pm.hints[m.hint_level] += 1;
  }

  const words = student.map((m) => m.word_count ?? 0);
  const resp = student.map((m) => m.response_ms).filter((x): x is number => typeof x === "number");
  const perf = { high: 0, partial: 0, low: 0 };
  for (const a of annotations) if (a.performance) perf[a.performance] += 1;
  const allDiff = new Set(annotations.map((a) => a.challenge).filter(Boolean));
  const allSkills = new Set(annotations.flatMap((a) => a.skills ?? []));
  const hints = { light: 0, medium: 0, strong: 0, step: 0 };
  for (const pm of perPhase.values()) {
    hints.light += pm.hints.light;
    hints.medium += pm.hints.medium;
    hints.strong += pm.hints.strong;
    hints.step += pm.hints.step;
  }
  const first = messages[0] ? new Date(messages[0].created_at).getTime() : 0;

  const list = [...perPhase.values()].map((pm) => ({ ...pm, minutes: round1(pm.minutes) }));
  return {
    studentMessages: student.length,
    minutesTotal: round1((lastAt - first) / 60000),
    avgWords: student.length ? round1(words.reduce((s, x) => s + x, 0) / student.length) : 0,
    avgResponseSec: resp.length ? Math.round(resp.reduce((s, x) => s + x, 0) / resp.length / 1000) : null,
    shortAnswers: student.filter((m) => (m.word_count ?? 0) < THRESHOLDS.shortAnswerWords).length,
    asksForAnswer: annotations.filter((a) => a.asks_for_answer).length,
    performance: perf,
    lowMotivation: annotations.filter((a) => a.motivation === "low").length,
    difficultiesTotal: annotations.filter((a) => a.challenge).length,
    difficultyDiversity: allDiff.size,
    skillDiversity: allSkills.size,
    backMoves: journey.backMoves.length,
    furthestPhase: journey.furthestIndex >= 0 ? phaseIds[journey.furthestIndex] : null,
    phasesCompleted: list.filter((p) => p.completed).length,
    hints,
    strongestHint: hints.step ? "step" : hints.strong ? "strong" : hints.medium ? "medium" : hints.light ? "light" : "none",
    perPhase: list,
  };
}
