// POST /api/staff/sessions/:id/summary — AI summary of one student's modelling process for the teacher.
// Saved in sessions.summary, so it shows next time without waiting.
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { sessionDetail } from "@/lib/staffData";
import { summarizeSession, type SessionForSummary } from "@/lib/summaries";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { lang?: string };
  const base = await sessionDetail(staff, id); // checks the teacher may see this class
  if ("error" in base) return base.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });
  // The summary needs the lab's coding, which teachers don't see on screen.
  const full = isResearcher(staff) ? base : await sessionDetail({ ...staff, role: "admin" }, id);
  if ("error" in full) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const summary = await summarizeSession(full as unknown as SessionForSummary, body.lang === "ar" ? "ar" : "he", isResearcher(staff) ? "researcher" : "teacher");
    // Saved per audience, so a teacher never sees the research version (with codes) and vice versa.
    await supabaseAdmin().from("sessions").update({ summary: `[${isResearcher(staff) ? "researcher" : "teacher"}]\n${summary}` }).eq("id", id);
    return Response.json({ summary });
  } catch (e) {
    console.error("summary failed", e);
    return Response.json({ error: body.lang === "ar" ? "لم أنجح في كتابة الملخّص. حاولوا مرة أخرى." : "לא הצלחתי לכתוב סיכום. נסו שוב." }, { status: 500 });
  }
}
