// POST /api/staff/classes/:id/ask — ask the assistant about the whole class (students hidden from
// results are left out). Body: { question, history } → { answer }
// Researchers get answers with the lab's coding; teachers get plain pedagogical answers.
import { canSeeClass, forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { exportData } from "@/lib/staffData";
import { askAboutClass } from "@/lib/summaries";
import { getLimits, logUsage, usedToday } from "@/lib/limits";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 180;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { question?: string; history?: { role: "user" | "assistant"; content: string }[] };
  const question = body.question?.trim().slice(0, 1000);
  if (!question) return Response.json({ error: "מה השאלה?" }, { status: 400 });

  const { data: cls } = await supabaseAdmin().from("classes").select("id, code, name, teacher_id").eq("id", id).maybeSingle();
  if (!cls) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canSeeClass(staff, cls)) return forbidden();

  const limits = await getLimits();
  if ((await usedToday(["research", "student_chat"])) >= limits.dailyResearchQueries) {
    return Response.json({ error: `הגעתם למגבלה היומית של השאלות (${limits.dailyResearchQueries}). אפשר לשנות אותה בדף ״שימוש ותקציב״.` }, { status: 429 });
  }
  // Full data is read server-side; for teachers the coding is left out of the prompt (audience).
  const data = await exportData({ ...staff, role: "admin" }, { classId: id });
  if ("error" in data) return Response.json({ error: "Not found" }, { status: 404 });
  if (!data.sessions.length) return Response.json({ error: "עוד אין שיחות של תלמידים בכיתה הזו" }, { status: 400 });

  let history = (body.history ?? []).filter((h) => h && typeof h.content === "string" && (h.role === "user" || h.role === "assistant")).slice(-10);
  while (history.length && history[0].role !== "user") history = history.slice(1);
  const researcher = isResearcher(staff);
  try {
    const { answer, usage, model } = await askAboutClass(cls.name ?? cls.code, data.sessions, question, history, researcher ? "researcher" : "teacher");
    void logUsage("student_chat", model, usage as never, { staffId: staff.id });
    return Response.json({ answer });
  } catch (e) {
    console.error("class ask failed", e);
    return Response.json({ error: "לא הצלחתי לענות. נסו שוב." }, { status: 500 });
  }
}
