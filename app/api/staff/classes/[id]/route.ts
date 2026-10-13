// GET /api/staff/classes/:id — dashboard data for one class.
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { classDashboard } from "@/lib/staffData";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const { id } = await ctx.params;
  const result = await classDashboard(staff, id);
  if ("error" in result) return result.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(result);
}
