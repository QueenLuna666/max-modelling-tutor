// The analyzer agent: codes every student message (phase, performance, motivation, challenge, evidence).
// Runs before MAX answers, so MAX's hint level follows the diagnosis.
import Anthropic from "@anthropic-ai/sdk";
import { loadPrompt } from "./prompts";
import { getPhase, t, type Task } from "./tasks";
import type { Motivation, Performance } from "./policy";

export type Analysis = {
  phase: string;
  performance: Performance;
  motivation: Motivation;
  challenge: string | null;
  evidence: string;
  asks_for_answer: boolean;
  phase_complete: boolean;
};

export const ANALYZER_MODEL = process.env.ANALYZER_MODEL ?? "claude-haiku-5-5";

let client: Anthropic | null = null;

export async function analyzeMessage(opts: {
  task: Task;
  guidedPhaseId: string;
  recent: { role: string; content: string }[]; // previous turns, oldest first (not including `message`)
  message: string;
  wordCount: number;
  responseMs: number | null;
}): Promise<Analysis | null> {
  const { task, guidedPhaseId, recent, message, wordCount, responseMs } = opts;
  const phaseIds = task.phases.map((p) => p.id);
  const challengeIds = task.challenge_types.map((c) => c.id);
  const guided = getPhase(task, guidedPhaseId);

  const phasesText = task.phases
    .map(
      (p, i) =>
        `${i + 1}. ${p.id} (${t(p.label, "en")}): ${p.goal}\n   evidence: ${p.evidence.join("; ")}\n   common mistakes: ${p.misconceptions.join("; ")}`,
    )
    .join("\n");

  const transcript = recent
    .map((r) => `${r.role === "student" ? "STUDENT" : "MAX"}: ${r.content}`)
    .join("\n");

  const userContent = `# Task
${t(task.statement, "en")}

# Modelling steps
${phasesText}

# Difficulty types
${task.challenge_types.map((c) => `- ${c.id}: ${t(c.label, "en")}`).join("\n")}

# Step MAX is currently guiding
${guided.id} (${t(guided.label, "en")})

# Conversation so far (most recent last)
${transcript || "(none)"}

# Message to code
Word count: ${wordCount}. Seconds since MAX's last reply: ${responseMs == null ? "unknown" : Math.round(responseMs / 1000)}.
STUDENT: ${message}`;

  const tool: Anthropic.Tool = {
    name: "record_analysis",
    description: "Record the coding of the student's message.",
    input_schema: {
      type: "object",
      properties: {
        phase: { type: "string", enum: phaseIds },
        performance: { type: "string", enum: ["high", "partial", "low"] },
        motivation: { type: "string", enum: ["high", "low"] },
        challenge: { type: "string", enum: [...challengeIds, "none"] },
        evidence: { type: "string" },
        asks_for_answer: { type: "boolean" },
        phase_complete: { type: "boolean" },
      },
      required: ["phase", "performance", "motivation", "challenge", "evidence", "asks_for_answer", "phase_complete"],
    },
  };

  try {
    client ??= new Anthropic();
    const res = await client.messages.create(
      {
        model: ANALYZER_MODEL,
        max_tokens: 400,
        system: await loadPrompt("analyzer"),
        tools: [tool],
        tool_choice: { type: "tool", name: "record_analysis" },
        messages: [{ role: "user", content: userContent }],
      },
      { timeout: 20_000 },
    );
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    const a = block.input as Record<string, unknown>;

    const phase = phaseIds.includes(String(a.phase)) ? String(a.phase) : guidedPhaseId;
    const performance = (["high", "partial", "low"] as const).find((v) => v === a.performance) ?? "partial";
    const motivation = (["high", "low"] as const).find((v) => v === a.motivation) ?? "high";
    const challenge = challengeIds.includes(String(a.challenge)) ? String(a.challenge) : null;

    return {
      phase,
      performance,
      motivation,
      challenge,
      evidence: typeof a.evidence === "string" ? a.evidence.slice(0, 300) : "",
      asks_for_answer: a.asks_for_answer === true,
      phase_complete: a.phase_complete === true,
    };
  } catch (err) {
    console.error("Analyzer failed", err);
    return null; // MAX still answers, judging the student by itself
  }
}
