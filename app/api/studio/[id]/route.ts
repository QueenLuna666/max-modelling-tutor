// GET   /api/studio/:id — one task with its full content and the conversation with the task agent.
// PATCH /api/studio/:id — save manual edits and/or change status.
//   Body: { data?: Task, status?: "draft" | "published" | "archived" }
// Built-in tasks (speedometer) can be edited too: the first save stores a copy that overrides the file.
import { getStaff, unauthorized } from "@/lib/auth";
import { builtInTasks, type Task } from "@/lib/tasks";
import { getRow, saveRow, type TaskStatus } from "@/lib/taskStore";
import { normalizeTask } from "@/lib/taskAuthor";

const STATUSES: TaskStatus[] = ["draft", "published", "archived"];

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const row = await getRow(id);
  if (row) return Response.json({ ...row, builtIn: id in builtInTasks() });
  const builtIn = builtInTasks()[id];
  if (!builtIn) return Response.json({ error: "המשימה לא נמצאה" }, { status: 404 });
  return Response.json({ id, status: "published", data: builtIn, source: null, builtIn: true });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { data?: Task; status?: TaskStatus };

  const row = await getRow(id);
  const builtIn = builtInTasks()[id];
  if (!row && !builtIn) return Response.json({ error: "המשימה לא נמצאה" }, { status: 404 });

  const current = row?.data ?? builtIn;
  let data = current;
  if (body.data) {
    if (typeof body.data !== "object" || !Array.isArray(body.data.phases)) {
      return Response.json({ error: "מבנה המשימה לא תקין" }, { status: 400 });
    }
    data = normalizeTask(body.data as unknown as Record<string, unknown>, id, body.data.card?.image ?? null);
    if (builtIn) data.image = builtIn.image; // keep the original scanned card of the built-in task
  }
  const status = body.status && STATUSES.includes(body.status) ? body.status : (row?.status ?? "published");

  try {
    const saved = await saveRow({ id, status, data, source: row?.source ?? null, created_by: row?.created_by ?? staff.id });
    return Response.json({ ...saved, builtIn: Boolean(builtIn) });
  } catch (e) {
    const msg = (e as Error).message;
    const missing = /relation .*tasks.* does not exist|could not find the table/i.test(msg);
    return Response.json({ error: missing ? "צריך להריץ את migration_003_studio.sql ב-Supabase" : msg }, { status: 500 });
  }
}
