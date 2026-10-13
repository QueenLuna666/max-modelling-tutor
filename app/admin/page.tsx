"use client";
// Opening staff accounts (teachers / researchers). Protected by ADMIN_SECRET from the Vercel settings.
import { useState } from "react";
import Link from "next/link";

type Staff = { id: string; email: string; name: string; role: string; created_at: string };
const ROLE_LABEL: Record<string, string> = { teacher: "מורה", researcher: "חוקר/ת", admin: "מנהל/ת" };

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [list, setList] = useState<Staff[] | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "teacher", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load(s = secret) {
    const r = await fetch("/api/admin/staff", { headers: { "x-admin-secret": s } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg({ ok: false, text: d.error ?? "שגיאה" });
      setList(null);
    } else {
      setMsg(null);
      setList(d.staff);
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-secret": secret },
      body: JSON.stringify(form),
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) setMsg({ ok: false, text: d.error ?? "שגיאה" });
    else {
      setMsg({ ok: true, text: `החשבון של ${d.staff.name} מוכן. הכניסה: ${d.staff.email} עם הסיסמה שהגדרת.` });
      setForm({ email: "", name: "", role: form.role, password: "" });
      load();
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div>
        <Link href="/" className="text-sm text-muted hover:underline">
          ← MAX
        </Link>
        <h1 className="mt-2 text-2xl font-bold">ניהול חשבונות צוות</h1>
        <p className="mt-1 text-sm text-muted">פתיחת חשבונות למורים ולחוקרות. אם המייל כבר קיים, החשבון מתעדכן (כולל הסיסמה).</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4"
      >
        <label className="block flex-1 space-y-1">
          <span className="text-sm">סיסמת מנהל (ADMIN_SECRET)</span>
          <input id="adminSecret" type="password" dir="ltr" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
          כניסה
        </button>
      </form>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{msg.text}</p>}

      {list && (
        <>
          <form onSubmit={create} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">חשבון חדש</h2>
            <label className="block space-y-1">
              <span className="text-sm">שם</span>
              <input id="staffName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">מייל</span>
              <input id="staffEmail" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">תפקיד</span>
              <select id="staffRole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2">
                <option value="teacher">מורה: הכיתות שלה בלבד</option>
                <option value="researcher">חוקר/ת: כל הכיתות + קובץ הניתוח</option>
                <option value="admin">מנהל/ת: כמו חוקר/ת</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm">סיסמה (לפחות 8 תווים)</span>
              <input id="staffPassword" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white sm:col-span-2">
              פתיחת חשבון
            </button>
          </form>

          <section>
            <h2 className="mb-2 font-semibold">חשבונות קיימים</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">עוד אין חשבונות.</li>}
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    {s.name} <span className="text-muted">· {ROLE_LABEL[s.role] ?? s.role}</span>
                  </span>
                  <span dir="ltr" className="text-muted">
                    {s.email}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
