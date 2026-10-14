"use client";
import { Suspense, useState } from "react";
import { BackButton } from "@/components/BackButton";
import { LangSwitch, useStaffLang } from "@/lib/staffLang";
import { useRouter, useSearchParams } from "next/navigation";

type Door = "teacher" | "researcher";

export default function StaffLoginPage() {
  return (
    <Suspense>
      <StaffLogin />
    </Suspense>
  );
}

// Two doors: teachers (dashboards, follow students) and researchers (also analyses, coding and research files).
function StaffLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const [door, setDoor] = useState<Door>(params.get("as") === "researcher" ? "researcher" : "teacher");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { L, lang } = useStaffLang();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, as: door, lang }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(r.status === 401 ? L("מייל או סיסמה שגויים", "البريد أو كلمة المرور غير صحيحة") : (d.error ?? L("הכניסה נכשלה", "فشل الدخول")));
    else router.replace("/staff");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <BackButton fallback="/" label={L("חזרה", "رجوع")} />
        <LangSwitch />
      </div>
      <div role="tablist" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-line">
        {(["teacher", "researcher"] as const).map((d) => (
          <button
            key={d}
            role="tab"
            type="button"
            aria-selected={door === d}
            onClick={() => {
              setDoor(d);
              setError("");
            }}
            className={`rounded-xl px-3 py-2 font-display font-semibold ${door === d ? "bg-accent text-white" : "text-muted hover:text-ink"}`}
          >
            {d === "teacher" ? L("מורים", "المعلّمون") : L("חוקרות", "الباحثات")}
          </button>
        ))}
      </div>
      <h1 className="mb-1 text-2xl font-bold">{door === "teacher" ? L("כניסת מורים", "دخول المعلّمين") : L("כניסת חוקרות", "دخول الباحثات")}</h1>
      <p className="mb-6 text-sm text-muted">
        {door === "teacher"
          ? L("הכיתות שלך, מעקב אחרי התלמידים בזמן אמת וסיכומים.", "صفوفك، ومتابعة الطلاب في الوقت الحقيقي، وملخّصات.")
          : L("כל הכיתות, הניתוח המלא, סטודיו המשימות וקבצי המחקר.", "كل الصفوف، والتحليل الكامل، واستوديو المهام، وملفات البحث.")}
      </p>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{L("מייל", "البريد الإلكتروني")}</span>
          <input
            id="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">{L("סיסמה", "كلمة المرور")}</span>
          <input
            id="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-line bg-paper px-3 py-2.5"
          />
        </label>
        {error && <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm text-warn">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {busy ? L("מתחבר/ת…", "جارٍ الدخول…") : L("כניסה", "دخول")}
        </button>
      </form>
    </main>
  );
}
