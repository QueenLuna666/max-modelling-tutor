// POST /api/studio/:id/image — replace the task's picture without asking the agent.
//   Body: { image: { data: base64, mediaType } }  → { url }
import { getStaff, unauthorized } from "@/lib/auth";
import { uploadImage } from "@/lib/taskStore";
import { readImage } from "@/lib/taskAuthor";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { image?: unknown };
  try {
    const image = readImage(body.image);
    if (!image) return Response.json({ error: "לא התקבלה תמונה" }, { status: 400 });
    return Response.json({ url: await uploadImage(image.data, image.mediaType, id) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
