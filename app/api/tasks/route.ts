// GET /api/tasks?lang=he&class=DEMO1 — the tasks a class may open (no answers or hints),
// plus the class's feature switches (read aloud, voice input, ...).
import { publicTask, type Lang } from "@/lib/tasks";
import { listPublishedTasks } from "@/lib/taskStore";
import { codeVariants, normalizeSettings } from "@/lib/classSettings";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const lang = (params.get("lang") ?? "he") as Lang;
  const safe: Lang = ["he", "ar", "en"].includes(lang) ? lang : "he";
  const code = params.get("class");

  let settings = normalizeSettings(null);
  if (code) {
    try {
      const { data } = await supabaseAdmin().from("classes").select("*").in("code", codeVariants(code)).limit(1);
      settings = normalizeSettings(data?.[0]?.settings);
    } catch {}
  }

  let tasks = await listPublishedTasks();
  if (settings.tasks) tasks = tasks.filter((t) => settings.tasks!.includes(t.id));
  return Response.json({ tasks: tasks.map((t) => publicTask(t, safe)), features: settings.features });
}
