"use client";
// Opening staff accounts (teachers / researchers). Protected by ADMIN_SECRET from the Vercel settings.
import { useState } from "react";
import { BackButton } from "@/components/BackButton";
import { LangSwitch, useStaffLang } from "@/lib/staffLang";

type Staff = { id: string; email: string; name: string; role: string; created_at: string };
const ROLE_LABEL: Record<string, [string, string]> = {
  teacher: ["מורה", "معلّم/ة"],
  researcher: ["חוקר/ת", "باحث/ة"],
  admin: ["מנהל/ת", "مدير/ة"],
};

export default function AdminPage() {
  const [secret, setSecret] = useState("");
  const [list, setList] = useState<Staff[] | null>(null);
  const [form, setForm] = useState({ email: "", name: "", role: "teacher", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const { L } = useStaffLang();

  async function load(s = secret) {
    const r = await fetch("/api/admin/staff", { headers: { "x-admin-secret": s } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setMsg({ ok: false, text: d.error ?? L("שגיאה", "خطأ") });
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
    if (!r.ok) setMsg({ ok: false, text: d.error ?? L("שגיאה", "خطأ") });
    else {
      setMsg({ ok: true, text: L(`החשבון של ${d.staff.name} מוכן. הכניסה: ${d.staff.email} עם הסיסמה שהגדרת.`, `حساب ${d.staff.name} جاهز. الدخول: ${d.staff.email} بكلمة المرور التي حدّدتها.`) });
      setForm({ email: "", name: "", role: form.role, password: "" });
      load();
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <div className="flex items-center justify-between">
        <BackButton fallback="/" label={L("חזרה", "رجوع")} />
        <LangSwitch />
      </div>
      <div>
        <h1 className="mt-2 text-2xl font-bold">{L("ניהול חשבונות צוות", "إدارة حسابات الطاقم")}</h1>
        <p className="mt-1 text-sm text-muted">
          {L("פתיחת חשבונות למורים ולחוקרות. אם המייל כבר קיים, החשבון מתעדכן (כולל הסיסמה).", "فتح حسابات للمعلّمين والباحثات. إذا كان البريد موجودًا، يُحدَّث الحساب (بما في ذلك كلمة المرور).")}
        </p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          load();
        }}
        className="flex flex-wrap items-end gap-2 rounded-2xl border border-line bg-surface p-4"
      >
        <label className="block flex-1 space-y-1">
          <span className="text-sm">{L("סיסמת מנהל (ADMIN_SECRET)", "كلمة مرور المدير (ADMIN_SECRET)")}</span>
          <input id="adminSecret" type="password" dir="ltr" value={secret} onChange={(e) => setSecret(e.target.value)} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
        </label>
        <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white">
          {L("כניסה", "دخول")}
        </button>
      </form>

      {msg && <p className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}>{msg.text}</p>}

      {list && (
        <>
          <form onSubmit={create} className="grid gap-3 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-2">
            <h2 className="font-semibold sm:col-span-2">{L("חשבון חדש", "حساب جديد")}</h2>
            <label className="block space-y-1">
              <span className="text-sm">{L("שם", "الاسم")}</span>
              <input id="staffName" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">{L("מייל", "البريد الإلكتروني")}</span>
              <input id="staffEmail" type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <label className="block space-y-1">
              <span className="text-sm">{L("תפקיד", "الدور")}</span>
              <select id="staffRole" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2">
                <option value="teacher">{L("מורה: הכיתות שלה בלבד", "معلّم/ة: صفوفه/ها فقط")}</option>
                <option value="researcher">{L("חוקר/ת: כל הכיתות + קובץ הניתוח", "باحث/ة: كل الصفوف + ملف التحليل")}</option>
                <option value="admin">{L("מנהל/ת: כמו חוקר/ת", "مدير/ة: مثل الباحث/ة")}</option>
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-sm">{L("סיסמה (לפחות 8 תווים)", "كلمة المرور (8 أحرف على الأقل)")}</span>
              <input id="staffPassword" dir="ltr" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full rounded-lg border border-line bg-paper px-3 py-2" />
            </label>
            <button type="submit" className="rounded-lg bg-accent px-4 py-2 font-medium text-white sm:col-span-2">
              {L("פתיחת חשבון", "فتح حساب")}
            </button>
          </form>

          <section>
            <h2 className="mb-2 font-semibold">{L("חשבונות קיימים", "حسابات موجودة")}</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
              {list.length === 0 && <li className="px-4 py-3 text-sm text-muted">{L("עוד אין חשבונות.", "لا توجد حسابات بعد.")}</li>}
              {list.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span>
                    {s.name} <span className="text-muted">· {ROLE_LABEL[s.role] ? L(...ROLE_LABEL[s.role]) : s.role}</span>
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
