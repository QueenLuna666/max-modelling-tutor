// GET /api/health — checks the database, the secrets and which Claude models this account can use.
// Open it in the browser after deploying; it never shows secret values.
import { candidates, PROVIDER, tryModel } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 60;

export async function GET() {
  const t = Date.now();
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
