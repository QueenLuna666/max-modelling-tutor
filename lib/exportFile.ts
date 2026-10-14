// Turns export data into files researchers can read: an Excel workbook (RTL, Hebrew headers),
// a structured JSON, and a CSV of the coded conversation.
import ExcelJS from "exceljs";
import { DIFFICULTIES, SKILLS, TRANSVERSAL, PHASES, codeLabel } from "./framework";
import type { ExportSession } from "./staffData";
import { policyTable } from "./policy";

const LEVEL_HE: Record<string, string> = { strong: "חזק", intermediate: "ביניים", significant_difficulty: "קושי משמעותי", insufficient_evidence: "אין די ראיות" };
const PERF: Record<string, string> = { high: "גבוה", partial: "חלקי", low: "נמוך" };
const MOT: Record<string, string> = { high: "גבוהה", low: "נמוכה" };
const HINT: Record<string, string> = { none: "בלי רמז", light: "קל", medium: "בינוני", strong: "חזק" };
const SCAFFOLD: Record<string, string> = { in_step: "תמיכה בתוך שלב", transition: "מעבר בין שלבים", motivation: "הנעה" };
const MOVE: Record<string, string> = {
  opening: "פתיחה",
  challenge: "אתגר / הרחבה",
  praise_confirm: "שבח ואישור",
  guiding_question: "שאלה מנחה",
  encourage_plus_hint: "עידוד + רמז",
  structured_hint: "רמז מובנה",
  shrink_task: "הקטנת המשימה",
  refuse_answer_shrink: "סירוב לתת תשובה + צעד קטן",
};
const STATUS: Record<string, string> = { active: "פעיל/ה", done: "סיים/ה", abandoned: "נטש/ה" };
const yesNo = (b: boolean | null | undefined) => (b ? "כן" : "לא");
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", dateStyle: "short", timeStyle: "short" }) : "";
const codes = (list: string[] | null | undefined) => (list ?? []).map((c) => `${c} ${codeLabel(c)}`).join("; ");
const phaseName = (s: ExportSession, id: string | null) => (id ? (s.phases.find((p) => p.id === id)?.label ?? id) : "");

type Col = { header: string; key: string; width: number; wrap?: boolean };

function sheet(wb: ExcelJS.Workbook, name: string, cols: Col[], rows: Record<string, unknown>[], note?: string) {
  const ws = wb.addWorksheet(name, { views: [{ rightToLeft: true, state: "frozen", ySplit: note ? 2 : 1 }] });
  if (note) {
    ws.addRow([note]);
    ws.mergeCells(1, 1, 1, cols.length);
    const c = ws.getCell(1, 1);
    c.font = { italic: true, color: { argb: "FF5D6875" } };
    c.alignment = { wrapText: true, vertical: "middle", horizontal: "right" };
    ws.getRow(1).height = 34;
  }
  ws.columns = cols.map((c) => ({ key: c.key, width: c.width }));
  const head = ws.addRow(cols.map((c) => c.header));
  head.font = { bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F625C" } };
  head.alignment = { wrapText: true, vertical: "middle", horizontal: "right" };
  head.height = 30;
  for (const r of rows) {
    const row = ws.addRow(cols.map((c) => r[c.key] ?? ""));
    row.alignment = { vertical: "top", horizontal: "right", wrapText: true };
  }
  return ws;
}

export async function toXlsx(sessions: ExportSession[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "MAX — MtED lab";
  wb.created = new Date();

  // 1. One row per student session.
  sheet(
    wb,
    "סיכום תלמידים",
    [
      { header: "כיתה", key: "class", width: 9 },
      { header: "שם", key: "name", width: 12 },
      { header: "משימה", key: "task", width: 16 },
      { header: "שפה", key: "lang", width: 7 },
      { header: "פנייה", key: "gender", width: 7 },
      { header: "סטטוס", key: "status", width: 9 },
      { header: "דפוס התלמיד/ה (אחרון)", key: "pattern", width: 13 },
      { header: "התחלה", key: "start", width: 15 },
      { header: "משך (דקות)", key: "minutes", width: 9 },
      { header: "הודעות תלמיד", key: "msgs", width: 9 },
      { header: "ממוצע מילים להודעה", key: "words", width: 10 },
      { header: "זמן תגובה ממוצע (שניות)", key: "resp", width: 11 },
      { header: "תשובות קצרות (<5 מילים)", key: "short", width: 10 },
      { header: "בקשות לקבל תשובה", key: "asks", width: 9 },
      { header: "ביצוע גבוה", key: "pHigh", width: 8 },
      { header: "ביצוע חלקי", key: "pPartial", width: 8 },
      { header: "ביצוע נמוך", key: "pLow", width: 8 },
      { header: "הודעות במוטיבציה נמוכה", key: "lowMot", width: 10 },
      { header: "השלב הרחוק ביותר", key: "furthest", width: 16 },
      { header: "שלבים שהושלמו", key: "completed", width: 9 },
      { header: "חזרות לשלב קודם", key: "back", width: 9 },
      { header: "תדירות קשיים (סה״כ)", key: "diff", width: 10 },
      { header: "מגוון קשיים (קודים שונים)", key: "diffDiv", width: 10 },
      { header: "מגוון מיומנויות (קודים שונים)", key: "skillDiv", width: 11 },
      { header: "רמזים קלים", key: "hL", width: 8 },
      { header: "רמזים בינוניים", key: "hM", width: 8 },
      { header: "רמזים חזקים", key: "hS", width: 8 },
    ],
    sessions.map((s) => ({
      class: s.classCode,
      name: s.name,
      task: s.taskTitle,
      lang: s.lang === "ar" ? "ערבית" : s.lang === "en" ? "אנגלית" : "עברית",
      gender: s.gender === "female" ? "בת" : "בן",
      status: STATUS[s.status] ?? s.status,
      pattern: (() => {
        const last = [...s.messages].reverse().find((m) => m.analysis?.student_pattern)?.analysis?.student_pattern;
        return last ? (LEVEL_HE[last] ?? last) : "";
      })(),
      start: when(s.startedAt),
      minutes: s.metrics.minutesTotal,
      msgs: s.metrics.studentMessages,
      words: s.metrics.avgWords,
      resp: s.metrics.avgResponseSec ?? "",
      short: s.metrics.shortAnswers,
      asks: s.metrics.asksForAnswer,
      pHigh: s.metrics.performance.high,
      pPartial: s.metrics.performance.partial,
      pLow: s.metrics.performance.low,
      lowMot: s.metrics.lowMotivation,
      furthest: phaseName(s, s.metrics.furthestPhase),
      completed: `${s.metrics.phasesCompleted} / ${s.phases.length}`,
      back: s.metrics.backMoves,
      diff: s.metrics.difficultiesTotal,
      diffDiv: s.metrics.difficultyDiversity,
      skillDiv: s.metrics.skillDiversity,
      hL: s.metrics.hints.light,
      hM: s.metrics.hints.medium,
      hS: s.metrics.hints.strong,
    })),
    "שורה לכל תלמיד/ה. ביצוע ומוטיבציה = מספר ההודעות שתויגו כך. תדירות ומגוון קשיים לפי מסגרת המעבדה (Schwartz-Aviad & Kohen, 2026).",
  );

  // 2. Student × phase.
  sheet(
    wb,
    "מדדים לפי שלב",
    [
      { header: "שם", key: "name", width: 12 },
      { header: "מס׳ שלב", key: "no", width: 6 },
      { header: "שלב", key: "phase", width: 22 },
      { header: "כניסות לשלב", key: "visits", width: 8 },
      { header: "הודעות בשלב", key: "msgs", width: 8 },
      { header: "זמן בשלב (דקות)", key: "minutes", width: 9 },
      { header: "תדירות קשיים", key: "diff", width: 8 },
      { header: "מגוון קשיים", key: "diffDiv", width: 8 },
      { header: "קודי קשיים", key: "diffCodes", width: 42, wrap: true },
      { header: "מגוון מיומנויות", key: "skillDiv", width: 9 },
      { header: "מיומנויות שהופגנו", key: "skills", width: 46, wrap: true },
      { header: "רמזים קלים", key: "hL", width: 7 },
      { header: "רמזים בינוניים", key: "hM", width: 7 },
      { header: "רמזים חזקים", key: "hS", width: 7 },
      { header: "השלב הושלם", key: "done", width: 8 },
    ],
    sessions.flatMap((s) =>
      s.metrics.perPhase.map((p, i) => ({
        name: s.name,
        no: i + 1,
        phase: phaseName(s, p.phase),
        visits: p.visits,
        msgs: p.studentMessages,
        minutes: p.minutes,
        diff: p.difficulties,
        diffDiv: p.difficultyCodes.length,
        diffCodes: codes(p.difficultyCodes),
        skillDiv: p.skillCodes.length,
        skills: codes(p.skillCodes),
        hL: p.hints.light,
        hM: p.hints.medium,
        hS: p.hints.strong,
        done: yesNo(p.completed),
      })),
    ),
    "שורה לכל תלמיד/ה × שלב מידול. תדירות = כמה הודעות בשלב תויגו עם קושי; מגוון = כמה קודי קושי שונים. כניסות > 1 = התלמיד/ה חזר/ה לשלב.",
  );

  // 2b. Class level: per phase, across all students.
  if (sessions.length > 1 && sessions[0]) {
    sheet(
      wb,
      "כיתה לפי שלב",
      [
        { header: "מס׳ שלב", key: "no", width: 6 },
        { header: "שלב", key: "phase", width: 24 },
        { header: "תלמידים שהגיעו לשלב", key: "reached", width: 10 },
        { header: "תלמידים שהשלימו", key: "done", width: 10 },
        { header: "תלמידים שחזרו לשלב", key: "returned", width: 10 },
        { header: "תדירות קשיים (סה״כ בכיתה)", key: "diff", width: 11 },
        { header: "מגוון קשיים (קודים שונים)", key: "diffDiv", width: 11 },
        { header: "קשיים לפי שכיחות (מספר תלמידים)", key: "diffCodes", width: 52, wrap: true },
        { header: "ממוצע דקות בשלב", key: "minutes", width: 9 },
        { header: "רמזים חזקים (סה״כ)", key: "hS", width: 9 },
      ],
      sessions[0].phases.map((ph, i) => {
        const rows = sessions.map((s) => s.metrics.perPhase[i]).filter(Boolean);
        const reached = rows.filter((p) => p.studentMessages > 0);
        const byCode = new Map<string, number>();
        rows.forEach((p) => p.difficultyCodes.forEach((c) => byCode.set(c, (byCode.get(c) ?? 0) + 1)));
        return {
          no: i + 1,
          phase: ph.label,
          reached: reached.length,
          done: rows.filter((p) => p.completed).length,
          returned: rows.filter((p) => p.visits > 1).length,
          diff: rows.reduce((n, p) => n + p.difficulties, 0),
          diffDiv: byCode.size,
          diffCodes: [...byCode].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c} ${codeLabel(c)} (${n})`).join("; "),
          minutes: reached.length ? Math.round((reached.reduce((n, p) => n + p.minutes, 0) / reached.length) * 10) / 10 : 0,
          hS: rows.reduce((n, p) => n + p.hints.strong, 0),
        };
      }),
      "שורה לכל שלב, על פני כל התלמידים בקובץ. תדירות ומגוון הקשיים בכל שלב, כמו במחקר על יכולת האבחון (Schwartz-Aviad & Kohen, 2026).",
    );
  }

  // 3. The coded conversation.
  sheet(
    wb,
    "שיחה מתויגת",
    [
      { header: "שם", key: "name", width: 11 },
      { header: "#", key: "no", width: 5 },
      { header: "זמן", key: "at", width: 14 },
      { header: "דובר/ת", key: "who", width: 8 },
      { header: "תוכן ההודעה", key: "content", width: 60, wrap: true },
      { header: "שלב (תיוג)", key: "phase", width: 18 },
      { header: "כל השלבים בהודעה (רמה)", key: "allPhases", width: 34, wrap: true },
      { header: "רמת ביצוע בשלב", key: "level", width: 12 },
      { header: "ביצוע", key: "perf", width: 7 },
      { header: "דפוס התלמיד/ה עד כה", key: "pattern", width: 12 },
      { header: "מוטיבציה", key: "mot", width: 8 },
      { header: "מיומנויות", key: "skills", width: 36, wrap: true },
      { header: "קושי", key: "diff", width: 30, wrap: true },
      { header: "עדות (ציטוט)", key: "evidence", width: 30, wrap: true },
      { header: "ביקש/ה תשובה", key: "asks", width: 7 },
      { header: "השלים/ה שלב", key: "complete", width: 7 },
      { header: "מילים", key: "words", width: 6 },
      { header: "זמן תגובה (שניות)", key: "resp", width: 8 },
      { header: "רמת רמז של MAX", key: "hint", width: 8 },
      { header: "סוג תמיכה של MAX", key: "scaffold", width: 13 },
      { header: "מהלך של MAX", key: "move", width: 16 },
    ],
    sessions.flatMap((s) =>
      s.messages.map((m, i) => {
        const a = m.analysis;
        const student = m.role === "student";
        return {
          name: s.name,
          no: i + 1,
          at: when(m.created_at),
          who: student ? s.name : "MAX",
          content: m.content,
          phase: phaseName(s, student ? (a?.phase ?? m.phase) : m.phase),
          allPhases: (a?.phases ?? [])
            .map((p) => `${phaseName(s, p.phase)} (${LEVEL_HE[p.level] ?? p.level}${p.after_support ? ", אחרי תמיכה" : ""})`)
            .join("; "),
          level: a?.level ? (LEVEL_HE[a.level] ?? a.level) : "",
          pattern: a?.student_pattern ? (LEVEL_HE[a.student_pattern] ?? a.student_pattern) : "",
          perf: a?.performance ? PERF[a.performance] : "",
          mot: a?.motivation ? MOT[a.motivation] : "",
          skills: codes(a?.skills),
          diff: a?.challenge ? `${a.challenge} ${codeLabel(a.challenge)}` : "",
          evidence: a?.evidence ?? "",
          asks: a ? yesNo(a.asks_for_answer) : "",
          complete: a ? yesNo(a.phase_complete) : "",
          words: student ? (m.word_count ?? "") : "",
          resp: student && m.response_ms != null ? Math.round(m.response_ms / 1000) : "",
          hint: !student && m.hint_level ? HINT[m.hint_level] : "",
          scaffold: !student && m.scaffold_type ? SCAFFOLD[m.scaffold_type] : "",
          move: !student && m.move ? (MOVE[m.move] ?? m.move) : "",
        };
      }),
    ),
    "כל ההודעות לפי הסדר. התיוג נעשה ע״י הסוכן המאבחן לפי כללי צוות המחקר: זיהוי שלבי מידול (גם כמה בהודעה, או אף אחד), רמת ביצוע בכל שלב, ודפוס התלמיד/ה בשיחה. בהודעות MAX — רמת הרמז וסוג התמיכה שניתנו.",
  );

  // 4. Journey through the phases.
  sheet(
    wb,
    "מסע בין שלבים",
    [
      { header: "שם", key: "name", width: 12 },
      { header: "הודעת תלמיד/ה #", key: "no", width: 9 },
      { header: "זמן", key: "at", width: 14 },
      { header: "שלב", key: "phase", width: 24 },
      { header: "תנועה", key: "move", width: 14 },
    ],
    sessions.flatMap((s) =>
      s.journey.map((j, i) => ({
        name: s.name,
        no: j.index,
        at: when(j.at),
        phase: phaseName(s, j.phase),
        move: i === 0 ? "התחלה" : j.back ? "חזרה לשלב קודם" : s.journey[i - 1].phase === j.phase ? "באותו שלב" : "התקדמות",
      })),
    ),
    "רצף השלבים שבהם חשב/ה התלמיד/ה, הודעה אחר הודעה, כולל חזרות לשלבים קודמים.",
  );

  // 5. Code book.
  const phaseHe = (id: string) => PHASES.find((p) => p.id === id)?.he ?? id;
  sheet(
    wb,
    "מילון קודים",
    [
      { header: "קוד", key: "code", width: 10 },
      { header: "סוג", key: "kind", width: 12 },
      { header: "שלב", key: "phase", width: 24 },
      { header: "שם", key: "he", width: 34 },
      { header: "תיאור (לסוכן המאבחן)", key: "en", width: 60, wrap: true },
    ],
    [
      ...SKILLS.map((x) => ({ code: x.code, kind: "מיומנות", phase: phaseHe(x.phase), he: x.he, en: x.en })),
      ...TRANSVERSAL.map((x) => ({ code: x.code, kind: "מיומנות רוחב", phase: "כל השלבים", he: x.he, en: x.en })),
      ...DIFFICULTIES.map((x) => ({ code: x.code, kind: "קושי", phase: phaseHe(x.phase), he: x.he, en: x.en })),
    ],
    "הקודים לקוחים מהמסמך 'הגדרות ומיומנויות של כל שלב מידול' של צוות המחקר (Wess et al., 2021; Schwartz-Aviad & Kohen, 2026).",
  );

  const pol = policyTable();
  const PERF_HE: Record<string, string> = { high: "גבוה", partial: "חלקי", low: "נמוך" };
  const MOT_HE: Record<string, string> = { high: "גבוהה", low: "נמוכה" };
  const HINT_HE: Record<string, string> = { none: "בלי רמז", light: "קל", medium: "בינוני", strong: "חזק" };
  sheet(
    wb,
    "טבלת שקלול",
    [
      { header: "ביצוע", key: "perf", width: 12 },
      { header: "מוטיבציה", key: "mot", width: 12 },
      { header: "המהלך של MAX", key: "move", width: 22 },
      { header: "הרמז החזק ביותר", key: "hint", width: 16 },
      { header: "ההנחיה ל-MAX", key: "instruction", width: 70, wrap: true },
    ],
    [
      ...Object.entries(pol.table).flatMap(([perf, row]) =>
        Object.entries(row).map(([mot, c]) => ({ perf: PERF_HE[perf] ?? perf, mot: MOT_HE[mot] ?? mot, move: c.move, hint: HINT_HE[c.max_hint] ?? c.max_hint, instruction: c.instruction })),
      ),
      { perf: "ביקש/ה תשובה", mot: "—", move: pol.asks_for_answer.move, hint: HINT_HE[pol.asks_for_answer.max_hint], instruction: pol.asks_for_answer.instruction },
      ...pol.escalation_within_phase.map((r) => ({ perf: "הסלמה", mot: "", move: "", hint: "", instruction: r })),
    ],
    "כך הסוכן המאבחן והמדיניות מחליטים מה MAX עושה בכל הודעה: ביצוע × מוטיבציה → מהלך ורמז מרבי, עם הסלמה הדרגתית בתוך שלב.",
  );

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// The research JSON: one analyzer record per student message, in the same shape the team
// designed in the blueprint (phase, performance, motivation, challenge, evidence,
// asks_for_answer, lang), extended with the lab's codes and MAX's response to that message.
export function toJson(sessions: ExportSession[]) {
  return {
    exported_at: new Date().toISOString(),
    framework: "MtED modelling framework (Kohen lab): 6 phases, skills U1–V8 + cross-cutting X-, difficulties D-U1–D-V5 (Wess et al., 2021; TeDCI, Schwartz-Aviad & Kohen, 2026)",
    record_fields: {
      phase: "main modelling phase the message is about (may differ from the phase MAX was guiding); null = no phase identified",
      level: "performance level in the main phase: strong | intermediate | significant_difficulty | insufficient_evidence (research rules, part B)",
      student_pattern: "the student's overall pattern in the conversation so far, same scale (research rules, part C)",
      phases: "every phase identified in the message, each with level, aspect, skills, evidence quote and after_support (content already supplied by MAX)",
      performance: "high | partial | low — the level on the tutor's 3-point scale (null = insufficient evidence)",
      motivation: "high | low",
      challenge: "main difficulty code (D-…), or null",
      evidence: "short quote from the student's message that justifies the coding",
      asks_for_answer: "the student asked MAX for the answer",
      lang: "language of the conversation (he | ar | en)",
      skills: "skill codes the message gives evidence of",
      phase_complete: "the message completes the phase MAX was guiding",
      max_response: "what MAX did next, decided by the policy table",
    },
    policy: policyTable(),
    codebook: {
      phases: PHASES.map((p, i) => ({ order: i + 1, id: p.id, he: p.he, ar: p.ar, en: p.en, product: p.product })),
      skills: Object.fromEntries([...SKILLS, ...TRANSVERSAL].map((x) => [x.code, { he: x.he, en: x.en }])),
      difficulties: Object.fromEntries(DIFFICULTIES.map((d) => [d.code, { phase: d.phase, he: d.he, en: d.en }])),
    },
    sessions: sessions.map((s) => {
      const records: Record<string, unknown>[] = [];
      let n = 0;
      s.messages.forEach((m, i) => {
        if (m.role !== "student") return;
        n += 1;
        const a = m.analysis;
        const reply = s.messages.slice(i + 1).find((x) => x.role !== "student");
        records.push({
          message_no: n,
          at: m.created_at,
          student_message: m.content,
          // — the analyzer record (blueprint format) —
          phase: a ? a.phase : m.phase, // null = no phase identified (research rules A8)
          performance: a?.performance ?? null,
          motivation: a?.motivation ?? null,
          challenge: a?.challenge ?? null,
          evidence: a?.evidence ?? null,
          asks_for_answer: a?.asks_for_answer ?? false,
          lang: s.lang,
          // — the research team's identification rules —
          level: a?.level ?? null,
          student_pattern: a?.student_pattern ?? null,
          phases: (a?.phases ?? []).map((p) => ({ ...p, label: phaseName(s, p.phase) })),
          // — the lab's framework —
          phase_label: phaseName(s, a ? a.phase : m.phase),
          challenge_label: a?.challenge ? codeLabel(a.challenge) : null,
          skills: a?.skills ?? [],
          skills_labels: (a?.skills ?? []).map((c) => codeLabel(c)),
          phase_complete: a?.phase_complete ?? false,
          // — engagement signals —
          word_count: m.word_count,
          response_seconds: m.response_ms == null ? null : Math.round(m.response_ms / 1000),
          // — what MAX did with it —
          max_response: reply
            ? { guided_phase: reply.phase, hint_level: reply.hint_level, move: reply.move, scaffold_type: reply.scaffold_type, text: reply.content }
            : null,
          coded: Boolean(a),
        });
      });
      return {
        session_id: s.sessionId,
        student: s.name,
        class: s.classCode,
        gender: s.gender,
        lang: s.lang,
        task: { id: s.taskId, title: s.taskTitle },
        status: s.status,
        started_at: s.startedAt,
        ended_at: s.endedAt,
        metrics: {
          ...s.metrics,
          perPhase: s.metrics.perPhase.map((p) => ({ ...p, label: phaseName(s, p.phase) })),
        },
        journey: s.journey.map((j) => ({ ...j, label: phaseName(s, j.phase) })),
        records,
      };
    }),
  };
}
