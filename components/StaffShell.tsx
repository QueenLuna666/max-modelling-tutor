"use client";
// Frame for staff pages: who is signed in, role, sign-out. Also a fetch hook that sends you to login on 401.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackButton } from "./BackButton";
import { LangSwitch, useStaffLang } from "@/lib/staffLang";

export type Me = { id: string; name: string; email: string; role: "teacher" | "researcher" | "admin" };
const ROLE_LABEL: Record<Me["role"], [string, string]> = {
  teacher: ["מורה", "معلّم/ة"],
  researcher: ["חוקר/ת", "باحث/ة"],
  admin: ["מנהל/ת", "مدير/ة"],
};

export function useStaffData<T>(url: string | null, refreshMs = 0) {
  const router = useRouter();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then(async (r) => {
        if (cancelled) return;
        if (r.status === 401) {
          router.replace("/staff/login");
          return;
        }
        const d = await r.json().catch(() => ({}));
        if (cancelled) return;
        if (!r.ok) setError(d.error ?? "שגיאה בטעינה");
        else {
          setError("");
          setData(d);
        }
      })
      .catch(() => !cancelled && setError("אין חיבור לשרת"));
    return () => {
      cancelled = true;
    };
  }, [url, tick, router]);

  useEffect(() => {
    if (!refreshMs) return;
    const t = setInterval(() => setTick((n) => n + 1), refreshMs);
    return () => clearInterval(t);
  }, [refreshMs]);

  return { data, error, reload };
}

export function StaffShell({
  crumbs,
  children,
}: {
  crumbs?: { href?: string; label: string }[];
  children: (me: Me) => React.ReactNode;
}) {
  const router = useRouter();
  const { data: me } = useStaffData<Me>("/api/staff/me");
  const { L } = useStaffLang();

  async function logout() {
    await fetch("/api/staff/logout", { method: "POST" });
    router.replace("/staff/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <nav className="flex flex-wrap items-center gap-2 text-sm">
            <BackButton fallback="/staff" label={L("חזרה", "رجوع")} className="me-1 py-1" />
            <Link href="/staff" className="font-bold text-accent">
              MAX
            </Link>
            {crumbs?.map((c, i) => (
              <span key={i} className="flex items-center gap-2 text-muted">
                <span aria-hidden>/</span>
                {c.href ? (
                  <Link href={c.href} className="hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span className="text-ink">{c.label}</span>
                )}
              </span>
            ))}
          </nav>
          {me && (
            <div className="flex items-center gap-3 text-sm">
              <Link href="/staff" className="rounded-lg px-2 py-1 hover:bg-paper">
                {L("כיתות", "الصفوف")}
              </Link>
              <Link href="/staff/studio" className="rounded-lg bg-accent-soft px-2.5 py-1 font-medium text-accent-strong hover:bg-accent/15">
                ✨ {L("סטודיו משימות", "استوديو المهام")}
              </Link>
              <LangSwitch />
              <span aria-hidden className="text-line">|</span>
              <span>
                {me.name} · <span className="text-muted">{L(...ROLE_LABEL[me.role])}</span>
              </span>
              <button type="button" onClick={logout} className="rounded-lg border border-line px-3 py-1 hover:bg-paper">
                {L("יציאה", "خروج")}
              </button>
            </div>
          )}
          {!me && <LangSwitch />}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{me ? children(me) : <p className="text-muted">{L("טוען…", "جارٍ التحميل…")}</p>}</main>
    </div>
  );
}

export function isResearcherRole(role: Me["role"]) {
  return role === "researcher" || role === "admin";
}
