// GET /api/staff/export?classId=…|sessionId=…&format=csv|json — the analysis file. Researchers only.
import { forbidden, getStaff, unauthorized } from "@/lib/auth";
import { exportRows } from "@/lib/staffData";

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
}

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const url = new URL(req.url);
  const result = await exportRows(staff, {
    classId: url.searchParams.get("classId") ?? undefined,
    sessionId: url.searchParams.get("sessionId") ?? undefined,
  });
  if ("error" in result) {
    if (result.error === 403) return forbidden();
    return Response.json({ error: result.error === 400 ? "חסר classId או sessionId" : "Not found" }, { status: result.error });
  }

  const date = new Date().toISOString().slice(0, 10);
  if (url.searchParams.get("format") === "json") {
    return new Response(JSON.stringify(result.rows, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="max-${result.name}-${date}.json"`,
      },
    });
  }
  // BOM so Excel opens Hebrew/Arabic correctly.
  return new Response("﻿" + toCsv(result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="max-${result.name}-${date}.csv"`,
    },
  });
}
