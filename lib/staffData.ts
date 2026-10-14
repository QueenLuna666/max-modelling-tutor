// Server-side queries for the teacher / researcher pages.
import "server-only";
import { supabaseAdmin } from "./supabase";
import { canSeeClass, isResearcher, type StaffSession } from "./auth";
import { t, type Lang } from "./tasks";
import { getTask, getTasks } from "./taskStore";
import { normalizeSettings } from "./classSettings";
import { codeLabels } from "./framework";
import { sessionMetrics, type SessionMetrics } from "./metrics";
import {
  buildJourney,
  sessionAlerts,
  strongestHints,
  type AnnotationRow,
  type MessageRow,
} from "./insights";

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

// Supabase returns at most 1000 rows per request; page through bigger results.
async function fetchAll<T>(build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

const MSG_COLS = "id, session_id, role, content, phase, word_count, response_ms, hint_level, scaffold_type, move, created_at";
// "*" so the pages keep working before and after the skills column is added.
const ANN_COLS = "*";

type StudentRow = { id: string; class_id: string; nickname: string; display_name?: string | null; excluded?: boolean | null };
// The name staff see: the edited name if someone set one, otherwise the name the student typed.
export function displayName(s: { nickname: string; display_name?: string | null } | undefined | null): string {
  return s ? (s.display_name?.trim() || s.nickname) : "?";
}

type ClassRow = { id: string; code: string; name: string | null; teacher_id: string | null; created_at: string; settings?: unknown };

export async function listClasses(staff: StaffSession) {
  const db = supabaseAdmin();
  let q = db.from("classes").select("id, code, name, teacher_id, created_at").order("created_at", { ascending: false });
  if (!isResearcher(staff)) q = q.eq("teacher_id", staff.id);
  const { data: classes, error } = await q;
  if (error) throw new Error(error.message);

  const ids = (classes ?? []).map((c) => c.id);
  const { data: students } = ids.length
    ? await db.from("students").select("id, class_id").in("class_id", ids)
    : { data: [] as { id: string; class_id: string }[] };
  const studentIds = (students ?? []).map((s) => s.id);
  const { data: sessions } = studentIds.length
    ? await db.from("sessions").select("student_id, status").in("student_id", studentIds)
    : { data: [] as { student_id: string; status: string }[] };

  const { data: teachers } = await db.from("staff").select("id, name").eq("role", "teacher");
  const teacherName = new Map((teachers ?? []).map((t) => [t.id, t.name]));
  const classOf = new Map((students ?? []).map((s) => [s.id, s.class_id]));

  return (classes ?? []).map((c: ClassRow) => {
    const mine = (sessions ?? []).filter((s) => classOf.get(s.student_id) === c.id);
    return {
      id: c.id,
      code: c.code,
      name: c.name,
      teacher: c.teacher_id ? (teacherName.get(c.teacher_id) ?? null) : null,
      students: (students ?? []).filter((s) => s.class_id === c.id).length,
      sessions: mine.length,
      active: mine.filter((s) => s.status === "active").length,
    };
  });
}

async function loadClass(staff: StaffSession, classId: string) {
  const { data: cls } = await supabaseAdmin()
    .from("classes")
    .select("*") // "*" so it still works before migration_003 adds "settings"
    .eq("id", classId)
    .maybeSingle();
  if (!cls) return { error: 404 as const };
  if (!canSeeClass(staff, cls)) return { error: 403 as const };
  return { cls: cls as ClassRow };
}

export async function classDashboard(staff: StaffSession, classId: string) {
  const loaded = await loadClass(staff, classId);
  if ("error" in loaded) return loaded;
  const { cls } = loaded;
  const db = supabaseAdmin();

  const { data: studentRows } = await db.from("students").select("*").eq("class_id", cls.id);
  const students = (studentRows ?? []) as StudentRow[];
  const studentIds = students.map((s) => s.id);
  const byStudent = new Map(students.map((s) => [s.id, s]));
  const researcherView = isResearcher(staff);

  const sessions = studentIds.length
    ? await fetchAll<{
        id: string;
        student_id: string;
        task_id: string;
        lang: string;
        gender: string;
        status: string;
        current_phase: string;
        started_at: string;
        ended_at: string | null;
      }>((from, to) =>
        db
          .from("sessions")
          .select("id, student_id, task_id, lang, gender, status, current_phase, started_at, ended_at")
          .in("student_id", studentIds)
          .order("started_at", { ascending: false })
          .range(from, to),
      )
    : [];
  const sessionIds = sessions.map((s) => s.id);

  const messages = sessionIds.length
    ? await fetchAll<MessageRow & { session_id: string }>((from, to) =>
        db
          .from("messages")
          .select(MSG_COLS)
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
          .range(from, to),
      )
    : [];
  const annotations = sessionIds.length
    ? await fetchAll<AnnotationRow & { session_id: string }>((from, to) =>
        db
          .from("annotations")
          .select(ANN_COLS)
          .in("session_id", sessionIds)
          .order("created_at", { ascending: true })
          .range(from, to),
      )
    : [];

  const tasks = new Map<string, { id: string; title: string; phases: { id: string; label: string }[] }>();
  const taskById = await getTasks(sessions.map((s) => s.task_id));
  const rows = sessions.map((s) => {
    const task = taskById[s.task_id] ?? null;
    const phaseIds = task?.phases.map((p) => p.id) ?? [];
    if (task && !tasks.has(task.id)) {
      tasks.set(task.id, {
        id: task.id,
        title: t(task.title, "he"),
        phases: task.phases.map((p) => ({ id: p.id, label: t(p.label, "he") })),
      });
    }
    const msgs = messages.filter((m) => m.session_id === s.id);
    const anns = annotations.filter((a) => a.session_id === s.id);
    const journey = buildJourney(phaseIds, msgs, anns);
    const last = msgs[msgs.length - 1];
    return {
      sessionId: s.id,
      studentId: s.student_id,
      nickname: displayName(byStudent.get(s.student_id)),
      excluded: byStudent.get(s.student_id)?.excluded === true,
      taskId: s.task_id,
      lang: s.lang as Lang,
      gender: s.gender,
      // The student's overall pattern so far (research coding) — researchers only.
      pattern: researcherView ? ([...anns].reverse().find((a) => a.student_pattern)?.student_pattern ?? null) : null,
      status: s.status,
      currentPhase: s.current_phase,
      startedAt: s.started_at,
      lastActivity: last?.created_at ?? s.started_at,
      studentMessages: msgs.filter((m) => m.role === "student").length,
      visits: journey.visits,
      perPhase: journey.messages,
      backMoves: journey.backMoves.length,
      furthestIndex: journey.furthestIndex,
      hints: strongestHints(msgs),
      alerts: sessionAlerts(s.status, msgs, anns, phaseIds[phaseIds.length - 1] ?? ""),
    };
  });

  return {
    class: { id: cls.id, code: cls.code, name: cls.name },
    settings: normalizeSettings(cls.settings),
    tasks: [...tasks.values()],
    students: students.map((s) => ({ id: s.id, nickname: displayName(s), loginName: s.nickname, displayName: s.display_name ?? null, excluded: s.excluded === true })),
    sessions: rows,
  };
}

export async function sessionDetail(staff: StaffSession, sessionId: string) {
  const db = supabaseAdmin();
  const { data: s } = await db
    .from("sessions")
    .select("id, student_id, task_id, lang, gender, status, current_phase, started_at, ended_at, summary")
    .eq("id", sessionId)
    .maybeSingle();
  if (!s) return { error: 404 as const };
  const { data: studentRow } = await db.from("students").select("*").eq("id", s.student_id).single();
  const student = studentRow ? { ...(studentRow as StudentRow), nickname: displayName(studentRow as StudentRow) } : null;
  if (!student) return { error: 404 as const };
  const loaded = await loadClass(staff, student.class_id);
  if ("error" in loaded) return loaded;

  const task = await getTask(s.task_id);
  const phaseIds = task?.phases.map((p) => p.id) ?? [];
  const messages = await fetchAll<MessageRow>((from, to) =>
    db.from("messages").select(MSG_COLS).eq("session_id", s.id).order("created_at", { ascending: true }).range(from, to),
  );
  const annotations = await fetchAll<AnnotationRow>((from, to) =>
    db.from("annotations").select(ANN_COLS).eq("session_id", s.id).order("created_at", { ascending: true }).range(from, to),
  );
  const researcher = isResearcher(staff);
  const byMsg = new Map(annotations.map((a) => [a.message_id, a]));
  const journey = buildJourney(phaseIds, messages, annotations);
  const metrics = sessionMetrics(phaseIds, messages, annotations);

  // Other sessions of the same student, for navigation.
  const { data: siblings } = await db
    .from("sessions")
    .select("id, task_id, status, started_at")
    .eq("student_id", student.id)
    .order("started_at", { ascending: false });
  const siblingTasks = await getTasks((siblings ?? []).map((x) => x.task_id));

  return {
    researcher,
    class: { id: loaded.cls.id, code: loaded.cls.code, name: loaded.cls.name },
    student: { id: student.id, nickname: student.nickname },
    session: {
      id: s.id,
      taskId: s.task_id,
      taskTitle: task ? t(task.title, "he") : s.task_id,
      lang: s.lang,
      gender: s.gender,
      status: s.status,
      currentPhase: s.current_phase,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      summary: savedSummary(s.summary as string | null, researcher),
    },
    phases: task?.phases.map((p) => ({ id: p.id, label: t(p.label, "he") })) ?? [],
    challengeLabels: researcher ? codeLabels() : {},
    journey: researcher ? journey : { ...journey, points: journey.points.map((p) => ({ ...p, performance: null, level: null })) },
    metrics: researcher ? metrics : teacherMetrics(metrics),
    alerts: sessionAlerts(s.status, messages, annotations, phaseIds[phaseIds.length - 1] ?? ""),
    messages: messages.map((m) => {
      const a = m.role === "student" ? byMsg.get(m.id) : undefined;
      return {
        id: m.id,
        role: m.role,
        content: m.content,
        createdAt: m.created_at,
        phase: a?.phase ?? m.phase,
        // Analysis fields — researchers only.
        ...(researcher
          ? {
              wordCount: m.word_count,
              responseMs: m.response_ms,
              hintLevel: m.hint_level,
              scaffoldType: m.scaffold_type,
              move: m.move,
              analysis: a
                ? {
                    performance: a.performance,
                    level: a.level ?? null,
                    studentPattern: a.student_pattern ?? null,
                    phases: a.phases ?? [],
                    motivation: a.motivation,
                    challenge: a.challenge,
                    skills: a.skills ?? [],
                    evidence: a.evidence,
                    asksForAnswer: a.asks_for_answer,
                    phaseComplete: a.phase_complete,
                  }
                : null,
            }
          : {}),
      };
    }),
    siblings: (siblings ?? []).map((x) => ({
      id: x.id,
      taskTitle: siblingTasks[x.task_id] ? t(siblingTasks[x.task_id].title, "he") : x.task_id,
      status: x.status,
      startedAt: x.started_at,
    })),
  };
}

// Everything a researcher needs about a class or one session: per-session info, metrics,
// per-phase metrics and the coded conversation. Researchers only. Formatted by lib/exportFile.ts.
export type ExportSession = {
  sessionId: string;
  classCode: string;
  name: string;
  taskId: string;
  taskTitle: string;
  lang: string;
  gender: string;
  status: string;
  startedAt: string;
  endedAt: string | null;
  phases: { id: string; label: string }[];
  metrics: SessionMetrics;
  journey: { index: number; phase: string; back: boolean; at: string }[];
  messages: (MessageRow & { analysis: AnnotationRow | null })[];
};

// Students staff hid from results ("excluded") are left out of class-level and all-class data.
export async function exportData(staff: StaffSession, filter: { classId?: string; sessionId?: string; all?: boolean }) {
  if (!isResearcher(staff)) return { error: 403 as const };
  const db = supabaseAdmin();

  let sessionIds: string[] = [];
  let classCode = "";
  if (filter.sessionId) {
    sessionIds = [filter.sessionId];
  } else if (filter.classId) {
    const { data: cls } = await db.from("classes").select("id, code").eq("id", filter.classId).maybeSingle();
    if (!cls) return { error: 404 as const };
    classCode = cls.code;
    const { data: students } = await db.from("students").select("*").eq("class_id", cls.id);
    const ids = ((students ?? []) as StudentRow[]).filter((s) => !s.excluded).map((s) => s.id);
    const { data: ss } = ids.length
      ? await db.from("sessions").select("id").in("student_id", ids)
      : { data: [] as { id: string }[] };
    sessionIds = (ss ?? []).map((s) => s.id);
  } else if (filter.all) {
    classCode = "all";
    const { data: students } = await db.from("students").select("*");
    const ids = ((students ?? []) as StudentRow[]).filter((s) => !s.excluded).map((s) => s.id);
    const { data: ss } = ids.length ? await db.from("sessions").select("id").in("student_id", ids) : { data: [] as { id: string }[] };
    sessionIds = (ss ?? []).map((s) => s.id);
  } else {
    return { error: 400 as const };
  }
  if (!sessionIds.length) return { sessions: [] as ExportSession[], name: classCode || "export" };

  const { data: sessions } = await db
    .from("sessions")
    .select("id, task_id, lang, gender, status, started_at, ended_at, students(*, classes(code))")
    .in("id", sessionIds)
    .order("started_at", { ascending: true });
  const messages = await fetchAll<MessageRow & { session_id: string }>((from, to) =>
    db.from("messages").select(MSG_COLS).in("session_id", sessionIds).order("created_at", { ascending: true }).range(from, to),
  );
  const annotations = await fetchAll<AnnotationRow & { session_id: string }>((from, to) =>
    db.from("annotations").select(ANN_COLS).in("session_id", sessionIds).order("created_at", { ascending: true }).range(from, to),
  );

  const taskById = await getTasks((sessions ?? []).map((s) => s.task_id));
  const out: ExportSession[] = (sessions ?? []).map((s) => {
    // Supabase types nested selects loosely; read them defensively.
    const st = s.students as unknown as (StudentRow & { classes?: { code?: string } }) | null;
    const task = taskById[s.task_id] ?? null;
    const phaseIds = task?.phases.map((p) => p.id) ?? [];
    const msgs = messages.filter((m) => m.session_id === s.id);
    const anns = annotations.filter((a) => a.session_id === s.id);
    const byMsg = new Map(anns.map((a) => [a.message_id, a]));
    const journey = buildJourney(phaseIds, msgs, anns);
    return {
      sessionId: s.id,
      classCode: st?.classes?.code ?? classCode,
      name: st ? displayName(st) : "",
      taskId: s.task_id,
      taskTitle: task ? t(task.title, "he") : s.task_id,
      lang: s.lang,
      gender: s.gender,
      status: s.status,
      startedAt: s.started_at,
      endedAt: s.ended_at,
      phases: task?.phases.map((p) => ({ id: p.id, label: t(p.label, "he") })) ?? [],
      metrics: sessionMetrics(phaseIds, msgs, anns),
      journey: journey.points.map((p) => ({ index: p.index, phase: p.phase, back: p.back, at: p.at })),
      messages: msgs.map((m) => ({ ...m, analysis: m.role === "student" ? (byMsg.get(m.id) ?? null) : null })),
    };
  });
  const first = out[0];
  return {
    sessions: out,
    name: filter.sessionId && first ? `${first.name}-${first.sessionId.slice(0, 8)}` : `class-${classCode}`,
  };
}

// What teachers see: activity and progress, without the lab's coding (performance, motivation,
// difficulty and skill codes) that the research team keeps to itself.
function teacherMetrics(m: ReturnType<typeof sessionMetrics>) {
  return {
    studentMessages: m.studentMessages,
    minutesTotal: m.minutesTotal,
    avgWords: m.avgWords,
    avgResponseSec: m.avgResponseSec,
    backMoves: m.backMoves,
    furthestPhase: m.furthestPhase,
    phasesCompleted: m.phasesCompleted,
    hints: m.hints,
    perPhase: m.perPhase.map((p) => ({
      phase: p.phase,
      visits: p.visits,
      studentMessages: p.studentMessages,
      minutes: p.minutes,
      hints: p.hints,
      completed: p.completed,
    })),
  };
}

// Summaries are saved with the audience they were written for ("[teacher]" / "[researcher]").
function savedSummary(raw: string | null, researcher: boolean): string | null {
  if (!raw) return null;
  const m = raw.match(/^\[(teacher|researcher)\]\n/);
  if (!m) return researcher ? raw : null;
  return (m[1] === "researcher") === researcher ? raw.slice(m[0].length) : null;
}
