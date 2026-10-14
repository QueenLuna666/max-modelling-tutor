// POST /api/chat — one student turn:
//   save message → analyzer codes it → decide hint level → MAX answers (streamed) → save reply.
// Body: { sessionId: string, content: string, responseMs?: number }
// Response: text/plain stream. Header X-Phase = the step MAX is guiding after this turn.
import { supabaseAdmin } from "@/lib/supabase";
import { nextPhaseId, type Gender, type HintLevel, type Lang } from "@/lib/tasks";
import { getTask } from "@/lib/taskStore";
import { buildSystemPrompt, loadBasePrompt } from "@/lib/buildPrompt";
import { planResponse, type Plan } from "@/lib/policy";
import { analyzeMessage } from "@/lib/analyzer";
import { llm, model } from "@/lib/llm";
import { normalizeSettings } from "@/lib/classSettings";
import { withoutDrawings } from "@/lib/messageFormat";

export const maxDuration = 60;

const HISTORY_LIMIT = 30;

type Turn = { role: "user" | "assistant"; content: string };

// The API wants user/assistant turns that alternate and start with "user".
function toApiMessages(rows: { role: string; content: string }[]): Turn[] {
  const out: Turn[] = [];
  for (const r of rows) {
    const role = r.role === "student" ? "user" : "assistant";
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += "\n\n" + r.content;
    else out.push({ role, content: r.content });
  }
  if (out[0]?.role === "assistant") out.unshift({ role: "user", content: "(The student opened the task.)" });
  return out;
}

export async function POST(req: Request) {
  let body: { sessionId?: string; content?: string; responseMs?: number };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  const sessionId = body.sessionId;
  const content = body.content?.trim();
  if (!sessionId || !content) return Response.json({ error: "Missing sessionId or content" }, { status: 400 });
  if (content.length > 4000) return Response.json({ error: "ההודעה ארוכה מדי" }, { status: 400 });

  const db = supabaseAdmin();

  const { data: session } = await db
    .from("sessions")
    .select("id, task_id, lang, gender, current_phase, phase_attempts, status, student_id")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") return Response.json({ error: "המשימה כבר הסתיימה" }, { status: 409 });

  const task = await getTask(session.task_id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  // The class's settings (hint ceiling). Missing column/table → defaults.
  let settings = normalizeSettings(null);
  try {
    const { data: stu } = await db.from("students").select("class_id").eq("id", session.student_id).maybeSingle();
    if (stu) {
      const { data: cls } = await db.from("classes").select("*").eq("id", stu.class_id).maybeSingle();
      settings = normalizeSettings(cls?.settings);
    }
  } catch {}

  // Conversation before this message (for the analyzer and for MAX).
  const { data: recentDesc } = await db
    .from("messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  // MAX's drawings are long SVG code: in the history, keep only a note that a drawing was shown.
  const before = (recentDesc ?? []).reverse().map((r) => ({ ...r, content: withoutDrawings(r.content, "\n(a drawing was shown here)\n") }));

  // 1. Save the student's message first, so nothing is lost even if a model call fails.
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const responseMs = typeof body.responseMs === "number" ? Math.round(body.responseMs) : null;
  const { data: saved, error: insErr } = await db
    .from("messages")
    .insert({
      session_id: session.id,
      role: "student",
      content,
      phase: session.current_phase,
      word_count: wordCount,
      response_ms: responseMs,
    })
    .select("id")
    .single();
  if (insErr || !saved) return Response.json({ error: insErr?.message ?? "Save failed" }, { status: 500 });

  // 2. The analyzer codes the message.
  const analysis = await analyzeMessage({
    task,
    guidedPhaseId: session.current_phase,
    recent: before.slice(-8),
    message: content,
    wordCount,
    responseMs,
  });
  if (analysis) {
    // Save the coding. If the database was not migrated yet, drop the newest columns and try again
    // (005: signals → 004: phases, level, student_pattern → 002: skills).
    const full: Record<string, unknown> = { message_id: saved.id, session_id: session.id, ...analysis, lang: session.lang };
    const steps = [[], ["signals"], ["signals", "phases", "level", "student_pattern"], ["signals", "phases", "level", "student_pattern", "skills"]];
    for (const drop of steps) {
      const row = Object.fromEntries(Object.entries(full).filter(([k]) => !drop.includes(k)));
      const { error } = await db.from("annotations").insert(row);
      if (!error) break;
      console.warn(`Saving annotation without [${drop.join(", ")}] failed:`, error.message);
    }
  }

  // 3. Decide the response plan (research team's hint guidelines). No gates between phases:
  //    MAX follows the phase the student is actually working in; a completed guided phase moves on.
  const { data: lastTutor } = await db
    .from("messages")
    .select("move, hint_level, phase")
    .eq("session_id", session.id)
    .eq("role", "tutor")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let phaseId: string = session.current_phase;
  let phaseAttempts: number = session.phase_attempts + 1;
  let plan: Plan | null = null;

  if (analysis) {
    const focus = analysis.phase ?? session.current_phase;
    const sameFocus = focus === (lastTutor?.phase ?? session.current_phase);
    // The level in the aspect discussed now; with no evidence in this message, the student's overall pattern.
    const level = analysis.level !== "insufficient_evidence" ? analysis.level : analysis.student_pattern;
    const prevHint = sameFocus && lastTutor?.hint_level && lastTutor.hint_level !== "none" ? (lastTutor.hint_level as HintLevel) : null;
    plan = planResponse({
      level,
      signals: analysis.signals,
      asksForAnswer: analysis.asks_for_answer,
      previousHint: prevHint,
      previousMove: lastTutor?.move ?? null,
      noPhase: !analysis.phase,
      maxHint: settings.maxHint,
    });
    if (analysis.phase && analysis.phase !== phaseId) {
      phaseId = analysis.phase; // follow the student (non-linear)
      phaseAttempts = 1;
    } else if (analysis.phase_complete) {
      const next = nextPhaseId(task, phaseId);
      if (next) {
        phaseId = next;
        phaseAttempts = 0;
      }
    }
  }

  await db
    .from("sessions")
    .update({ current_phase: phaseId, phase_attempts: phaseAttempts, last_hint_level: plan?.hintLevel ?? null })
    .eq("id", session.id);

  // 4. Build MAX's prompt.
  const messages = toApiMessages([...before, { role: "student", content }]);
  const system = buildSystemPrompt({
    base: await loadBasePrompt(),
    task,
    lang: session.lang as Lang,
    gender: session.gender as Gender,
    phaseId,
    phaseAttempts,
    plan,
    analysis,
  });

  // 5. Stream MAX's reply to the browser, then save it.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        const tutorModel = await model("tutor");
        try {
          // Generous budget: the model may think before answering, and thinking counts toward max_tokens.
          const res = llm().messages.stream({ model: tutorModel, max_tokens: 6000, system, messages });
          for await (const event of res) {
            if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
              full += event.delta.text;
              controller.enqueue(encoder.encode(event.delta.text));
            }
          }
          const final = await res.finalMessage();
          if (final.stop_reason !== "end_turn") console.warn("MAX reply stopped early:", final.stop_reason);
        } catch (streamErr) {
          if (full) throw streamErr;
          // Some Bedrock accounts may not allow streaming: ask once without it.
          console.warn("Streaming failed, retrying without streaming", streamErr);
          const res = await llm().messages.create({ model: tutorModel, max_tokens: 6000, system, messages });
          const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
          full = text;
          controller.enqueue(encoder.encode(text));
        }
      } catch (err) {
        console.error("MAX failed", err);
        const fallback = session.lang === "ar" ? "\n\n(حدث خطأ عندي. حاول/ي الإرسال مرة أخرى.)" : "\n\n(משהו השתבש אצלי. נסה/י לשלוח שוב.)";
        full += fallback;
        controller.enqueue(encoder.encode(fallback));
      }
      await db.from("messages").insert({
        session_id: session.id,
        role: "tutor",
        content: full,
        phase: phaseId,
        hint_level: plan?.hintLevel ?? null,
        scaffold_type: plan?.scaffoldType ?? null,
        move: plan?.move ?? null,
      });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Phase": phaseId,
    },
  });
}
