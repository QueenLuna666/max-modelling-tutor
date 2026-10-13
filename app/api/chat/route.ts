// POST /api/chat — one student turn:
//   save message → analyzer codes it → decide hint level → MAX answers (streamed) → save reply.
// Body: { sessionId: string, content: string, responseMs?: number }
// Response: text/plain stream. Header X-Phase = the step MAX is guiding after this turn.
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "@/lib/supabase";
import { getTask, nextPhaseId, type Gender, type Lang } from "@/lib/tasks";
import { buildSystemPrompt, loadBasePrompt } from "@/lib/buildPrompt";
import { planResponse, type Plan } from "@/lib/policy";
import { analyzeMessage, ANALYZER_MODEL } from "@/lib/analyzer";

export const maxDuration = 60;

let anthropic: Anthropic | null = null; // created on first request; reads ANTHROPIC_API_KEY
const TUTOR_MODEL = process.env.TUTOR_MODEL ?? "claude-sonnet-5-5";
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
    .select("id, task_id, lang, gender, current_phase, phase_attempts, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (!session) return Response.json({ error: "Session not found" }, { status: 404 });
  if (session.status !== "active") return Response.json({ error: "המשימה כבר הסתיימה" }, { status: 409 });

  const task = getTask(session.task_id);
  if (!task) return Response.json({ error: "Task not found" }, { status: 404 });

  // Conversation before this message (for the analyzer and for MAX).
  const { data: recentDesc } = await db
    .from("messages")
    .select("role, content")
    .eq("session_id", session.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);
  const before = (recentDesc ?? []).reverse();

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
    await db.from("annotations").insert({
      message_id: saved.id,
      session_id: session.id,
      ...analysis,
      lang: session.lang,
      model: ANALYZER_MODEL,
    });
  }

  // 3. Decide the response plan and whether MAX moves to the next step.
  let phaseId: string = session.current_phase;
  let phaseAttempts: number = session.phase_attempts + 1;
  let plan: Plan | null = null;

  if (analysis) {
    plan = planResponse({
      performance: analysis.performance,
      motivation: analysis.motivation,
      asksForAnswer: analysis.asks_for_answer,
      phaseComplete: analysis.phase_complete,
      phaseAttempts,
    });
    if (analysis.phase_complete) {
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
  });

  // 5. Stream MAX's reply to the browser, then save it.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        anthropic ??= new Anthropic();
        const res = anthropic.messages.stream({ model: TUTOR_MODEL, max_tokens: 500, system, messages });
        for await (const event of res) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            full += event.delta.text;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
      } catch (err) {
        console.error("MAX stream failed", err);
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
