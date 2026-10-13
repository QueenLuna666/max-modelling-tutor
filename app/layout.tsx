import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAX — מודלים מתמטיים",
  description: "MAX מלווה תלמידים במשימות מידול מתמטי, ומראה למורים ולחוקרים את תהליך החשיבה.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
