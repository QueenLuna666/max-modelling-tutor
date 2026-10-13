// One place that decides how we reach Claude.
//  - Amazon Bedrock (the hackathon's access): AWS_BEARER_TOKEN_BEDROCK + AWS_REGION, classic
//    bedrock-runtime endpoint (InvokeModel). The hackathon account is not allowed on bedrock-mantle.
//  - Anthropic API directly: ANTHROPIC_API_KEY.
// Which model IDs the account may use isn't known in advance, so we try a short list and keep
// the first that answers. TUTOR_MODEL / ANALYZER_MODEL override the list.
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicBedrock } from "@anthropic-ai/bedrock-sdk";

const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";

export const PROVIDER: "bedrock" | "anthropic" = bedrockToken ? "bedrock" : "anthropic";

const CANDIDATES = {
  bedrock: {
    // The hackathon account allows the global.* inference profiles (confirmed by the organisers).
    tutor: [
      "global.anthropic.claude-sonnet-5-5",
      "anthropic.claude-sonnet-5-5",
      "us.anthropic.claude-sonnet-5-5",
      "us.anthropic.claude-sonnet-4-5-20250929-v1:0",
      "global.anthropic.claude-sonnet-4-5-20250929-v1:0",
    ],
    analyzer: [
      "global.anthropic.claude-haiku-5-5",
      "anthropic.claude-haiku-5-5",
      "us.anthropic.claude-haiku-5-5",
      "us.anthropic.claude-haiku-4-5-20251001-v1:0",
      "global.anthropic.claude-haiku-4-5-20251001-v1:0",
    ],
  },
  anthropic: { tutor: ["claude-sonnet-5-5"], analyzer: ["claude-haiku-5-5"] },
};

export type ModelRole = "tutor" | "analyzer";

export function candidates(role: ModelRole): string[] {
  const override = (role === "tutor" ? process.env.TUTOR_MODEL : process.env.ANALYZER_MODEL)?.trim();
  if (override) return [override];
  const list = CANDIDATES[PROVIDER][role];
  // If no analyzer model works, the analyzer can fall back to the tutor's models.
  return role === "analyzer" ? [...list, ...CANDIDATES[PROVIDER].tutor] : list;
}

let client: Anthropic | null = null;

export function llm(): Anthropic {
  if (client) return client;
  client =
    PROVIDER === "bedrock"
      ? // Same messages API as the Anthropic client; reads the bearer token as its API key.
        (new AnthropicBedrock({ awsRegion: region, apiKey: bedrockToken }) as unknown as Anthropic)
      : new Anthropic(); // reads ANTHROPIC_API_KEY
  return client;
}

export async function tryModel(model: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await llm().messages.create({ model, max_tokens: 1, messages: [{ role: "user", content: "hi" }] }, { timeout: 20_000 });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

const resolved = new Map<ModelRole, Promise<string>>();

// The first model ID from the list that answers, remembered for this server instance.
export function model(role: ModelRole): Promise<string> {
  let p = resolved.get(role);
  if (!p) {
    p = (async () => {
      const list = candidates(role);
      if (list.length === 1) return list[0];
      const errors: string[] = [];
      for (const m of list) {
        const r = await tryModel(m);
        if (r.ok) return m;
        errors.push(`${m}: ${r.error.slice(0, 160)}`);
      }
      throw new Error(`No ${role} model is available on this account. Tried:\n${errors.join("\n")}`);
    })();
    resolved.set(role, p);
    p.catch(() => resolved.delete(role)); // try again on the next request
  }
  return p;
}
