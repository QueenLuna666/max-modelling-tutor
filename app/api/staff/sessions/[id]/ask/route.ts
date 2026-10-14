// POST /api/staff/sessions/:id/ask — ask the assistant about this student's thinking.
// Body: { question, history: [{ role: "user"|"assistant", content }] } → { answer }
// Researchers get answers with the lab's coding; teachers get plain pedagogical answers.
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { sessionDetail } from "@/lib/staffData";
import { askAboutStudent, type SessionForSummary } from "@/lib/summaries";
import { getLimits, logUsage, usedToday } from "@/lib/limits";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { question?: string; history?: { role: "user" | "assistant"; content: string }[] };
  const question = body.question?.trim().slice(0, 1000);
  if (!question) return Response.json({ error: "מה השאלה?" }, { status: 400 });
  const base = await sessionDetail(staff, id);
  if ("error" in base) return base.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });

  const limits = await getLimits();
  if ((await usedToday(["research", "student_chat"])) >= limits.dailyResearchQueries) {
    return Response.json({ error: `הגעתם למגבלה היומית של השאלות (${limits.dailyResearchQueries}). אפשר לשנות אותה בדף ״שימוש ותקציב״.` }, { status: 429 });
  }
  const researcher = isResearcher(staff);
  const full = researcher ? base : await sessionDetail({ ...staff, role: "admin" }, id);
  if ("error" in full) return Response.json({ error: "Not found" }, { status: 404 });
  let history = (body.history ?? []).filter((h) => h && typeof h.content === "string" && (h.role === "user" || h.role === "assistant")).slice(-10);
  while (history.length && history[0].role !== "user") history = history.slice(1); // turns must start with a question
  try {
    const { answer, usage, model } = await askAboutStudent(full as unknown as SessionForSummary, question, history, researcher ? "researcher" : "teacher");
    void logUsage("student_chat", model, usage as never, { staffId: staff.id, sessionId: id });
    return Response.json({ answer });
  } catch (e) {
    console.error("ask failed", e);
    return Response.json({ error: "לא הצלחתי לענות. נסו שוב." }, { status: 500 });
  }
}
