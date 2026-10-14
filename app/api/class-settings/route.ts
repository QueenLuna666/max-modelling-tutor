// GET /api/class-settings?code=DEMO1 — which student features are on in this class.
import { supabaseAdmin } from "@/lib/supabase";
import { codeVariants, normalizeSettings } from "@/lib/classSettings";

export async function GET(req: Request) {
  const code = new URL(req.url).searchParams.get("code");
  let raw: unknown = null;
  if (code) {
    try {
      const { data } = await supabaseAdmin().from("classes").select("*").in("code", codeVariants(code)).limit(1);
      raw = data?.[0]?.settings ?? null;
    } catch {}
  }
  const s = normalizeSettings(raw);
  return Response.json({ features: s.features });
}
