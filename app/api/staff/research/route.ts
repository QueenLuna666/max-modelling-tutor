// POST /api/staff/research — the research assistant writes a Python analysis for a research question.
// Body: { question, classId?: string (empty = all classes), lang, previous?: { python, error } }
// → { plan: { title, approach, python }, files: { "sessions.csv", "messages.csv" }, counts }
// The code runs in the researcher's browser (Pyodide). Researchers only.
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { exportData } from "@/lib/staffData";
import { buildResearchCsv } from "@/lib/researchData";
import { writeAnalysis } from "@/lib/researchAgent";
import { getLimits, logUsage, usedToday } from "@/lib/limits";

export const maxDuration = 180;

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  if (!isResearcher(staff)) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { question?: string; classId?: string; lang?: string; previous?: { python?: string; error?: string } };
  const question = body.question?.trim().slice(0, 1500);
  if (!question) return Response.json({ error: "מה שאלת המחקר?" }, { status: 400 });
  const limits = await getLimits();
  if ((await usedToday(["research", "student_chat"])) >= limits.dailyResearchQueries) {
    return Response.json({ error: `הגעתם למגבלה היומית של השאלות (${limits.dailyResearchQueries}). אפשר לשנות אותה בדף ״שימוש ותקציב״.` }, { status: 429 });
  }

  const data = await exportData(staff, body.classId ? { classId: body.classId } : { all: true });
  if ("error" in data) return Response.json({ error: "Not found" }, { status: 404 });
  const { sessionsCsv, messagesCsv, counts } = buildResearchCsv(data.sessions);
  if (!counts.sessions) return Response.json({ error: "עוד אין שיחות לנתח בטווח שנבחר." }, { status: 400 });

  const head = (c: string, n: number) => c.split("\n").slice(0, n + 1).join("\n");
  try {
    const { plan, usage, model } = await writeAnalysis({
      question,
      lang: body.lang === "ar" ? "ar" : "he",
      sample: { sessions: head(sessionsCsv, 8), messages: head(messagesCsv, 12) },
      counts,
      previous: body.previous?.python && body.previous.error ? { python: body.previous.python, error: body.previous.error } : null,
    });
    void logUsage("research", model, usage as never, { staffId: staff.id });
    return Response.json({ plan, files: { "sessions.csv": sessionsCsv, "messages.csv": messagesCsv }, counts });
  } catch (e) {
    console.error("research failed", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
