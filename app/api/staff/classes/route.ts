// GET  /api/staff/classes — classes the signed-in staff member can see.
// POST /api/staff/classes — create a class. Body: { name, code? }  (code is generated if missing)
import { randomInt } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { getStaff, unauthorized } from "@/lib/auth";
import { listClasses } from "@/lib/staffData";

export async function GET() {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  return Response.json({ classes: await listClasses(staff) });
}

const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no look-alikes (0/O, 1/I/L)

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { name?: string; code?: string };
  const name = body.name?.trim();
  if (!name) return Response.json({ error: "צריך שם לכיתה" }, { status: 400 });

  let code = body.code?.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "");
  if (!code) code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");

  const { data, error } = await supabaseAdmin()
    .from("classes")
    .insert({ name, code, teacher_id: staff.role === "teacher" ? staff.id : null })
    .select("id, code, name")
    .single();
  if (error) {
    const taken = error.code === "23505";
    return Response.json({ error: taken ? "הקוד הזה כבר תפוס, נסו קוד אחר" : error.message }, { status: taken ? 409 : 500 });
  }
  return Response.json({ class: data });
}
