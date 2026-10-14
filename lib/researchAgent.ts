// The research assistant: turns a researcher's question into a Python analysis (pandas + matplotlib)
// that runs live in the researcher's browser on the lab's data, then interprets the printed results.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { llm, model } from "./llm";
import { DATA_DESCRIPTION } from "./researchData";

const SYSTEM = `You are the research assistant of the MtED mathematics-education lab (Technion). Researchers study how middle-school students do open mathematical modelling with an AI tutor (MAX). The data are the students' conversations coded by an analyzer agent with the lab's framework (6 modelling phases, performance levels, skill and difficulty codes, hint levels H0–H4).

Your job: turn the researcher's question into ONE short, correct Python analysis that runs in the browser (Pyodide) and answers it with numbers and charts.

Rules for the Python code:
- Only pandas, numpy and matplotlib. Read the data with pd.read_csv("sessions.csv") and pd.read_csv("messages.csv").
- Do NOT call plt.show(), do not save files, no internet, no input(). Create each chart with plt.figure(figsize=(7,4)); the figures are collected automatically.
- Chart titles, axis labels and legends in ENGLISH (Hebrew/Arabic text renders badly in matplotlib); you may use phase ids and codes. Readable: large enough fonts, rotate long tick labels, tight_layout().
- Print the key results with print(): clear labels in English, small tables (df.to_string()), percentages rounded. These printed results are what will be interpreted, so print everything the answer depends on, including n (number of students / messages).
- Be robust: the data are small and may have empty values; handle missing columns/empty frames without crashing (if there is not enough data, print that clearly).
- Keep it under ~80 lines, commented briefly in English. Prefer descriptive statistics and clear comparisons; with small n, do not claim statistical significance — at most report effect sizes or simple tests with a caveat.

Always answer by calling the write_analysis tool exactly once.`;

const TOOL: Anthropic.Tool = {
  name: "write_analysis",
  description: "Record the analysis plan and the Python code.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short title of the analysis, in the researcher's language" },
      approach: { type: "string", description: "2–4 sentences in the researcher's language: which variables, which comparison or measure, and why it answers the question; limitations" },
      python: { type: "string" },
    },
    required: ["title", "approach", "python"],
  },
};

export type ResearchPlan = { title: string; approach: string; python: string };

export async function writeAnalysis(opts: {
  question: string;
  lang: "he" | "ar";
  sample: { sessions: string; messages: string };
  counts: Record<string, number>;
  previous?: { python: string; error: string } | null;
}): Promise<{ plan: ResearchPlan; usage: unknown; model: string }> {
  const m = await model("tutor");
  let text = `# Data
${DATA_DESCRIPTION}

Size: ${JSON.stringify(opts.counts)}

First rows of sessions.csv:
${opts.sample.sessions}

First rows of messages.csv:
${opts.sample.messages}

# The researcher's question (answer title and approach in ${opts.lang === "ar" ? "Arabic" : "Hebrew"})
${opts.question}`;
  if (opts.previous) {
    text += `\n\n# Your previous code failed — fix it\nCode:\n${opts.previous.python}\n\nError:\n${opts.previous.error.slice(0, 2000)}`;
  }
  const ask = () =>
    llm().messages.create(
      { model: m, max_tokens: 8000, system: SYSTEM, tools: [TOOL], tool_choice: { type: "auto" }, messages: [{ role: "user", content: text }] },
      { timeout: 120_000 },
    );
  let res = await ask();
  if (!res.content.some((b) => b.type === "tool_use")) res = await ask();
  const block = res.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("The research assistant did not return an analysis. Try again.");
  const input = block.input as Partial<ResearchPlan>;
  if (!input.python) throw new Error("The research assistant returned no code. Try again.");
  return { plan: { title: input.title ?? "", approach: input.approach ?? "", python: input.python }, usage: res.usage, model: m };
}

export async function interpretResults(opts: { question: string; lang: "he" | "ar"; plan: ResearchPlan; stdout: string; charts: number }) {
  const m = await model("tutor");
  const res = await llm().messages.create(
    {
      model: m,
      max_tokens: 3000,
      system: `You are the research assistant of the MtED lab. Interpret the printed results of an analysis for the researcher, in ${opts.lang === "ar" ? "Arabic" : "Hebrew"}. Use ONLY the printed numbers — never invent. Structure: ### ממצאים (3–5 bullets with the numbers), ### זהירות בפרשנות (small n, automatic coding by an AI agent that has not yet been validated against human coders, what the data cannot show), ### צעד הבא (1–2 suggestions for a follow-up analysis or a question to examine qualitatively). Translate headings if writing Arabic. Be concise.`,
      messages: [
        {
          role: "user",
          content: `Question: ${opts.question}\n\nAnalysis: ${opts.plan.title}\n${opts.plan.approach}\n\nCharts produced: ${opts.charts}\n\nPrinted results:\n${opts.stdout.slice(0, 12000) || "(nothing printed)"}`,
        },
      ],
    },
    { timeout: 90_000 },
  );
  return { text: res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim(), usage: res.usage, model: m };
}
