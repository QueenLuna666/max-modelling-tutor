// The task-writing agent: photo and/or description → a full modelling task in the lab's format.
// Also revises an existing task from a researcher's request. Streams progress to the caller.
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { llm, model } from "./llm";
import { loadPrompt } from "./prompts";
import { DIFFICULTIES, PHASES, SKILLS, TRANSVERSAL } from "./framework";
import { builtInTasks, type Lang, type Task } from "./tasks";

const LANGS: Lang[] = ["he", "ar", "en"];
const loc = { type: "object", properties: { he: { type: "string" }, ar: { type: "string" }, en: { type: "string" } }, required: LANGS };
const cardText = {
  type: "object",
  properties: {
    title: { type: "string" },
    definition: { type: "string" },
    image_alt: { type: "string" },
    points: { type: "array", items: { type: "string" } },
    question: { type: "string" },
  },
  required: ["title", "definition", "image_alt", "points", "question"],
};
const gendered = { type: "object", properties: { male: { type: "string" }, female: { type: "string" } }, required: ["male", "female"] };
const strArr = { type: "array", items: { type: "string" } };

const TOOL: Anthropic.Tool = {
  name: "record_task",
  description: "Record the complete modelling task.",
  input_schema: {
    type: "object",
    properties: {
      note_to_author: { type: "string" },
      task: {
        type: "object",
        properties: {
          title: loc,
          statement: loc,
          card: { type: "object", properties: { he: cardText, ar: cardText, en: cardText }, required: LANGS },
          givens: { type: "object", additionalProperties: { type: "number" } },
          context_for_tutor: strArr,
          reference: {
            type: "object",
            properties: {
              path: { type: "string" },
              formula: { type: "string" },
              examples: { type: "string" },
              judge_by: { type: "string" },
              effects: { type: "string" },
              extension: { type: "string" },
            },
            required: ["path", "formula", "examples", "judge_by", "effects", "extension"],
          },
          opening: { type: "object", properties: { he: gendered, ar: gendered, en: gendered }, required: LANGS },
          phases: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string", enum: PHASES.map((p) => p.id) },
                goal: { type: "string" },
                evidence: strArr,
                misconceptions: strArr,
                hints: {
                  type: "object",
                  properties: { light: { type: "string" }, medium: { type: "string" }, strong: { type: "string" } },
                  required: ["light", "medium", "strong"],
                },
                compliment: { type: "string" },
              },
              required: ["id", "goal", "evidence", "misconceptions", "hints", "compliment"],
            },
          },
        },
        required: ["title", "statement", "card", "givens", "context_for_tutor", "reference", "opening", "phases"],
      },
    },
    required: ["note_to_author", "task"],
  },
};

function frameworkText(): string {
  return `# The lab's 6 phases
${PHASES.map((p, i) => `${i + 1}. ${p.id} (${p.en}): ${p.desc}\n   Product: ${p.product}`).join("\n")}

# Skill codes
${SKILLS.map((x) => `- ${x.code} [${x.phase}]: ${x.en}`).join("\n")}
${TRANSVERSAL.map((x) => `- ${x.code}: ${x.en}`).join("\n")}

# Difficulty codes
${DIFFICULTIES.map((d) => `- ${d.code} [${d.phase}]: ${d.en}`).join("\n")}`;
}

function exampleText(): string {
  const ex = builtInTasks().speedometer;
  const { image: _i, card, ...rest } = ex as Task & { version?: string };
  void _i;
  const slim = { ...rest, card: { he: card?.he, ar: card?.ar, en: card?.en } };
  delete (slim as Record<string, unknown>).version;
  return `# Example of a finished task (the lab's speedometer task) — match this quality, length and format\n${JSON.stringify(slim)}`;
}

export type AuthorImage = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };
export type AuthorResult = { task: Task; note: string };

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Validate an uploaded image from a request body ({ data: base64, mediaType }).
export function readImage(img: unknown): AuthorImage | null {
  const i = img as { data?: string; mediaType?: string } | null;
  if (!i?.data || !i.mediaType || !IMAGE_TYPES.includes(i.mediaType)) return null;
  if (i.data.length > 6_000_000) throw new Error("התמונה גדולה מדי");
  return { data: i.data, mediaType: i.mediaType as AuthorImage["mediaType"] };
}

// Make sure the task has every field the app relies on, in the framework's phase order.
export function normalizeTask(raw: Record<string, unknown>, id: string, imageUrl: string | null): Task {
  const r = raw as Partial<Task> & { card?: Record<string, unknown> };
  const byId = new Map((r.phases ?? []).map((p) => [p.id, p]));
  const phases = PHASES.map((fp) => {
    const p = byId.get(fp.id);
    return {
      id: fp.id,
      label: { he: fp.he, ar: fp.ar, en: fp.en },
      goal: p?.goal ?? fp.product,
      evidence: p?.evidence ?? [],
      misconceptions: p?.misconceptions ?? [],
      hints: {
        light: p?.hints?.light ?? "",
        medium: p?.hints?.medium ?? "",
        strong: p?.hints?.strong ?? "",
      },
      compliment: p?.compliment ?? "",
    };
  });
  const title = r.title ?? { he: "משימה חדשה" };
  return {
    id,
    title,
    statement: r.statement ?? { he: "" },
    card: { ...(r.card ?? {}), image: imageUrl ?? undefined } as Task["card"],
    givens: r.givens ?? {},
    context_for_tutor: r.context_for_tutor ?? [],
    reference: (r.reference ?? { path: "" }) as Task["reference"],
    opening: r.opening ?? { he: { male: "היי, אני MAX 👋 קרא את המשימה. מה צריך למצוא?", female: "היי, אני MAX 👋 קראי את המשימה. מה צריך למצוא?" } },
    phases,
  };
}

export async function runTaskAuthor(opts: {
  image?: AuthorImage | null;
  description?: string;
  grade?: string;
  current?: Task | null;
  history?: { role: "author" | "agent"; content: string }[];
  instruction?: string;
  noteLang?: "he" | "ar"; // language of the agent's note to the researcher
  onProgress?: (chars: number) => void;
}): Promise<{ raw: Record<string, unknown>; note: string; usage: Record<string, number | null>; model: string }> {
  const parts: Anthropic.ContentBlockParam[] = [];
  if (opts.image) {
    parts.push({ type: "image", source: { type: "base64", media_type: opts.image.mediaType, data: opts.image.data } });
  }
  let text = `${frameworkText()}\n\n${exampleText()}\n\n`;
  if (opts.current) {
    const { id: _id, ...cur } = opts.current;
    void _id;
    text += `# Current task (JSON)\n${JSON.stringify(cur)}\n\n`;
    if (opts.history?.length) {
      text += `# Conversation with the researcher so far\n${opts.history.map((h) => `${h.role === "author" ? "RESEARCHER" : "YOU"}: ${h.content}`).join("\n")}\n\n`;
    }
    text += `# The researcher's request now\n${opts.instruction ?? ""}\n${opts.image ? "(A new photo is attached; use it if the request refers to it.)\n" : ""}\nReturn the full revised task with record_task.`;
  } else {
    text += `# Write a new task\n`;
    if (opts.image) text += `The photo above was taken by the researcher. Build the task around what it shows.\n`;
    if (opts.description) text += `The researcher's description: ${opts.description}\n`;
    if (opts.grade) text += `Grade level: ${opts.grade}\n`;
    text += `\nCall record_task with the complete task.`;
  }
  if (opts.noteLang === "ar") text += `\nWrite note_to_author in Arabic (the researcher is using the Arabic interface).`;
  parts.push({ type: "text", text });

  // The tutor model on this account does not accept a forced tool_choice, so we ask for the tool
  // explicitly and let the model choose it ("auto"); one retry if it answers in text instead.
  const tutorModel = await model("tutor");
  const system = `${await loadPrompt("task_author")}\n\nAlways answer by calling the record_task tool exactly once with the complete task. Never write the task as plain text.`;
  let chars = 0;
  async function attempt() {
    const res = llm().messages.stream({
      model: tutorModel,
      max_tokens: 20000,
      system,
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [{ role: "user", content: parts }],
    });
    for await (const ev of res) {
      if (ev.type === "content_block_delta" && ev.delta.type === "input_json_delta") {
        chars += ev.delta.partial_json.length;
        opts.onProgress?.(chars);
      }
    }
    return res.finalMessage();
  }
  let final = await attempt();
  if (!final.content.some((b) => b.type === "tool_use")) {
    console.warn("Task agent answered without the tool, retrying", final.stop_reason);
    chars = 0;
    final = await attempt();
  }
  const block = final.content.find((b) => b.type === "tool_use");
  if (!block || block.type !== "tool_use") throw new Error("The task agent did not return a task. Try again.");
  if (final.stop_reason === "max_tokens") throw new Error("The task was too long and got cut off. Try again.");
  const input = block.input as { note_to_author?: string; task?: Record<string, unknown> };
  if (!input.task) throw new Error("The task agent returned an empty task. Try again.");
  return { raw: input.task, note: input.note_to_author ?? "", usage: final.usage as unknown as Record<string, number | null>, model: tutorModel };
}
