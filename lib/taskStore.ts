// Where tasks come from: built-in task files (tasks/*.json) plus tasks written in the studio
// (Supabase table "tasks"). A database row with the same id overrides the built-in file.
// Server only.
import "server-only";
import { supabaseAdmin } from "./supabase";
import { builtInTasks, type Task } from "./tasks";

export type TaskStatus = "draft" | "published" | "archived";
export type TaskRow = {
  id: string;
  status: TaskStatus;
  data: Task;
  source: TaskSource | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};
export type StudioTurn = { role: "author" | "agent"; content: string; at: string };
export type TaskSource = { description?: string; image_url?: string | null; grade?: string; derived_from?: string; chat?: StudioTurn[] };

// Small per-instance cache, so a chat turn doesn't hit the database for the task every time.
const TTL_MS = 20_000;
const cache = new Map<string, { at: number; row: TaskRow | null }>();

async function loadRow(id: string): Promise<TaskRow | null> {
  const hit = cache.get(id);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.row;
  let row: TaskRow | null = null;
  try {
    const { data, error } = await supabaseAdmin().from("tasks").select("*").eq("id", id).maybeSingle();
    if (!error) row = (data as TaskRow) ?? null;
  } catch {
    row = null; // table not created yet: built-in tasks still work
  }
  cache.set(id, { at: Date.now(), row });
  return row;
}

export function forgetTask(id: string) {
  cache.delete(id);
}

// The task by id (any status except archived), for sessions and the dashboard.
export async function getTask(id: string): Promise<Task | null> {
  const row = await loadRow(id);
  if (row && row.status !== "archived") return { ...row.data, id: row.id };
  return builtInTasks()[id] ?? null;
}

// Many tasks at once (dashboard, export).
export async function getTasks(ids: string[]): Promise<Record<string, Task>> {
  const out: Record<string, Task> = {};
  await Promise.all([...new Set(ids)].map(async (id) => {
    const tk = await getTask(id);
    if (tk) out[id] = tk;
  }));
  return out;
}

export async function listRows(): Promise<TaskRow[]> {
  try {
    const { data, error } = await supabaseAdmin().from("tasks").select("*").order("created_at", { ascending: false });
    if (error) return [];
    return (data as TaskRow[]) ?? [];
  } catch {
    return [];
  }
}

// Tasks students may open: built-ins (unless archived/overridden) + published studio tasks.
export async function listPublishedTasks(): Promise<Task[]> {
  const rows = await listRows();
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: Task[] = [];
  for (const [id, tk] of Object.entries(builtInTasks())) {
    const r = byId.get(id);
    if (!r) out.push(tk);
    else if (r.status === "published") out.push({ ...r.data, id });
  }
  for (const r of rows) {
    if (!(r.id in builtInTasks()) && r.status === "published") out.push({ ...r.data, id: r.id });
  }
  return out;
}

export async function saveRow(row: Partial<TaskRow> & { id: string }): Promise<TaskRow> {
  const { data, error } = await supabaseAdmin()
    .from("tasks")
    .upsert({ ...row, updated_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  forgetTask(row.id);
  return data as TaskRow;
}

export async function getRow(id: string): Promise<TaskRow | null> {
  forgetTask(id);
  return loadRow(id);
}

// ---- media (photos for tasks) ----
const BUCKET = "task-media";

export async function uploadImage(base64: string, mediaType: string, name: string): Promise<string> {
  const db = supabaseAdmin();
  const buf = Buffer.from(base64, "base64");
  const ext = mediaType === "image/png" ? "png" : mediaType === "image/webp" ? "webp" : "jpg";
  const path = `${name}-${Date.now()}.${ext}`;
  let { error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: mediaType, upsert: true });
  if (error && /not found|does not exist/i.test(error.message)) {
    await db.storage.createBucket(BUCKET, { public: true });
    ({ error } = await db.storage.from(BUCKET).upload(path, buf, { contentType: mediaType, upsert: true }));
  }
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
