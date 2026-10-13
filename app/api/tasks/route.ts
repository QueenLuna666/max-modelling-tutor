// GET /api/tasks?lang=he — the task library for students (no answers or hints).
import { listTasks, publicTask, type Lang } from "@/lib/tasks";

export async function GET(req: Request) {
  const lang = (new URL(req.url).searchParams.get("lang") ?? "he") as Lang;
  const safe: Lang = ["he", "ar", "en"].includes(lang) ? lang : "he";
  return Response.json({ tasks: listTasks().map((t) => publicTask(t, safe)) });
}
