// The research assistant's data: two tidy CSV tables built from the stored conversations and the
// lab's coding (students hidden from results are left out), plus a description of every column.
import "server-only";
import { PHASES } from "./framework";
import { HINT_CODE } from "./hints";
import type { ExportSession } from "./staffData";

function csv(rows: Record<string, unknown>[], cols: string[]): string {
  const esc = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

const SESSION_COLS = [
  "session_id", "student", "class", "task_id", "lang", "gender", "status", "started_at", "minutes",
  "student_messages", "avg_words", "back_moves", "furthest_phase", "furthest_phase_order", "phases_completed",
  "asks_for_answer", "difficulties_total", "difficulty_diversity", "skill_diversity",
  "hints_H1", "hints_H2", "hints_H3", "hints_H4", "last_pattern",
];
const MESSAGE_COLS = [
  "session_id", "student", "class", "lang", "gender", "message_no", "at", "phase", "phase_order", "phases_in_message",
  "level", "student_pattern", "motivation", "challenge", "skills", "asks_for_answer", "phase_complete",
  "request_type", "response_to_last_hint", "word_count", "response_seconds", "next_max_hint", "next_max_move", "text",
];

export const DATA_DESCRIPTION = `Two CSV files (UTF-8, comma-separated, header row). One row per conversation in sessions.csv; one row per STUDENT message in messages.csv. Join on session_id.

sessions.csv:
- session_id, student (name), class (class code), task_id, lang (he|ar|en), gender (male|female), status (active|done), started_at (ISO time)
- minutes: conversation length; student_messages; avg_words (per student message)
- back_moves: times the student moved back to an earlier modelling phase
- furthest_phase (id) and furthest_phase_order (1–6); phases_completed (0–6)
- asks_for_answer: messages asking MAX to replace their work
- difficulties_total (messages with a difficulty code), difficulty_diversity (distinct codes), skill_diversity (distinct skill codes)
- hints_H1..hints_H4: how many hints of each level MAX gave (H1 light … H4 small-step guidance)
- last_pattern: the student's overall pattern at the end (strong|intermediate|significant_difficulty|insufficient_evidence)

messages.csv:
- session_id, student, class, lang, gender, message_no (1, 2, … within the conversation), at (ISO time)
- phase: main modelling phase of the message (understanding, simplifying, mathematising, math_work, interpreting, validating; empty = none identified); phase_order 1–6
- phases_in_message: all phases identified in the message, separated by ";"
- level: performance level in that phase (strong|intermediate|significant_difficulty|insufficient_evidence)
- student_pattern: the overall pattern so far; motivation (high|low)
- challenge: difficulty code (D-U1 … D-V5) or empty; skills: skill codes separated by ";"
- asks_for_answer, phase_complete: true|false
- request_type (none|info|check|full_solution|stop), response_to_last_hint (progressed|partial|same_difficulty|no_previous_hint)
- word_count, response_seconds
- next_max_hint (H0–H4) and next_max_move: what MAX did right after this message
- text: the student's message (Hebrew or Arabic)

Phase order: ${PHASES.map((p, i) => `${i + 1}=${p.id}`).join(", ")}.`;

export function buildResearchCsv(sessions: ExportSession[]) {
  const order = (id: string | null | undefined) => (id ? PHASES.findIndex((p) => p.id === id) + 1 || "" : "");
  const sessionRows = sessions.map((s) => {
    const m = s.metrics;
    const last = [...s.messages].reverse().find((x) => x.analysis?.student_pattern)?.analysis?.student_pattern ?? "";
    return {
      session_id: s.sessionId,
      student: s.name,
      class: s.classCode,
      task_id: s.taskId,
      lang: s.lang,
      gender: s.gender,
      status: s.status,
      started_at: s.startedAt,
      minutes: m.minutesTotal,
      student_messages: m.studentMessages,
      avg_words: m.avgWords,
      back_moves: m.backMoves,
      furthest_phase: m.furthestPhase ?? "",
      furthest_phase_order: order(m.furthestPhase),
      phases_completed: m.phasesCompleted,
      asks_for_answer: m.asksForAnswer,
      difficulties_total: m.difficultiesTotal,
      difficulty_diversity: m.difficultyDiversity,
      skill_diversity: m.skillDiversity,
      hints_H1: m.hints.light,
      hints_H2: m.hints.medium,
      hints_H3: m.hints.strong,
      hints_H4: m.hints.step ?? 0,
      last_pattern: last,
    };
  });

  const messageRows: Record<string, unknown>[] = [];
  for (const s of sessions) {
    let n = 0;
    s.messages.forEach((msg, i) => {
      if (msg.role !== "student" || msg.phase === "extension") return;
      n += 1;
      const a = msg.analysis;
      const next = s.messages.slice(i + 1).find((x) => x.role !== "student");
      const sig = (a?.signals ?? {}) as Record<string, unknown>;
      messageRows.push({
        session_id: s.sessionId,
        student: s.name,
        class: s.classCode,
        lang: s.lang,
        gender: s.gender,
        message_no: n,
        at: msg.created_at,
        phase: a?.phase ?? "",
        phase_order: order(a?.phase),
        phases_in_message: (a?.phases ?? []).map((p) => p.phase).join(";"),
        level: a?.level ?? "",
        student_pattern: a?.student_pattern ?? "",
        motivation: a?.motivation ?? "",
        challenge: a?.challenge ?? "",
        skills: (a?.skills ?? []).join(";"),
        asks_for_answer: a ? a.asks_for_answer : "",
        phase_complete: a ? a.phase_complete : "",
        request_type: typeof sig.request_type === "string" ? sig.request_type : "",
        response_to_last_hint: typeof sig.response_to_last_hint === "string" ? sig.response_to_last_hint : "",
        word_count: msg.word_count ?? "",
        response_seconds: msg.response_ms == null ? "" : Math.round(msg.response_ms / 1000),
        next_max_hint: next?.hint_level ? (HINT_CODE[next.hint_level] ?? next.hint_level) : "",
        next_max_move: next?.move ?? "",
        text: msg.content.slice(0, 500),
      });
    });
  }
  return {
    sessionsCsv: csv(sessionRows, SESSION_COLS),
    messagesCsv: csv(messageRows, MESSAGE_COLS),
    counts: { sessions: sessionRows.length, messages: messageRows.length, students: new Set(sessionRows.map((r) => `${r.class}/${r.student}`)).size },
  };
}
