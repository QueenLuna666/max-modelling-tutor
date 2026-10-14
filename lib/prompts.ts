// Loads prompt files from prompts/*.md (cached per server instance).
// Researchers can edit those files without touching code.
import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

export async function loadPrompt(name: "max_base" | "analyzer" | "task_author" | "summary" | "lab_rules"): Promise<string> {
  const hit = cache.get(name);
  if (hit) return hit;
  const text = await readFile(path.join(process.cwd(), "prompts", `${name}.md`), "utf8");
  cache.set(name, text);
  return text;
}
