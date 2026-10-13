// One place that decides how we reach Claude:
//  - Amazon Bedrock (the hackathon's access): AWS_BEARER_TOKEN_BEDROCK + AWS_REGION.
//    Uses Bedrock's Anthropic-compatible endpoint with the bearer token as the API key.
//  - Anthropic API directly: ANTHROPIC_API_KEY.
// Model names can be overridden with TUTOR_MODEL / ANALYZER_MODEL.
import Anthropic from "@anthropic-ai/sdk";

const bedrockToken = process.env.AWS_BEARER_TOKEN_BEDROCK?.trim();
const region = process.env.AWS_REGION?.trim() || "us-east-1";

export const PROVIDER: "bedrock" | "anthropic" = bedrockToken ? "bedrock" : "anthropic";

export const TUTOR_MODEL =
  process.env.TUTOR_MODEL?.trim() || (PROVIDER === "bedrock" ? "anthropic.claude-sonnet-5-5" : "claude-sonnet-5-5");
export const ANALYZER_MODEL =
  process.env.ANALYZER_MODEL?.trim() || (PROVIDER === "bedrock" ? "anthropic.claude-haiku-5-5" : "claude-haiku-5-5");

let client: Anthropic | null = null;

export function llm(): Anthropic {
  if (client) return client;
  if (PROVIDER === "bedrock") {
    client = new Anthropic({
      apiKey: bedrockToken,
      baseURL: process.env.ANTHROPIC_BASE_URL?.trim() || `https://bedrock-mantle.${region}.api.aws/anthropic`,
    });
  } else {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY
  }
  return client;
}
