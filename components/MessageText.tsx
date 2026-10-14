"use client";
// Chat text as MAX and the students write it:
//  - formula lines are shown left-to-right on their own line (the hint guidelines put every formula
//    on a separate line; without this, "38,400 ÷ 48 = 800" is reversed in a right-to-left message);
//  - ```svg blocks are MAX's drawings (a wheel with radius and circumference, a mechanism, a graph),
//    sanitised before they are shown.
import { useMemo } from "react";
import DOMPurify from "dompurify";

import { isFormulaLine, splitParts } from "@/lib/messageFormat";

function Drawing({ svg }: { svg: string }) {
  const clean = useMemo(() => {
    if (typeof window === "undefined") return "";
    return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true, svgFilters: false }, FORBID_TAGS: ["foreignObject", "image", "use", "a"] });
  }, [svg]);
  if (!clean.includes("<svg")) return null;
  return (
    <figure
      className="my-2 overflow-hidden rounded-xl border border-line bg-white p-2 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-h-72 [&_svg]:w-full [&_svg]:max-w-md"
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}

function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) =>
        isFormulaLine(line) ? (
          <span key={i} dir="ltr" className="my-1 block max-w-full overflow-x-auto rounded-lg bg-paper/70 px-2 py-1 text-center font-mono text-[0.95em] whitespace-nowrap text-ink [overflow-wrap:normal] [unicode-bidi:isolate]">
            {line.trim()}
          </span>
        ) : (
          <span key={i} className="block min-h-[1em] [overflow-wrap:anywhere]">
            {line}
          </span>
        ),
      )}
    </>
  );
}

export function MessageText({ text, drawingLabel = "✏️ MAX מצייר…" }: { text: string; drawingLabel?: string }) {
  const parts = splitParts(text);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "svg" ? (
          <Drawing key={i} svg={p.svg} />
        ) : p.kind === "drawing" ? (
          <span key={i} className="my-2 block animate-pulse rounded-xl border border-dashed border-accent/40 px-3 py-6 text-center text-sm text-muted">
            {drawingLabel}
          </span>
        ) : (
          <Lines key={i} text={p.text.replace(/^\n+|\n+$/g, "")} />
        ),
      )}
    </>
  );
}
