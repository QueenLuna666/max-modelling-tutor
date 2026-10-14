// Budget limits (sponsored agent budget). Stored in app_settings('limits'); researchers change them
// on the Usage page without code. Defaults below are used until someone saves other values.
import "server-only";
import { supabaseAdmin } from "./supabase";

export type Limits = {
  maxStudents: number; // students in the whole system (new students beyond this are turned away)
  maxMessagesPerSession: number; // student messages in one conversation
  maxSessionsPerTask: number; // conversations per student per task
  maxMessageChars: number; // length of one student message
  cooldownSeconds: number; // minimum time between two messages in a conversation
  dailyStudioBuilds: number; // tasks written or revised by the task agent per day
  dailyResearchQueries: number; // research-assistant and student-chatbot questions per day
};

export const DEFAULT_LIMITS: Limits = {
  maxStudents: 50,
  maxMessagesPerSession: 60,
  maxSessionsPerTask: 3,
  maxMessageChars: 1500,
  cooldownSeconds: 3,
  dailyStudioBuilds: 20,
  dailyResearchQueries: 60,
};

let cache: { at: number; value: Limits } | null = null;

export async function getLimits(): Promise<Limits> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value = DEFAULT_LIMITS;
  try {
    const { data } = await supabaseAdmin().from("app_settings").select("value").eq("key", "limits").maybeSingle();
    if (data?.value) value = normalizeLimits(data.value);
  } catch {}
  cache = { at: Date.now(), value };
  return value;
}

export function normalizeLimits(raw: unknown): Limits {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_LIMITS };
  for (const k of Object.keys(DEFAULT_LIMITS) as (keyof Limits)[]) {
    const v = Number(r[k]);
    if (Number.isFinite(v) && v >= 0) out[k] = Math.round(v);
  }
  return out;
}

export async function saveLimits(value: Limits) {
  const { error } = await supabaseAdmin().from("app_settings").upsert({ key: "limits", value });
  if (error) throw new Error(error.message);
  cache = { at: Date.now(), value };
}

// Count today's usage of a kind (Israel day boundaries are close enough with UTC midnight).
export async function usedToday(kinds: string[]): Promise<number> {
  try {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    const { count } = await supabaseAdmin()
      .from("usage_log")
      .select("id", { count: "exact", head: true })
      .in("kind", kinds)
      .gte("at", since.toISOString());
    return count ?? 0;
  } catch {
    return 0;
  }
}

type Usage = { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null };

// Record one model call. Never throws (logging must not break the student's chat).
export async function logUsage(kind: string, model: string | null, usage: Usage | null | undefined, ids: { sessionId?: string | null; staffId?: string | null } = {}) {
  try {
    await supabaseAdmin()
      .from("usage_log")
      .insert({
        kind,
        model,
        input_tokens: usage?.input_tokens ?? null,
        output_tokens: usage?.output_tokens ?? null,
        cache_read_tokens: usage?.cache_read_input_tokens ?? null,
        cache_write_tokens: usage?.cache_creation_input_tokens ?? null,
        session_id: ids.sessionId ?? null,
        staff_id: ids.staffId ?? null,
      });
  } catch {}
}
