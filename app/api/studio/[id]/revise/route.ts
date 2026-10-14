// POST /api/studio/:id/revise — ask the task agent to change the task.
//   Body: { instruction: string, image?: { data, mediaType } }
//   Stream: {"progress": n} … then {"ok": true, "note": "..."} or {"error": "..."}
import { getStaff, unauthorized } from "@/lib/auth";
import { builtInTasks } from "@/lib/tasks";
import { getRow, saveRow, uploadImage, type StudioTurn } from "@/lib/taskStore";
import { normalizeTask, readImage, runTaskAuthor, type AuthorImage } from "@/lib/taskAuthor";
import { ndjsonStream, progressSender } from "@/lib/ndjson";

export const maxDuration = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { instruction?: string; image?: unknown; lang?: string };
  const instruction = body.instruction?.trim().slice(0, 2000);
  if (!instruction) return Response.json({ error: "מה לשנות?" }, { status: 400 });
  let image: AuthorImage | null;
  try {
    image = readImage(body.image);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }

  const row = await getRow(id);
  const builtIn = builtInTasks()[id];
  const current = row?.data ?? builtIn;
  if (!current) return Response.json({ error: "המשימה לא נמצאה" }, { status: 404 });

  return ndjsonStream(async (send) => {
    const history = row?.source?.chat ?? [];
    let imageUrl = current.card?.image ?? null;
    if (image) {
      send({ stage: "upload" });
      imageUrl = await uploadImage(image.data, image.mediaType, id);
    }
    send({ stage: "write" });
    const { raw, note } = await runTaskAuthor({
      current,
      history,
      instruction,
      image,
      noteLang: body.lang === "ar" ? "ar" : "he",
      onProgress: progressSender(send),
    });
    const data = normalizeTask(raw, id, imageUrl);
    if (builtIn) data.image = builtIn.image; // keep the original scanned card for the built-in task
    const now = new Date().toISOString();
    const chat: StudioTurn[] = [
      ...history,
      { role: "author", content: instruction, at: now },
      { role: "agent", content: note, at: now },
    ];
    await saveRow({
      id,
      status: row?.status ?? (builtIn ? "published" : "draft"),
      data,
      source: { ...(row?.source ?? {}), chat },
      created_by: row?.created_by ?? staff.id,
    });
    send({ ok: true, note });
  });
}
