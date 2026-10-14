// GET /api/session/:id — resume a student session after a page refresh.
import { supabaseAdmin } from "@/lib/supabase";
import { publicTask, type Lang } from "@/lib/tasks";
import { getTask } from "@/lib/taskStore";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: session } = await db
    .from("sessions")
    .select("id, task_id, lang, gender, current_phase, status")
    .eq("id", id)
    .maybeSingle();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  const task = await getTask(session.task_id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  const { data: messages } = await db
    .from("messages")
    .select("role, content, move")
    .eq("session_id", id)
    .order("created_at", { ascending: true });

  return Response.json({
    sessionId: session.id,
    status: session.status,
    phase: session.current_phase,
    task: publicTask(task, session.lang as Lang),
    messages: messages ?? [],
  });
}
