// Create and list staff accounts. Protected by the ADMIN_SECRET environment variable
// (sent in the "x-admin-secret" header from the /admin page).
// POST body: { email, name, role: "teacher" | "researcher" | "admin", password }
import { supabaseAdmin } from "@/lib/supabase";
import { checkAdminSecret, hashPassword } from "@/lib/auth";

const ROLES = ["teacher", "researcher", "admin"];

export async function GET(req: Request) {
  if (!checkAdminSecret(req.headers.get("x-admin-secret"))) return Response.json({ error: "סיסמת מנהל שגויה" }, { status: 401 });
  const { data, error } = await supabaseAdmin().from("staff").select("id, email, name, role, created_at").order("created_at");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ staff: data });
}

export async function POST(req: Request) {
  if (!checkAdminSecret(req.headers.get("x-admin-secret"))) return Response.json({ error: "סיסמת מנהל שגויה" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; role?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const name = body.name?.trim();
  if (!email || !name || !body.role || !ROLES.includes(body.role)) {
    return Response.json({ error: "צריך מייל, שם ותפקיד" }, { status: 400 });
  }
  if (!body.password || body.password.length < 8) {
    return Response.json({ error: "הסיסמה צריכה להיות לפחות 8 תווים" }, { status: 400 });
  }
  const { data, error } = await supabaseAdmin()
    .from("staff")
    .upsert({ email, name, role: body.role, password_hash: hashPassword(body.password) }, { onConflict: "email" })
    .select("id, email, name, role")
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ staff: data });
}
