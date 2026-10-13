// Turns stored messages + annotations into what teachers and researchers see:
// the student's journey through the phases, per-phase stats, and alerts.

export type MessageRow = {
  id: number;
  role: "student" | "tutor";
  content: string;
  phase: string | null;
  word_count: number | null;
  response_ms: number | null;
  hint_level: string | null;
  scaffold_type: string | null;
  move: string | null;
  created_at: string;
};

export type AnnotationRow = {
  message_id: number;
  phase: string | null;
  performance: "high" | "partial" | "low" | null;
  motivation: "high" | "low" | null;
  challenge: string | null;
  evidence: string | null;
  asks_for_answer: boolean;
  phase_complete: boolean;
  created_at: string;
};

// Thresholds the researchers may want to tune.
export const THRESHOLDS = {
  silenceMinutes: 4, // no student message for this long while active → "disengaged"
  shortAnswerWords: 5, // fewer words than this counts as a short answer
  shortAnswerStreak: 3, // this many short answers in a row → alert
  askAnswerCount: 2, // asked for the answer this many times → alert
  lowMotivationStreak: 2, // this many "low motivation" codings in a row → alert
};

export type JourneyPoint = {
  index: number; // 1-based student message number
  messageId: number;
  phase: string;
  phaseIndex: number;
  performance: string | null;
  at: string;
  back: boolean; // moved to an earlier phase than the previous point
};

export type Journey = {
  points: JourneyPoint[];
  visits: Record<string, number>; // how many separate times each phase was entered
  messages: Record<string, number>; // student messages per phase
  backMoves: { from: string; to: string; index: number }[];
  furthestIndex: number; // furthest phase index reached (-1 if none)
};

// The journey uses the analyzer's phase per student message (where the student was really thinking),
// falling back to the phase the session was in when the message was sent.
export function buildJourney(
  phaseIds: string[],
  messages: MessageRow[],
  annotations: AnnotationRow[],
): Journey {
  const byMsg = new Map(annotations.map((a) => [a.message_id, a]));
  const points: JourneyPoint[] = [];
  const visits: Record<string, number> = {};
  const counts: Record<string, number> = {};
  const backMoves: Journey["backMoves"] = [];
  let furthest = -1;

  for (const m of messages) {
    if (m.role !== "student") continue;
    const a = byMsg.get(m.id);
    const phase = a?.phase ?? m.phase;
    if (!phase) continue;
    const phaseIndex = phaseIds.indexOf(phase);
    if (phaseIndex < 0) continue;

    const prev = points[points.length - 1];
    const back = !!prev && phaseIndex < prev.phaseIndex;
    if (!prev || prev.phase !== phase) visits[phase] = (visits[phase] ?? 0) + 1;
    if (back && prev) backMoves.push({ from: prev.phase, to: phase, index: points.length + 1 });
    counts[phase] = (counts[phase] ?? 0) + 1;
    furthest = Math.max(furthest, phaseIndex);

    points.push({
      index: points.length + 1,
      messageId: m.id,
      phase,
      phaseIndex,
      performance: a?.performance ?? null,
      at: m.created_at,
      back,
    });
  }

  return { points, visits, messages: counts, backMoves, furthestIndex: furthest };
}

export type Alert = { kind: "silence" | "short" | "asks" | "motivation" | "progress"; text: string; severity: "warn" | "info" };

export function sessionAlerts(
  status: string,
  messages: MessageRow[],
  annotations: AnnotationRow[],
  lastPhaseId: string,
  now = Date.now(),
): Alert[] {
  const alerts: Alert[] = [];
  const student = messages.filter((m) => m.role === "student");
  const last = messages[messages.length - 1];

  if (status === "active" && last) {
    const minutes = (now - new Date(last.created_at).getTime()) / 60000;
    if (last.role === "tutor" && minutes >= THRESHOLDS.silenceMinutes) {
      alerts.push({ kind: "silence", severity: "warn", text: `לא כתב/ה ${Math.floor(minutes)} דקות` });
    }
  }

  const tail = student.slice(-THRESHOLDS.shortAnswerStreak);
  if (
    tail.length === THRESHOLDS.shortAnswerStreak &&
    tail.every((m) => (m.word_count ?? 0) < THRESHOLDS.shortAnswerWords)
  ) {
    alerts.push({
      kind: "short",
      severity: "warn",
      text: `${THRESHOLDS.shortAnswerStreak} התשובות האחרונות קצרות מ-${THRESHOLDS.shortAnswerWords} מילים`,
    });
  }

  const asks = annotations.filter((a) => a.asks_for_answer).length;
  if (asks >= THRESHOLDS.askAnswerCount) {
    alerts.push({ kind: "asks", severity: "warn", text: `ביקש/ה את התשובה ${asks} פעמים` });
  }

  const lastCodes = annotations.slice(-THRESHOLDS.lowMotivationStreak);
  if (lastCodes.length === THRESHOLDS.lowMotivationStreak && lastCodes.every((a) => a.motivation === "low")) {
    alerts.push({ kind: "motivation", severity: "warn", text: "מוטיבציה נמוכה בהודעות האחרונות" });
  }

  if (annotations.some((a) => a.phase === lastPhaseId)) {
    alerts.push({ kind: "progress", severity: "info", text: "הגיע/ה לשלב האימות" });
  }

  return alerts;
}

// Strongest hint MAX gave in each phase (none < light < medium < strong).
export function strongestHints(messages: MessageRow[]): Record<string, string> {
  const order = ["none", "light", "medium", "strong"];
  const out: Record<string, string> = {};
  for (const m of messages) {
    if (m.role !== "tutor" || !m.phase || !m.hint_level) continue;
    const cur = out[m.phase];
    if (!cur || order.indexOf(m.hint_level) > order.indexOf(cur)) out[m.phase] = m.hint_level;
  }
  return out;
}
