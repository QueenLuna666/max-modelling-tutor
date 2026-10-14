// GET   /api/staff/classes/:id — dashboard data for one class.
// PATCH /api/staff/classes/:id — save the class settings (open tasks, student features, hint ceiling).
//   Body: { settings: ClassSettings }
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { classDashboard } from "@/lib/staffData";
import { normalizeSettings } from "@/lib/classSettings";
import { supabaseAdmin } from "@/lib/supabase";
import { canSeeClass } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const result = await classDashboard(staff, id);
  if ("error" in result) return result.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(result);
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const db = supabaseAdmin();
  const { data: cls } = await db.from("classes").select("id, teacher_id").eq("id", id).maybeSingle();
  if (!cls) return Response.json({ error: "Not found" }, { status: 404 });
  if (!canSeeClass(staff, cls)) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { settings?: unknown };
  const settings = normalizeSettings(body.settings);
  const { error } = await db.from("classes").update({ settings }).eq("id", id);
  if (error) {
    const missing = /settings/.test(error.message);
    return Response.json({ error: missing ? "צריך להריץ את migration_003_studio.sql ב-Supabase" : error.message }, { status: 500 });
  }
  return Response.json({ settings });
}
