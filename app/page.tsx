import Link from "next/link";
import { MaxMascot } from "@/components/MaxMascot";

export default function Home() {
  return (
    <main className="graph-paper min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-12">
        <header className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <MaxMascot size={96} wave />
          <div className="space-y-2">
            <h1 className="font-display text-5xl font-bold text-accent sm:text-6xl">MAX</h1>
            <p className="max-w-[46ch] text-lg leading-relaxed">
              לוקחים מצב מהעולם האמיתי והופכים אותו למודל מתמטי. MAX שואל, מכוון ונותן רמזים, אבל את המודל בונים בעצמכם.
            </p>
            <p lang="ar" className="max-w-[46ch] leading-relaxed text-muted">
              نأخذ موقفًا من الحياة ونحوّله إلى نموذج رياضي. MAX يسأل ويوجّه، لكن النموذج تبنونه أنتم.
            </p>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-[1.4fr_1fr]">
          <Link
            href="/student"
            className="group relative overflow-hidden rounded-3xl border-2 border-ink bg-sun p-6 shadow-[0_5px_0_var(--color-ink)] transition active:translate-y-1 active:shadow-[0_1px_0_var(--color-ink)]"
          >
            <h2 className="text-3xl">כניסה לתלמידים</h2>
            <p lang="ar" className="mt-0.5 font-display text-xl">دخول الطلاب</p>
            <p className="mt-3 text-sm">עם קוד הכיתה והשם שלך · برمز الصف واسمك</p>
            <span className="mt-5 inline-block rounded-full bg-ink px-4 py-1.5 font-display text-sm font-semibold text-white group-hover:bg-accent">
              יאללה, מתחילים
            </span>
            <svg aria-hidden viewBox="0 0 100 100" className="absolute -bottom-6 -left-6 size-32 opacity-25">
              <path d="M10 90 L90 90 L90 10 Z" fill="none" stroke="#1f2347" strokeWidth="6" strokeLinejoin="round" />
              <rect x="74" y="74" width="16" height="16" fill="none" stroke="#1f2347" strokeWidth="5" />
            </svg>
          </Link>
          <Link href="/staff/login" className="group rounded-3xl border border-line bg-surface p-6 transition hover:border-accent">
            <h2 className="text-2xl">כניסת צוות</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              למורים ולחוקרות: הכיתות, השיחות, המסע של כל תלמיד/ה, הסטודיו לבניית משימות וקבצי המחקר.
            </p>
            <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">להתחברות</span>
          </Link>
        </div>

        <p className="text-xs text-muted">מעבדת MtED, הפקולטה לחינוך למדע וטכנולוגיה, הטכניון</p>
      </div>
    </main>
  );
}
