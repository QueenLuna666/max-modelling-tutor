// GET /api/staff/usage — budget usage (students, conversations, messages, tokens by agent) and the limits.
// PUT /api/staff/usage — save the limits. Researchers and admins only.
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase";
import { getLimits, normalizeLimits, saveLimits } from "@/lib/limits";

type Row = { kind: string; at: string; input_tokens: number | null; output_tokens: number | null; cache_read_tokens: number | null; cache_write_tokens: number | null };

export async function GET() {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  if (!isResearcher(staff)) return forbidden();
  const db = supabaseAdmin();
  const students = (await db.from("students").select("id", { count: "exact", head: true })).count ?? 0;
  const sessions = (await db.from("sessions").select("id", { count: "exact", head: true })).count ?? 0;
  const studentMessages = (await db.from("messages").select("id", { count: "exact", head: true }).eq("role", "student")).count ?? 0;

  let rows: Row[] = [];
  let logReady = true;
  try {
    const { data, error } = await db.from("usage_log").select("kind, at, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens").order("at", { ascending: false }).limit(20000);
    if (error) logReady = false;
    rows = (data as Row[]) ?? [];
  } catch {
    logReady = false;
  }
  const since = new Date();
  since.setUTCHours(0, 0, 0, 0);
  const byKind: Record<string, { calls: number; input: number; output: number; cacheRead: number; cacheWrite: number; today: number }> = {};
  for (const r of rows) {
    const k = (byKind[r.kind] ??= { calls: 0, input: 0, output: 0, cacheRead: 0, cacheWrite: 0, today: 0 });
    k.calls += 1;
    k.input += r.input_tokens ?? 0;
    k.output += r.output_tokens ?? 0;
    k.cacheRead += r.cache_read_tokens ?? 0;
    k.cacheWrite += r.cache_write_tokens ?? 0;
    if (new Date(r.at) >= since) k.today += 1;
  }
  return Response.json({ students, sessions, studentMessages, byKind, logReady, limits: await getLimits() });
}

export async function PUT(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  if (!isResearcher(staff)) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { limits?: unknown };
  try {
    const limits = normalizeLimits(body.limits);
    await saveLimits(limits);
    return Response.json({ limits });
  } catch (e) {
    const msg = (e as Error).message;
    return Response.json({ error: /app_settings/.test(msg) ? "צריך להריץ את migration_006_limits.sql ב-Supabase" : msg }, { status: 500 });
  }
}
