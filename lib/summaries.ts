// AI summaries for teachers: one student's modelling process, or the whole class
// ("what to do in the next lesson"). Built from the lab's coding of every message.
import "server-only";
import { llm, model } from "./llm";
import { loadPrompt } from "./prompts";
import { codeLabel } from "./framework";
import { logUsage } from "./limits";

type Msg = {
  role: string;
  content: string;
  phase?: string | null;
  hintLevel?: string | null;
  analysis?: { performance?: string; level?: string | null; studentPattern?: string | null; motivation?: string; challenge?: string | null; skills?: string[]; evidence?: string } | null;
};

export type SessionForSummary = {
  student: { nickname: string };
  session: { taskTitle: string; gender: string; status: string; currentPhase: string };
  phases: { id: string; label: string }[];
  metrics: unknown;
  journey: { backMoves: unknown[] };
  messages: Msg[];
};

const label = (code: string) => `${code} (${codeLabel(code)})`;

function transcript(d: SessionForSummary, max = 60): string {
  const phaseName = new Map(d.phases.map((p) => [p.id, p.label]));
  return d.messages
    .slice(-max)
    .map((m) => {
      if (m.role !== "student") return `MAX${m.hintLevel ? ` [hint: ${m.hintLevel}]` : ""}: ${m.content}`;
      const a = m.analysis;
      const tags = a
        ? ` [phase: ${phaseName.get(m.phase ?? "") ?? m.phase}; level: ${a.level ?? a.performance}; overall pattern so far: ${a.studentPattern ?? "?"}; motivation: ${a.motivation}${a.challenge ? `; difficulty: ${label(a.challenge)}` : ""}${a.skills?.length ? `; skills: ${a.skills.map(label).join(", ")}` : ""}]`
        : "";
      return `STUDENT${tags}: ${m.content}`;
    })
    .join("\n");
}

export type SummaryLang = "he" | "ar";

const IN_ARABIC =
  "\n\nIMPORTANT: write the whole summary in Arabic (clear Modern Standard Arabic for a teacher in an Arab school in Israel), not Hebrew. Translate the headings too: بإيجاز / نقاط القوة / أين تعثّر/ت / ماذا نفعل — or for a class: صورة الوضع / صعوبات شائعة / من يحتاج انتباهًا / اقتراح للدرس القادم. Phase names in Arabic: فهم المشكلة، تبسيط المشكلة، بناء نموذج رياضي، العمل الرياضي، تفسير النتائج، التحقق من النموذج.";

export type Audience = "researcher" | "teacher";

// Teachers get the pedagogical picture only: the lab keeps its coding scheme to the research team.
const FOR_TEACHER =
  "\n\nIMPORTANT — the reader is the class TEACHER, not the research team. Do NOT mention any codes (U4, D-U3 …), the words performance/motivation or their levels, the analyzer, hint levels, or the lab's coding categories. Describe what the student did and needs in plain pedagogical language only.";

async function write(prompt: string, lang: SummaryLang = "he", audience: Audience = "researcher"): Promise<string> {
  if (audience === "teacher") prompt += FOR_TEACHER;
  if (lang === "ar") prompt += IN_ARABIC;
  const res = await llm().messages.create(
    { model: await model("tutor"), max_tokens: 3000, system: await loadPrompt("summary"), messages: [{ role: "user", content: prompt }] },
    { timeout: 90_000 },
  );
  void logUsage("summary", res.model, res.usage);
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

export function summarizeSession(d: SessionForSummary, lang: SummaryLang = "he", audience: Audience = "researcher"): Promise<string> {
  const phaseName = d.phases.find((p) => p.id === d.session.currentPhase)?.label ?? d.session.currentPhase;
  return write(`Write a summary of ONE student's modelling process for the teacher.

Student: ${d.student.nickname} (${d.session.gender === "female" ? "בת" : "בן"})
Task: ${d.session.taskTitle}
Status: ${d.session.status === "done" ? "finished" : "still working"}; the phase MAX is guiding now: ${phaseName}
Moves back to an earlier phase: ${d.journey.backMoves.length}
Metrics per phase (messages, minutes, difficulties, hints): ${JSON.stringify(d.metrics)}

Conversation with the lab's coding:
${transcript(d)}

Structure:
### בקצרה
(1–2 sentences: where the student is and how the process went)
### חוזקות
### היכן נתקע/ה
### מה כדאי לעשות
(2–3 concrete steps for the teacher, including one question to ask the student)`, lang, audience);
}

export type ClassForSummary = {
  className: string;
  taskTitle: string;
  phases: { id: string; label: string }[];
  students: {
    name: string;
    status: string;
    currentPhase: string;
    messages: number;
    backMoves: number;
    perPhase: Record<string, number>;
    hints: Record<string, string>;
    difficulties: string[];
    skills: string[];
    alerts: string[];
  }[];
};

export function summarizeClass(d: ClassForSummary, lang: SummaryLang = "he", audience: Audience = "researcher"): Promise<string> {
  const phaseName = new Map(d.phases.map((p) => [p.id, p.label]));
  const lines = d.students.map(
    (s) =>
      `- ${s.name}: ${s.status === "done" ? "finished" : "working"}, now in "${phaseName.get(s.currentPhase) ?? s.currentPhase}", ${s.messages} messages, ${s.backMoves} moves back; messages per phase ${JSON.stringify(s.perPhase)}; strongest hint per phase ${JSON.stringify(s.hints)}; difficulties: ${s.difficulties.map(label).join(", ") || "none"}; skills shown: ${s.skills.map(label).join(", ") || "none"}${s.alerts.length ? `; alerts: ${s.alerts.join("; ")}` : ""}`,
  );
  return write(`Write a summary of the WHOLE CLASS for the teacher, to plan the next lesson.

Class: ${d.className}
Task: ${d.taskTitle}
Phases in order: ${d.phases.map((p) => p.label).join(" → ")}

Students:
${lines.join("\n")}

Structure:
### תמונת מצב
(2 sentences: how far the class got, where most students are)
### קשיים נפוצים
(the 2–3 most common difficulties, with how many students, in words)
### מי צריך/ה תשומת לב
(names + one line why)
### הצעה לשיעור הבא
(2–3 concrete teaching moves, e.g. a whole-class discussion question, pairing students, a mini-lesson on a specific phase)`, lang, audience);
}
