// POST /api/session — log in with class code + nickname, start a task.
// Body: { classCode: string, nickname: string, gender: "male" | "female", taskId?: string, lang?: "he" | "ar" | "en" }
// Returns: { sessionId, task, opening }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { getTask, openingFor, publicTask, type Gender, type Lang } from "@/lib/tasks";

export const runtime = "nodejs";

const LANGS: Lang[] = ["he", "ar", "en"];
const GENDERS: Gender[] = ["male", "female"];

export async function POST(req: Request) {
  let body: { classCode?: string; nickname?: string; gender?: string; taskId?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const classCode = body.classCode?.trim().toUpperCase();
  const nickname = body.nickname?.trim();
  const taskId = body.taskId ?? "speedometer";
  const lang: Lang = LANGS.includes(body.lang as Lang) ? (body.lang as Lang) : "he";

  if (!classCode || !nickname) {
    return NextResponse.json({ error: "צריך קוד כיתה וכינוי" }, { status: 400 });
  }
  if (!GENDERS.includes(body.gender as Gender)) {
    return NextResponse.json({ error: "צריך לבחור איך לפנות אליך: בן או בת" }, { status: 400 });
  }
  const gender = body.gender as Gender;
  if (nickname.length > 30) {
    return NextResponse.json({ error: "הכינוי ארוך מדי (עד 30 תווים)" }, { status: 400 });
  }

  const task = getTask(taskId);
  if (!task) return NextResponse.json({ error: "המשימה לא נמצאה" }, { status: 404 });

  const db = supabaseAdmin();

  const { data: cls } = await db.from("classes").select("id").eq("code", classCode).maybeSingle();
  if (!cls) return NextResponse.json({ error: "קוד הכיתה לא נמצא" }, { status: 404 });

  const { data: student, error: stuErr } = await db
    .from("students")
    .upsert({ class_id: cls.id, nickname }, { onConflict: "class_id,nickname" })
    .select("id")
    .single();
  if (stuErr || !student) return NextResponse.json({ error: stuErr?.message ?? "שגיאה" }, { status: 500 });

  const { data: session, error: sesErr } = await db
    .from("sessions")
    .insert({ student_id: student.id, task_id: task.id, lang, gender, current_phase: task.phases[0].id })
    .select("id")
    .single();
  if (sesErr || !session) return NextResponse.json({ error: sesErr?.message ?? "שגיאה" }, { status: 500 });

  // MAX opens the conversation; store it so the transcript is complete.
  const opening = openingFor(task, lang, gender);
  await db.from("messages").insert({
    session_id: session.id,
    role: "tutor",
    content: opening,
    phase: task.phases[0].id,
    move: "opening",
  });

  return NextResponse.json({ sessionId: session.id, task: publicTask(task, lang), opening });
}
