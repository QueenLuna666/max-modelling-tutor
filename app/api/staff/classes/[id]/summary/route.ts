// POST /api/staff/classes/:id/summary — AI summary of the class for planning the next lesson.
// Body: { taskId? }  → { summary }
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { classDashboard } from "@/lib/staffData";
import { summarizeClass } from "@/lib/summaries";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { taskId?: string };
  const d = await classDashboard(staff, id);
  if (!("class" in d)) return d.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });

  const task = d.tasks.find((t) => t.id === body.taskId) ?? d.tasks[0];
  if (!task) return Response.json({ error: "עוד אין עבודה של תלמידים בכיתה הזו" }, { status: 400 });
  // Latest session of each student on this task.
  const latest = new Map<string, (typeof d.sessions)[number]>();
  for (const s of d.sessions) if (s.taskId === task.id && !latest.has(s.studentId)) latest.set(s.studentId, s);
  const rows = [...latest.values()];
  if (!rows.length) return Response.json({ error: "עוד אין עבודה של תלמידים במשימה הזו" }, { status: 400 });

  const { data: anns } = await supabaseAdmin()
    .from("annotations")
    .select("session_id, challenge, skills")
    .in("session_id", rows.map((r) => r.sessionId));

  try {
    const summary = await summarizeClass({
      className: d.class.name ?? d.class.code,
      taskTitle: task.title,
      phases: task.phases,
      students: rows.map((r) => {
        const mine = (anns ?? []).filter((a) => a.session_id === r.sessionId);
        return {
          name: r.nickname,
          status: r.status,
          currentPhase: r.currentPhase,
          messages: r.studentMessages,
          backMoves: r.backMoves,
          perPhase: r.perPhase,
          hints: r.hints,
          difficulties: [...new Set(mine.map((a) => a.challenge).filter(Boolean) as string[])],
          skills: [...new Set(mine.flatMap((a) => (a.skills as string[] | null) ?? []))],
          alerts: r.alerts.map((a) => a.text),
        };
      }),
    });
    return Response.json({ summary });
  } catch (e) {
    console.error("class summary failed", e);
    return Response.json({ error: "לא הצלחתי לכתוב סיכום. נסו שוב." }, { status: 500 });
  }
}
