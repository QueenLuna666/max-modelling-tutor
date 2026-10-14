// The analyzer agent: codes every student message with the lab's framework
// (phase, performance, motivation, skills shown, main difficulty code, evidence).
// Runs before MAX answers, so MAX's hint level follows the diagnosis.
import type Anthropic from "@anthropic-ai/sdk";
import { llm, model } from "./llm";
import { loadPrompt } from "./prompts";
import { getPhase, t, type Task } from "./tasks";
import type { Motivation, Performance } from "./policy";
import { DIAGNOSTIC_NOTES, DIFFICULTIES, SKILLS, TRANSVERSAL } from "./framework";

export type Level = "strong" | "intermediate" | "significant_difficulty" | "insufficient_evidence";
export const LEVELS: Level[] = ["strong", "intermediate", "significant_difficulty", "insufficient_evidence"];

// One phase identified in the message (the research team's rules allow several, or none).
export type PhaseObservation = {
  phase: string;
  level: Level;
  aspect: string;
  skills: string[];
  evidence: string;
  after_support: boolean;
};

export type Analysis = {
  phase: string | null; // main phase, null = no phase identified
  phases: PhaseObservation[];
  level: Level; // level in the main phase
  student_pattern: Level; // overall pattern in the conversation so far
  performance: Performance | null; // 3-point scale for the tutor's policy (null = insufficient evidence)
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
        phases: {
          type: "array",
          items: {
            type: "object",
            properties: {
              phase: { type: "string", enum: phaseIds },
              level: { type: "string", enum: LEVELS },
              aspect: { type: "string" },
              skills: { type: "array", items: { type: "string", enum: skillIds } },
              evidence: { type: "string" },
              after_support: { type: "boolean" },
            },
            required: ["phase", "level", "aspect", "skills", "evidence", "after_support"],
          },
        },
        phase: { type: "string", enum: [...phaseIds, "none"] },
        level: { type: "string", enum: LEVELS },
        performance: { type: "string", enum: ["high", "partial", "low", "none"] },
        student_pattern: { type: "string", enum: LEVELS },
        motivation: { type: "string", enum: ["high", "low"] },
        skills: { type: "array", items: { type: "string", enum: skillIds } },
        challenge: { type: "string", enum: [...challengeIds, "none"] },
        evidence: { type: "string" },
        asks_for_answer: { type: "boolean" },
        phase_complete: { type: "boolean" },
      },
      required: ["phases", "phase", "level", "performance", "student_pattern", "motivation", "skills", "challenge", "evidence", "asks_for_answer", "phase_complete"],
    },
  };

  try {
    const analyzerModel = await model("analyzer");
    const rules = `${await loadPrompt("analyzer")}\n\n${await loadPrompt("lab_rules")}`;
    const ask = (cache: boolean) =>
      llm().messages.create(
        {
          model: analyzerModel,
          max_tokens: 2500,
          // The rules are long and the same every turn: cache them when the account allows it.
          system: cache ? [{ type: "text", text: rules, cache_control: { type: "ephemeral" } }] : rules,
          tools: [tool],
          tool_choice: { type: "tool", name: "record_analysis" },
          messages: [{ role: "user", content: userContent }],
        },
        { timeout: 25_000 },
      );
    let res;
    try {
      res = await ask(true);
    } catch (err) {
      console.warn("Analyzer with prompt caching failed, retrying without it:", err instanceof Error ? err.message : err);
      res = await ask(false);
    }
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    const a = block.input as Record<string, unknown>;

    const asLevel = (v: unknown): Level => (LEVELS as string[]).includes(String(v)) ? (v as Level) : "insufficient_evidence";
    const phases: PhaseObservation[] = Array.isArray(a.phases)
      ? (a.phases as Record<string, unknown>[])
          .filter((p) => phaseIds.includes(String(p.phase)))
          .map((p) => ({
            phase: String(p.phase),
            level: asLevel(p.level),
            aspect: typeof p.aspect === "string" ? p.aspect.slice(0, 80) : "",
            skills: Array.isArray(p.skills) ? [...new Set(p.skills.map(String).filter((c) => skillIds.includes(c)))] : [],
            evidence: typeof p.evidence === "string" ? p.evidence.slice(0, 300) : "",
            after_support: p.after_support === true,
          }))
      : [];
    const phase = phaseIds.includes(String(a.phase)) ? String(a.phase) : (phases[0]?.phase ?? null);
    const level = asLevel(a.level);
    const student_pattern = asLevel(a.student_pattern);
    const performance = (["high", "partial", "low"] as const).find((v) => v === a.performance) ?? null;
    const motivation = (["high", "low"] as const).find((v) => v === a.motivation) ?? "high";
    const challenge = challengeIds.includes(String(a.challenge)) ? String(a.challenge) : null;
    const skills = Array.isArray(a.skills) ? [...new Set(a.skills.map(String).filter((c) => skillIds.includes(c)))] : [];
    for (const p of phases) for (const c of p.skills) if (!skills.includes(c)) skills.push(c);

    return {
      phase,
      phases,
      level,
      student_pattern,
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
