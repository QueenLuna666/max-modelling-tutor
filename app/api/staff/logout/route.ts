import { endStaffSession } from "@/lib/auth";

export async function POST() {
  await endStaffSession();
  return Response.json({ ok: true });
}
