// POST /api/staff/login — two separate doors. Body: { email, password, as: "teacher" | "researcher" }
// Teachers sign in through the teachers' door only; researchers (and admins) through the researchers' door.
import { supabaseAdmin } from "@/lib/supabase";
import { startStaffSession, verifyPassword, type Role } from "@/lib/auth";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string; as?: string; lang?: string };
  const ar = body.lang === "ar";
  const email = body.email?.trim().toLowerCase();
  if (!email || !body.password) return Response.json({ error: "צריך מייל וסיסמה" }, { status: 400 });

  const { data: user } = await supabaseAdmin()
    .from("staff")
    .select("id, email, name, role, password_hash")
    .eq("email", email)
    .maybeSingle();
  if (!user || !verifyPassword(body.password, user.password_hash)) {
    return Response.json({ error: ar ? "البريد أو كلمة المرور غير صحيحة" : "המייל או הסיסמה לא נכונים" }, { status: 401 });
  }
  const isResearcherAccount = user.role === "researcher" || user.role === "admin";
  if (body.as === "teacher" && isResearcherAccount) {
    return Response.json(
      { error: ar ? "هذا حساب باحث/ة. ادخلوا من «دخول الباحثات»." : "זה חשבון של חוקר/ת. היכנסו דרך ״כניסת חוקרות״." },
      { status: 403 },
    );
  }
  if (body.as === "researcher" && !isResearcherAccount) {
    return Response.json(
      { error: ar ? "هذا حساب معلّم/ة. ادخلوا من «دخول المعلّمين»." : "זה חשבון של מורה. היכנסו דרך ״כניסת מורים״." },
      { status: 403 },
    );
  }
  await startStaffSession({ id: user.id, email: user.email, name: user.name, role: user.role as Role });
  return Response.json({ ok: true, role: user.role, name: user.name });
}
