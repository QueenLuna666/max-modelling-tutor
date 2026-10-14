// A conversation (or a whole class) as a Word file, right-to-left — with or without the lab's coding.
import "server-only";
import { AlignmentType, Document, Packer, PageBreak, Paragraph, TextRun } from "docx";
import { codeLabel } from "./framework";
import { HINT_HE } from "./hints";
import { isFormulaLine, withoutDrawings } from "./messageFormat";
import type { ExportSession } from "./staffData";

const LEVEL_HE: Record<string, string> = { strong: "חזק", intermediate: "ביניים", significant_difficulty: "קושי משמעותי", insufficient_evidence: "אין די ראיות" };
const REQUEST_HE: Record<string, string> = { info: "בקשת מידע/נוסחה", check: "בקשת בדיקת חישוב", full_solution: "ביקש/ה פתרון מוכן", stop: "ביקש/ה לעצור" };
const RESPONSE_HE: Record<string, string> = { progressed: "התקדם/ה אחרי הרמז", partial: "התקדמות חלקית", same_difficulty: "אותו קושי אחרי הרמז" };
const FONT = "Arial";

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
const time = (iso: string) => new Date(iso).toLocaleTimeString("he-IL", { timeZone: "Asia/Jerusalem", hour: "2-digit", minute: "2-digit" });

function rtl(text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) {
  return new TextRun({ text, font: FONT, rightToLeft: true, bold: opts.bold, size: opts.size ?? 22, color: opts.color, italics: opts.italics });
}
function para(children: TextRun[], spacingAfter = 60) {
  return new Paragraph({ bidirectional: true, children, spacing: { after: spacingAfter } });
}

function textParagraphs(text: string, color?: string): Paragraph[] {
  return withoutDrawings(text, "\n[איור של MAX]\n")
    .split("\n")
    .filter((l) => l.trim())
    .map((line) =>
      isFormulaLine(line)
        ? new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line.trim(), font: "Consolas", size: 22, color })], spacing: { after: 60 } })
        : para([rtl(line.replace(/\*\*/g, ""), { color })]),
    );
}

export async function toTranscriptDocx(sessions: ExportSession[], withAnalysis: boolean): Promise<Buffer> {
  const body: Paragraph[] = [];
  sessions.forEach((s, si) => {
    if (si > 0) body.push(new Paragraph({ children: [new PageBreak()] }));
    const phaseName = (id: string | null | undefined) => (id ? (s.phases.find((p) => p.id === id)?.label ?? id) : "—");
    body.push(para([rtl(`שיחה עם MAX — ${s.name}`, { bold: true, size: 32 })], 120));
    body.push(
      para([
        rtl(
          `כיתה: ${s.classCode} · משימה: ${s.taskTitle} · שפה: ${s.lang === "ar" ? "ערבית" : s.lang === "en" ? "אנגלית" : "עברית"} · פנייה: ${s.gender === "female" ? "בת" : "בן"}`,
          { color: "555555", size: 20 },
        ),
      ]),
    );
    body.push(para([rtl(`התחלה: ${when(s.startedAt)} · סיום: ${when(s.endedAt)} · ${s.status === "done" ? "הסתיימה" : "פעילה"}`, { color: "555555", size: 20 })], 200));
    if (withAnalysis) {
      body.push(
        para(
          [rtl("גרסה עם הניתוח: מתחת לכל הודעת תלמיד/ה מופיע התיוג של הסוכן המאבחן לפי כללי צוות המחקר, ומתחת להודעות MAX רמת הרמז (H0–H4) והמהלך.", { italics: true, color: "777777", size: 18 })],
          200,
        ),
      );
    }

    let n = 0;
    for (const m of s.messages) {
      const student = m.role === "student";
      if (student) n += 1;
      body.push(para([rtl(`${student ? s.name : "MAX"}${student ? ` (${n})` : ""} · ${time(m.created_at)}`, { bold: true, color: student ? "4332B5" : "1F2347", size: 20 })], 20));
      body.push(...textParagraphs(m.content));

      if (withAnalysis && student && m.analysis) {
        const a = m.analysis;
        const phases = (a.phases ?? []).length
          ? (a.phases ?? []).map((p) => `${phaseName(p.phase)} (${LEVEL_HE[p.level] ?? p.level}${p.aspect ? `, ${p.aspect}` : ""}${p.after_support ? ", אחרי תמיכה" : ""})`).join("; ")
          : `${phaseName(a.phase ?? m.phase)}${a.level ? ` (${LEVEL_HE[a.level] ?? a.level})` : ""}`;
        const sig = (a.signals ?? {}) as Record<string, unknown>;
        const bits = [
          `שלבים: ${phases}`,
          a.student_pattern ? `דפוס עד כה: ${LEVEL_HE[a.student_pattern] ?? a.student_pattern}` : "",
          a.motivation ? `מוטיבציה: ${a.motivation === "low" ? "נמוכה" : "גבוהה"}` : "",
          (a.skills ?? []).length ? `מיומנויות: ${(a.skills ?? []).map((c) => `${c} ${codeLabel(c)}`).join(", ")}` : "",
          a.challenge ? `קושי: ${a.challenge} ${codeLabel(a.challenge)}` : "",
          a.evidence ? `עדות: "${a.evidence}"` : "",
          typeof sig.request_type === "string" && REQUEST_HE[sig.request_type] ? REQUEST_HE[sig.request_type] : "",
          typeof sig.response_to_last_hint === "string" && RESPONSE_HE[sig.response_to_last_hint] ? RESPONSE_HE[sig.response_to_last_hint] : "",
          sig.frustration_stated ? "הביע/ה תסכול" : "",
          a.asks_for_answer ? "ביקש/ה תשובה מוכנה" : "",
          a.phase_complete ? "השלים/ה את השלב" : "",
        ].filter(Boolean);
        body.push(para([rtl(`◂ ${bits.join(" · ")}`, { color: "8A5A00", size: 18 })], 40));
      }
      if (withAnalysis && !student && (m.hint_level || m.move)) {
        body.push(para([rtl(`◂ ${m.hint_level ? `רמז: ${HINT_HE[m.hint_level] ?? m.hint_level}` : ""}${m.move ? ` · מהלך: ${m.move}` : ""}`, { color: "8A5A00", size: 18 })], 40));
      }
      body.push(para([], 80));
    }
  });

  const doc = new Document({
    creator: "MAX — MtED lab",
    title: sessions.length === 1 ? `שיחה עם MAX — ${sessions[0].name}` : "שיחות עם MAX",
    styles: { default: { document: { run: { font: FONT, rightToLeft: true } } } },
    sections: [{ properties: {}, children: body.length ? body : [para([rtl("אין שיחות.")])] }],
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
