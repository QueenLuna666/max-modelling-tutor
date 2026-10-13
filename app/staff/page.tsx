"use client";
import { useState } from "react";
import Link from "next/link";
import { isResearcherRole, StaffShell, useStaffData } from "@/components/StaffShell";

type ClassCard = { id: string; code: string; name: string | null; teacher: string | null; students: number; sessions: number; active: number };

export default function StaffHome() {
  return <StaffShell>{(me) => <Classes researcher={isResearcherRole(me.role)} />}</StaffShell>;
}

function Classes({ researcher }: { researcher: boolean }) {
  const { data, error, reload } = useStaffData<{ classes: ClassCard[] }>("/api/staff/classes");
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const r = await fetch("/api/staff/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, code }),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setMsg(d.error ?? "שגיאה");
    else {
      setMsg(`נפתחה כיתה "${d.class.name}". קוד הכניסה לתלמידים: ${d.class.code}`);
      setName("");
      setCode("");
      reload();
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
      <section>
        <h1 className="mb-1 text-2xl font-bold">{researcher ? "כל הכיתות" : "הכיתות שלי"}</h1>
        <p className="mb-5 text-sm text-muted">לחיצה על כיתה פותחת את הדשבורד שלה.</p>
        {error && <p className="text-warn">{error}</p>}
        {!data ? (
          <p className="text-muted">טוען…</p>
        ) : data.classes.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-6 text-muted">עוד אין כיתות. אפשר לפתוח כיתה בטופס שבצד.</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.classes.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/staff/class/${c.id}`}
                  className="block rounded-2xl border border-line bg-surface p-5 transition hover:border-accent hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{c.name ?? c.code}</h2>
                    <span dir="ltr" className="rounded-md bg-paper px-2 py-0.5 font-mono text-sm tracking-wider">
                      {c.code}
                    </span>
                  </div>
                  {researcher && <p className="mt-1 text-xs text-muted">מורה: {c.teacher ?? "—"}</p>}
                  <dl className="tabular mt-4 grid grid-cols-3 gap-2 text-center text-sm">
                    <Stat label="תלמידים" value={c.students} />
                    <Stat label="משימות" value={c.sessions} />
                    <Stat label="פעילים עכשיו" value={c.active} highlight={c.active > 0} />
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside>
        <form onSubmit={create} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-semibold">פתיחת כיתה חדשה</h2>
          <label className="block space-y-1">
            <span className="text-sm">שם הכיתה</span>
            <input id="className" value={name} onChange={(e) => setName(e.target.value)} placeholder="ח׳2 — מתמטיקה" className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
          </label>
          <label className="block space-y-1">
            <span className="text-sm">קוד כניסה (לא חובה)</span>
            <input id="classCodeNew" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ייווצר אוטומטית" className="w-full rounded-lg border border-line bg-paper px-3 py-2 uppercase" />
          </label>
          <button type="submit" disabled={!name.trim()} className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-white disabled:opacity-40">
            פתיחה
          </button>
          {msg && <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent-strong">{msg}</p>}
        </form>
      </aside>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-2 py-2 ${highlight ? "bg-accent-soft text-accent-strong" : "bg-paper"}`}>
      <dd className="text-lg font-semibold">{value}</dd>
      <dt className="text-[11px] text-muted">{label}</dt>
    </div>
  );
}
