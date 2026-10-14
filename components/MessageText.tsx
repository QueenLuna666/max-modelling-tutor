// Chat text with formula lines shown left-to-right on their own line (the hint guidelines put every
// formula on a separate line). Without this, a line like "38,400 ÷ 48 = 800" is reversed in a
// right-to-left message.
const RTL_LETTERS = /[֐-׿؀-ۿ]/;
const MATHY = /[=×÷+*/^√π<>≈−-]/;

export function isFormulaLine(line: string) {
  const t = line.trim();
  return t.length > 0 && t.length <= 120 && !RTL_LETTERS.test(t) && MATHY.test(t) && /[\p{L}\d]/u.test(t);
}

export function MessageText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) =>
        isFormulaLine(line) ? (
          <span key={i} dir="ltr" className="my-1 block rounded-lg bg-paper/70 px-2 py-1 text-center font-mono text-[0.95em] text-ink [unicode-bidi:isolate]">
            {line.trim()}
          </span>
        ) : (
          <span key={i} className="block min-h-[1em]">
            {line}
          </span>
        ),
      )}
    </>
  );
}
