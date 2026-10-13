// POST /api/session/:id/finish — the student pressed "I'm done".
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { error } = await supabaseAdmin()
    .from("sessions")
    .update({ status: "done", ended_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "active");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
