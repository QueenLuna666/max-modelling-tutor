// GET /api/staff/sessions/:id — full conversation + journey (+ analysis for researchers).
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { sessionDetail } from "@/lib/staffData";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const result = await sessionDetail(staff, id);
  if ("error" in result) return result.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(result);
}
