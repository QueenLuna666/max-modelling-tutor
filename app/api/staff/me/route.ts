import { getStaff, unauthorized } from "@/lib/auth";

export async function GET() {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  return Response.json({ id: staff.id, name: staff.name, email: staff.email, role: staff.role });
}
