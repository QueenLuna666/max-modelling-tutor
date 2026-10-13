"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function StaffLogin() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const r = await fetch("/api/staff/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setError(d.error ?? "הכניסה נכשלה");
    else router.replace("/staff");
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-6 text-sm text-muted hover:underline">
        ← MAX
      </Link>
      <h1 className="mb-1 text-2xl font-bold">כניסת צוות</h1>
      <p className="mb-6 text-sm text-muted">מורים וחוקרים. את החשבון פותח/ת מנהל/ת המערכת.</p>
      <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-surface p-6">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">מייל</span>
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
          <span className="text-sm font-medium">סיסמה</span>
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
          {busy ? "מתחבר/ת…" : "כניסה"}
        </button>
      </form>
    </main>
  );
}
