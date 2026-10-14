// GET /api/health — checks the database, the secrets and which Claude models this account can use.
// Open it in the browser after deploying; it never shows secret values.
import { candidates, llm, model, PROVIDER, tryModel } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase";
import { analyzeMessage } from "@/lib/analyzer";
import { getTask } from "@/lib/taskStore";

export const maxDuration = 60;

export async function GET(req: Request) {
  const t = Date.now();
  // ?author=1 — check the task-writing agent's call (forced tool use on the tutor model) with a tiny budget.
  if (new URL(req.url).searchParams.get("author") === "1") {
    const out: Record<string, unknown> = {};
    try {
      out.model = await model("tutor");
      const r = await llm().messages.create(
        {
          model: out.model as string,
          max_tokens: 2000,
          tools: [{ name: "record_task", description: "x", input_schema: { type: "object", properties: { note_to_author: { type: "string" }, givens: { type: "object", additionalProperties: { type: "number" } } }, required: ["note_to_author"] } }],
          tool_choice: { type: "auto" },
          messages: [{ role: "user", content: "Call the record_task tool with note_to_author = 'ok'. Do not answer in text." }],
        },
        { timeout: 30_000 },
      );
      out.forced_tool = { ok: true, stop_reason: r.stop_reason, blocks: r.content.map((b) => b.type) };
    } catch (e) {
      out.forced_tool = { ok: false, error: e instanceof Error ? e.message.slice(0, 600) : String(e) };
    }
    try {
      const { data, error } = await supabaseAdmin().storage.listBuckets();
      out.storage = error ? { ok: false, error: error.message } : { ok: true, buckets: (data ?? []).map((b) => `${b.name}${b.public ? " (public)" : ""}`) };
    } catch (e) {
      out.storage = { ok: false, error: String(e) };
    }
    try {
      const { error } = await supabaseAdmin().from("tasks").select("id").limit(1);
      out.tasks_table = error ? { ok: false, error: error.message } : { ok: true };
    } catch (e) {
      out.tasks_table = { ok: false, error: String(e) };
    }
    out.ms = Date.now() - t;
    return Response.json(out, { headers: { "Cache-Control": "no-store" } });
  }
  // ?analyzer=1 — also run the analyzer on one sample message (checks the research team's rules end to end).
  if (new URL(req.url).searchParams.get("analyzer") === "1") {
    const task = await getTask("speedometer");
    const sample = "אני חושב שצריך לחלק את 38,400 במספר השיניים בגלגל כדי לקבל סיבובים בדקה, אבל לא כתוב כמה שיניים יש";
    const result = task
      ? await analyzeMessage({ task, guidedPhaseId: "understanding", recent: [], message: sample, wordCount: 18, responseMs: 30000 })
      : null;
    return Response.json({ ok: !!result, sample, result, ms: Date.now() - t }, { headers: { "Cache-Control": "no-store" } });
  }
  const database = await supabaseAdmin()
    .from("classes")
    .select("id", { count: "exact", head: true })
    .then(({ count, error }) => (error ? { ok: false, detail: error.message } : { ok: true, detail: `${count ?? 0} classes` }));

  const secrets =
    !process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16
      ? { ok: false, detail: "AUTH_SECRET missing or shorter than 16 characters" }
      : !process.env.ADMIN_SECRET
        ? { ok: false, detail: "ADMIN_SECRET missing" }
        : { ok: true, detail: "set" };

  const ids = [...new Set([...candidates("tutor"), ...candidates("analyzer")])];
  const results = await Promise.all(ids.map(async (id) => ({ model: id, ...(await tryModel(id)) })));
  const works = (role: "tutor" | "analyzer") => candidates(role).find((id) => results.find((r) => r.model === id)?.ok) ?? null;
  const tutor = works("tutor");
  const analyzer = works("analyzer");

  return Response.json(
    {
      ok: database.ok && secrets.ok && !!tutor && !!analyzer,
      provider: PROVIDER,
      region: process.env.AWS_REGION ?? null,
      tutor_model: tutor ?? "NONE AVAILABLE",
      analyzer_model: analyzer ?? "NONE AVAILABLE",
      database,
      secrets,
      models_tried: results.map((r) => (r.ok ? { model: r.model, ok: true } : { model: r.model, ok: false, error: r.error.slice(0, 300) })),
      ms: Date.now() - t,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
