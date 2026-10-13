// POST /api/staff/login — teachers and researchers. Body: { email, password }
import { supabaseAdmin } from "@/lib/supabase";
import { startStaffSession, verifyPassword, type Role } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) return Response.json({ error: "צריך מייל וסיסמה" }, { status: 400 });

  const { data: user } = await supabaseAdmin()
    .from("staff")
    .select("id, email, name, role, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return Response.json({ error: "המייל או הסיסמה לא נכונים" }, { status: 401 });
  }
  await startStaffSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role });
  return Response.json({ ok: true, role: user.role, name: user.name });
}
