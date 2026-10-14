// POST /api/staff/research/interpret — interpret the printed results of an analysis that ran in the browser.
// Body: { question, lang, plan: { title, approach, python }, stdout, charts } → { text }
import { forbidden, getStaff, isResearcher, unauthorized } from "@/lib/auth";
import { interpretResults, type ResearchPlan } from "@/lib/researchAgent";
import { logUsage } from "@/lib/limits";

export const maxDuration = 120;

export async function POST(req: Request) {
  const staff = await getStaff();
  if (!staff) return unauthorized();
  if (!isResearcher(staff)) return forbidden();
  const body = (await req.json().catch(() => ({}))) as { question?: string; lang?: string; plan?: ResearchPlan; stdout?: string; charts?: number };
  if (!body.question || !body.plan) return Response.json({ error: "Missing question or plan" }, { status: 400 });
  try {
    const r = await interpretResults({ question: body.question, lang: body.lang === "ar" ? "ar" : "he", plan: body.plan, stdout: body.stdout ?? "", charts: body.charts ?? 0 });
    void logUsage("research", r.model, r.usage as never, { staffId: staff.id });
    return Response.json({ text: r.text });
  } catch (e) {
    console.error("interpret failed", e);
    return Response.json({ error: "לא הצלחתי לפרש את התוצאות. נסו שוב." }, { status: 500 });
  }
}
