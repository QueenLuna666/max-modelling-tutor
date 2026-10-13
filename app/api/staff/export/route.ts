// GET /api/staff/export?classId=…|sessionId=…&format=xlsx|json — the research file. Researchers only.
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { exportData } from "@/lib/staffData";
import { toJson, toXlsx } from "@/lib/exportFile";

export const maxDuration = 60;

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const url = new URL(req.url);
  const result = await exportData(staff, {
    classId: url.searchParams.get("classId") ?? undefined,
    sessionId: url.searchParams.get("sessionId") ?? undefined,
  });
  if ("error" in result) {
    if (result.error === 403) return forbidden();
    return Response.json({ error: result.error === 400 ? "חסר classId או sessionId" : "Not found" }, { status: result.error });
  }

  const date = new Date().toISOString().slice(0, 10);
  const file = encodeURIComponent(`MAX-${result.name}-${date}`);
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(toJson(result.sessions), null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="max-export.json"; filename*=UTF-8''${file}.json`,
      },
    });
  }
  const buf = await toXlsx(result.sessions);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="max-export.xlsx"; filename*=UTF-8''${file}.xlsx`,
    },
  });
}
