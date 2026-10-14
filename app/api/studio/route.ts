// GET  /api/studio — every task for the studio: built-in + written in the studio, with status.
// POST /api/studio — write a new task from a photo and/or a description (streams progress).
//   Body: { image?: { data: base64, mediaType }, description?: string, grade?: string }
//   Stream: {"progress": n} … then {"id": "..."} or {"error": "..."}
import { randomBytes } from "node:crypto";
import { getStaff, unauthorized } from "@/lib/auth";
import { builtInTasks, t } from "@/lib/tasks";
import { listRows, saveRow, uploadImage } from "@/lib/taskStore";
import { normalizeTask, readImage, runTaskAuthor, type AuthorImage } from "@/lib/taskAuthor";
import { ndjsonStream, progressSender } from "@/lib/ndjson";

export const maxDuration = 300;

export async function GET() {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const rows = await listRows();
  const ids = new Set(rows.map((r) => r.id));
  const builtIns = Object.values(builtInTasks())
    .filter((tk) => !ids.has(tk.id))
    .map((tk) => ({ id: tk.id, status: "published", title: t(tk.title, "he"), image: tk.card?.image ?? null, builtIn: true, updatedAt: null }));
  return Response.json({
    tasks: [
      ...rows.map((r) => ({
        id: r.id,
        status: r.status,
        title: t(r.data.title, "he"),
        image: r.data.card?.image ?? null,
        builtIn: r.id in builtInTasks(),
        updatedAt: r.updated_at,
      })),
      ...builtIns,
    ],
  });
}

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const body = (await req.json().catch(() => ({}))) as { image?: unknown; description?: string; grade?: string };
  let image: AuthorImage | null;
  try {
    image = readImage(body.image);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  const description = body.description?.trim().slice(0, 2000) ?? "";
  if (!image && !description) return Response.json({ error: "צריך תמונה או תיאור" }, { status: 400 });

  return ndjsonStream(async (send) => {
    const id = `t-${randomBytes(3).toString("hex")}`;
    send({ stage: "upload" });
    const imageUrl = image ? await uploadImage(image.data, image.mediaType, id) : null;
    send({ stage: "write" });
    const { raw, note } = await runTaskAuthor({
      image,
      description,
      grade: body.grade,
      onProgress: progressSender(send),
    });
    const now = new Date().toISOString();
    await saveRow({
      id,
      status: "draft",
      data: normalizeTask(raw, id, imageUrl),
      source: {
        description,
        image_url: imageUrl,
        grade: body.grade,
        chat: [
          { role: "author", content: description || "(תמונה)", at: now },
          { role: "agent", content: note, at: now },
        ],
      },
      created_by: staff.id,
    });
    send({ id });
  });
}
