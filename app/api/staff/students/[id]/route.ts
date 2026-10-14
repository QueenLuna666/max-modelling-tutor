// PATCH /api/staff/students/:id — rename a student for reports, or hide them from results and analyses.
// Body: { displayName?: string | null, excluded?: boolean }. The name the student typed is kept.
import { canSeeClass, forbidden, getStaff, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: student } = await db.from("students").select("id, class_id").eq("id", id).maybeSingle();
  if (!student) return Response.json({ error: "Not found" }, { status: 404 });
  const { data: cls } = await db.from("classes").select("id, teacher_id").eq("id", student.class_id).maybeSingle();
  if (!cls || !canSeeClass(staff, cls)) return forbidden();

  const body = (await req.json().catch(() => ({}))) as { displayName?: string | null; excluded?: boolean };
  const update: Record<string, unknown> = {};
  if ("displayName" in body) update.display_name = body.displayName?.trim().slice(0, 40) || null;
  if (typeof body.excluded === "boolean") update.excluded = body.excluded;
  if (!Object.keys(update).length) return Response.json({ error: "Nothing to change" }, { status: 400 });
  const { error } = await db.from("students").update(update).eq("id", id);
  if (error) {
    const missing = /display_name|excluded/.test(error.message);
    return Response.json({ error: missing ? "צריך להריץ את migration_006_limits.sql ב-Supabase" : error.message }, { status: 500 });
  }
  return Response.json({ ok: true });
}
