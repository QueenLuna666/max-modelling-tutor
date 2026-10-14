// AI summaries for teachers: one student's modelling process, or the whole class
// ("what to do in the next lesson"). Built from the lab's coding of every message.
import "server-only";
import { llm, model } from "./llm";
import { loadPrompt } from "./prompts";
import { codeLabel } from "./framework";

type Msg = {
  role: string;
  content: string;
  phase?: string | null;
  hintLevel?: string | null;
  analysis?: { performance?: string; motivation?: string; challenge?: string | null; skills?: string[]; evidence?: string } | null;
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
        ? ` [phase: ${phaseName.get(m.phase ?? "") ?? m.phase}; performance: ${a.performance}; motivation: ${a.motivation}${a.challenge ? `; difficulty: ${label(a.challenge)}` : ""}${a.skills?.length ? `; skills: ${a.skills.map(label).join(", ")}` : ""}]`
        : "";
      return `STUDENT${tags}: ${m.content}`;
    })
    .join("\n");
}

async function write(prompt: string): Promise<string> {
  const res = await llm().messages.create(
    { model: await model("tutor"), max_tokens: 3000, system: await loadPrompt("summary"), messages: [{ role: "user", content: prompt }] },
    { timeout: 90_000 },
  );
  return res.content
    .map((b) => (b.type === "text" ? b.text : ""))
    .join("")
    .trim();
}

export function summarizeSession(d: SessionForSummary): Promise<string> {
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
(2–3 concrete steps for the teacher, including one question to ask the student)`);
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

export function summarizeClass(d: ClassForSummary): Promise<string> {
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
(2–3 concrete teaching moves, e.g. a whole-class discussion question, pairing students, a mini-lesson on a specific phase)`);
}
