// The analyzer agent: codes every student message with the lab's framework
// (phase, performance, motivation, skills shown, main difficulty code, evidence).
// Runs before MAX answers, so MAX's hint level follows the diagnosis.
import type Anthropic from "@anthropic-ai/sdk";
import { llm, model } from "./llm";
import { loadPrompt } from "./prompts";
import { getPhase, t, type Task } from "./tasks";
import type { Motivation, Performance } from "./policy";
import { DIAGNOSTIC_NOTES, DIFFICULTIES, SKILLS, TRANSVERSAL } from "./framework";

export type Analysis = {
  phase: string;
  performance: Performance;
  motivation: Motivation;
  challenge: string | null;
  skills: string[];
  evidence: string;
  asks_for_answer: boolean;
  phase_complete: boolean;
};


export async function analyzeMessage(opts: {
  task: Task;
  guidedPhaseId: string;
  recent: { role: string; content: string }[]; // previous turns, oldest first (not including `message`)
  message: string;
  wordCount: number;
  responseMs: number | null;
}): Promise<(Analysis & { model: string }) | null> {
  const { task, guidedPhaseId, recent, message, wordCount, responseMs } = opts;
  const phaseIds = task.phases.map((p) => p.id);
  const challengeIds = DIFFICULTIES.map((d) => d.code);
  const skillIds = [...SKILLS.map((x) => x.code), ...TRANSVERSAL.map((x) => x.code)];
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

# Skill codes (desired behaviour)
${SKILLS.map((x) => `- ${x.code} [${x.phase}]: ${x.en}`).join("\n")}

# Cross-cutting skill codes
${TRANSVERSAL.map((x) => `- ${x.code}: ${x.en}`).join("\n")}

# Difficulty codes
${DIFFICULTIES.map((d) => `- ${d.code} [${d.phase}]: ${d.en}`).join("\n")}

# Diagnostic distinctions
${DIAGNOSTIC_NOTES.map((n) => `- ${n}`).join("\n")}

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
        skills: { type: "array", items: { type: "string", enum: skillIds } },
        challenge: { type: "string", enum: [...challengeIds, "none"] },
        evidence: { type: "string" },
        asks_for_answer: { type: "boolean" },
        phase_complete: { type: "boolean" },
      },
      required: ["phase", "performance", "motivation", "skills", "challenge", "evidence", "asks_for_answer", "phase_complete"],
    },
  };

  try {
    const analyzerModel = await model("analyzer");
    const res = await llm().messages.create(
      {
        model: analyzerModel,
        max_tokens: 600,
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
    const skills = Array.isArray(a.skills) ? [...new Set(a.skills.map(String).filter((c) => skillIds.includes(c)))] : [];

    return {
      phase,
      performance,
      motivation,
      challenge,
      skills,
      evidence: typeof a.evidence === "string" ? a.evidence.slice(0, 300) : "",
      asks_for_answer: a.asks_for_answer === true,
      phase_complete: a.phase_complete === true,
      model: analyzerModel,
    };
  } catch (err) {
    console.error("Analyzer failed", err);
    return null; // MAX still answers, judging the student by itself
  }
}
