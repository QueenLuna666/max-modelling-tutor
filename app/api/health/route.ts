// GET /api/health — checks that the site can reach Claude and the database.
// Open it in the browser after deploying; it never shows secret values.
import { llm, PROVIDER, TUTOR_MODEL, ANALYZER_MODEL } from "@/lib/llm";
import { supabaseAdmin } from "@/lib/supabase";

export const maxDuration = 30;

async function check(name: string, fn: () => Promise<string>) {
  const t = Date.now();
  try {
    return { name, ok: true, detail: await fn(), ms: Date.now() - t };
  } catch (e) {
    return { name, ok: false, detail: e instanceof Error ? e.message : String(e), ms: Date.now() - t };
  }
}

async function ping(model: string) {
  const r = await llm().messages.create({ model, max_tokens: 5, messages: [{ role: "user", content: "Say OK" }] }, { timeout: 20_000 });
  const text = r.content.find((b) => b.type === "text");
  return text && text.type === "text" ? `answered: ${text.text}` : "answered";
}

export async function GET() {
  const results = await Promise.all([
    check("database", async () => {
      const { count, error } = await supabaseAdmin().from("classes").select("id", { count: "exact", head: true });
      if (error) throw new Error(error.message);
      return `${count ?? 0} classes`;
    }),
    check(`tutor (${TUTOR_MODEL})`, () => ping(TUTOR_MODEL)),
    check(`analyzer (${ANALYZER_MODEL})`, () => ping(ANALYZER_MODEL)),
    check("auth secrets", async () => {
      if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) throw new Error("AUTH_SECRET missing or shorter than 16 characters");
      if (!process.env.ADMIN_SECRET) throw new Error("ADMIN_SECRET missing");
      return "set";
    }),
  ]);
  return Response.json(
    { provider: PROVIDER, region: process.env.AWS_REGION ?? null, ok: results.every((r) => r.ok), checks: results },
    { headers: { "Cache-Control": "no-store" } },
  );
}
