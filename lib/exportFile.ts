// Turns export data into files researchers can read: an Excel workbook (RTL, Hebrew headers),
// a structured JSON, and a CSV of the coded conversation.
import ExcelJS from "exceljs";
import { DIFFICULTIES, SKILLS, TRANSVERSAL, PHASES, codeLabel } from "./framework";
import type { ExportSession } from "./staffData";

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
      { header: "ביצוע", key: "perf", width: 7 },
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
    "כל ההודעות לפי הסדר. התיוג (שלב, ביצוע, מוטיבציה, מיומנויות, קושי) נעשה ע״י הסוכן המאבחן לכל הודעת תלמיד/ה. בהודעות MAX — רמת הרמז וסוג התמיכה שניתנו.",
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

  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Structured JSON: one object per session with metrics, phases and the coded conversation.
export function toJson(sessions: ExportSession[]) {
  return {
    exported_at: new Date().toISOString(),
    framework: "MtED modelling framework — 6 phases, skills U1–V8, difficulties D-U1–D-V5",
    sessions: sessions.map((s) => ({
      student: { name: s.name, class: s.classCode, language: s.lang, addressed_as: s.gender },
      task: { id: s.taskId, title: s.taskTitle },
      session: { id: s.sessionId, status: s.status, started_at: s.startedAt, ended_at: s.endedAt },
      metrics: { ...s.metrics, perPhase: undefined },
      phases: s.metrics.perPhase.map((p) => ({
        ...p,
        label: phaseName(s, p.phase),
        difficultyCodes: p.difficultyCodes.map((c) => ({ code: c, label: codeLabel(c) })),
        skillCodes: p.skillCodes.map((c) => ({ code: c, label: codeLabel(c) })),
      })),
      journey: s.journey.map((j) => ({ ...j, label: phaseName(s, j.phase) })),
      conversation: s.messages.map((m) => ({
        speaker: m.role === "student" ? "student" : "MAX",
        at: m.created_at,
        text: m.content,
        ...(m.role === "student"
          ? {
              words: m.word_count,
              response_seconds: m.response_ms == null ? null : Math.round(m.response_ms / 1000),
              coding: m.analysis
                ? {
                    phase: m.analysis.phase,
                    performance: m.analysis.performance,
                    motivation: m.analysis.motivation,
                    skills: (m.analysis.skills ?? []).map((c) => ({ code: c, label: codeLabel(c) })),
                    difficulty: m.analysis.challenge ? { code: m.analysis.challenge, label: codeLabel(m.analysis.challenge) } : null,
                    evidence: m.analysis.evidence,
                    asks_for_answer: m.analysis.asks_for_answer,
                    phase_complete: m.analysis.phase_complete,
                  }
                : null,
            }
          : { phase: m.phase, hint_level: m.hint_level, scaffold_type: m.scaffold_type, move: m.move }),
      })),
    })),
  };
}
