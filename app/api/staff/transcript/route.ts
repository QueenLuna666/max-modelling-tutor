// GET /api/staff/transcript?sessionId=…|classId=…&analysis=0|1 — the conversation(s) as a Word file.
// analysis=1 adds the lab's coding under every message — researchers only; teachers always get the plain version.
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { classDashboard, exportData, sessionDetail } from "@/lib/staffData";
import { toTranscriptDocx } from "@/lib/transcriptDocx";

export const maxDuration = 60;

export async function GET(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") ?? undefined;
  const classId = url.searchParams.get("classId") ?? undefined;
  if (!sessionId && !classId) return Response.json({ error: "חסר sessionId או classId" }, { status: 400 });

  // Access: the same check as the pages (teachers only see their own classes).
  const check = sessionId ? await sessionDetail(staff, sessionId) : await classDashboard(staff, classId!);
  if ("error" in check && check.error) return check.error === 403 ? forbidden() : Response.json({ error: "Not found" }, { status: 404 });

  const withAnalysis = url.searchParams.get("analysis") === "1" && isResearcher(staff);
  const data = await exportData({ ...staff, role: "admin" }, { sessionId, classId });
  if ("error" in data) return Response.json({ error: "Not found" }, { status: 404 });

  const buf = await toTranscriptDocx(data.sessions, withAnalysis);
  const who = data.sessions.length === 1 ? data.sessions[0].name : data.name;
  const file = encodeURIComponent(`MAX-${who}-${withAnalysis ? "עם-ניתוח" : "שיחה"}-${new Date().toISOString().slice(0, 10)}`);
  return new Response(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="max-transcript.docx"; filename*=UTF-8''${file}.docx`,
    },
  });
}
