import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-10 px-4 py-12">
      <header className="space-y-3">
        <p className="text-sm font-medium tracking-wide text-accent">מעבדת MtED · הטכניון</p>
        <h1 className="text-4xl font-bold sm:text-5xl">MAX</h1>
        <p className="max-w-[52ch] text-lg text-muted">
          חושבים יחד על משימות מידול מתמטי. MAX שואל, מכוון ונותן רמזים, אבל את המודל בונים בעצמכם.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/student"
          className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-accent hover:shadow-sm"
        >
          <p className="text-sm text-muted">תלמידים · طلاب</p>
          <h2 className="mt-1 text-2xl font-semibold">כניסה למשימות</h2>
          <p className="mt-2 text-sm text-muted">עם קוד הכיתה וכינוי. بدخول برمز الصف واسم مستعار.</p>
          <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">להתחיל ←</span>
        </Link>
        <Link
          href="/staff/login"
          className="group rounded-2xl border border-line bg-surface p-6 transition hover:border-accent hover:shadow-sm"
        >
          <p className="text-sm text-muted">מורים וחוקרים</p>
          <h2 className="mt-1 text-2xl font-semibold">כניסת צוות</h2>
          <p className="mt-2 text-sm text-muted">הכיתות שלך, השיחות, המסע של כל תלמיד והניתוח.</p>
          <span className="mt-4 inline-block text-sm font-medium text-accent group-hover:underline">להתחבר ←</span>
        </Link>
      </div>
    </main>
  );
}
