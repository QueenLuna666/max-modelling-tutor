// POST /api/session — log in with class code + nickname, start a task.
// Body: { classCode: string, nickname: string, gender: "male" | "female", taskId?: string, lang?: "he" | "ar" | "en" }
// Returns: { sessionId, task, opening }
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { openingFor, publicTask, type Gender, type Lang } from "@/lib/tasks";
import { getTask } from "@/lib/taskStore";
import { getLimits } from "@/lib/limits";
import { normalizePhone } from "@/lib/phone";

export const runtime = "nodejs";

const LANGS: Lang[] = ["he", "ar", "en"];
const GENDERS: Gender[] = ["male", "female"];

export async function POST(req: Request) {
  let body: { classCode?: string; nickname?: string; firstName?: string; lastName?: string; phone?: string; gender?: string; taskId?: string; lang?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const classCode = body.classCode?.trim().toUpperCase();
  const firstName = body.firstName?.trim().slice(0, 30) || "";
  const lastName = body.lastName?.trim().slice(0, 30) || "";
  const phone = body.phone ? normalizePhone(body.phone) : null;
  // The name staff see: "first last" (older logins sent only a first name).
  const nickname = firstName && lastName ? `${firstName} ${lastName}` : body.nickname?.trim();
  const taskId = body.taskId ?? "speedometer";
  const lang: Lang = LANGS.includes(body.lang as Lang) ? (body.lang as Lang) : "he";

  if (!classCode || !nickname) {
    return NextResponse.json({ error: "צריך קוד כיתה ושם" }, { status: 400 });
  }
  if (!firstName || !lastName || !phone) {
    return NextResponse.json({ error: "צריך שם פרטי, שם משפחה ומספר טלפון תקין. חזרו למסך הכניסה. / يجب الاسم الشخصي واسم العائلة ورقم هاتف صحيح." }, { status: 400 });
  }
  if (!GENDERS.includes(body.gender as Gender)) {
    return NextResponse.json({ error: "צריך לבחור איך לפנות אליך: בן או בת" }, { status: 400 });
  }
  const gender = body.gender as Gender;
  if (nickname.length > 61) {
    return NextResponse.json({ error: "השם ארוך מדי (עד 30 תווים)" }, { status: 400 });
  }

  const task = await getTask(taskId);
  if (!task) return NextResponse.json({ error: "המשימה לא נמצאה" }, { status: 404 });

  const db = supabaseAdmin();

  // Accept the code even if O/0 or I/1 were mixed up (DEMO1 vs DEM01).
  const variants = [...new Set([classCode, classCode.replace(/0/g, "O"), classCode.replace(/O/g, "0"), classCode.replace(/I/g, "1"), classCode.replace(/1/g, "I")])];
  const { data: matches } = await db.from("classes").select("id, code").in("code", variants);
  const cls = matches?.find((c) => c.code === classCode) ?? matches?.[0] ?? null;
  if (!cls) return NextResponse.json({ error: "קוד הכיתה לא נמצא" }, { status: 404 });

  // Budget limits: number of students in the system, conversations per student per task.
  const limits = await getLimits();
  const ar = lang === "ar";
  // The phone is the student's identity in the class: the same phone = the same student.
  const { data: existing } = await db.from("students").select("id").eq("class_id", cls.id).eq("phone", phone).maybeSingle();
  if (!existing) {
    const { count } = await db.from("students").select("id", { count: "exact", head: true });
    if ((count ?? 0) >= limits.maxStudents) {
      return NextResponse.json(
        { error: ar ? "وصل الموقع إلى الحد الأقصى من الطلاب في التجربة الحالية. أخبر/ي المعلّم/ة." : "האתר הגיע למספר התלמידים המרבי בניסוי הנוכחי. ספר/י למורה." },
        { status: 403 },
      );
    }
  } else {
    const { count } = await db.from("sessions").select("id", { count: "exact", head: true }).eq("student_id", existing.id).eq("task_id", task.id);
    if ((count ?? 0) >= limits.maxSessionsPerTask) {
      return NextResponse.json(
        { error: ar ? `بدأت هذه المهمة ${limits.maxSessionsPerTask} مرات بالفعل. أخبر/ي المعلّم/ة.` : `כבר התחלת את המשימה הזו ${limits.maxSessionsPerTask} פעמים. ספר/י למורה.` },
        { status: 429 },
      );
    }
  }

  let student: { id: string } | null = null;
  let stuErr: { message: string } | null = null;
  if (existing) {
    // Same phone: same student. Keep the names up to date (staff may have set a display name separately).
    await db.from("students").update({ first_name: firstName, last_name: lastName, nickname }).eq("id", existing.id);
    student = existing;
  } else {
    ({ data: student, error: stuErr } = await db
      .from("students")
      .insert({ class_id: cls.id, nickname, first_name: firstName, last_name: lastName, phone })
      .select("id")
      .single());
    if (stuErr && /column|schema cache/i.test(stuErr.message)) {
      stuErr = { message: "Database update needed: run supabase/migration_007_identity.sql" };
    } else if (stuErr && /duplicate|unique/i.test(stuErr.message)) {
      stuErr = { message: "Database update needed: run supabase/migration_007_identity.sql (two students with the same name)" };
    }
  }
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
