// Message formatting shared by the server and the browser: formula lines and MAX's drawings (svg code blocks).
const RTL_LETTERS = /[֐-׿؀-ۿ]/;
const MATHY = /[=×÷+*/^√π<>≈−-]/;

export function isFormulaLine(line: string) {
  const t = line.trim();
  return t.length > 0 && t.length <= 120 && !RTL_LETTERS.test(t) && MATHY.test(t) && /[\p{L}\d]/u.test(t);
}

type Part = { kind: "text"; text: string } | { kind: "svg"; svg: string } | { kind: "drawing" };

// Split into text and ```svg blocks; an unfinished block (while streaming) becomes a placeholder.
export function splitParts(text: string): Part[] {
  const parts: Part[] = [];
  const re = /```svg\s*([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: "text", text: text.slice(last, m.index) });
    parts.push({ kind: "svg", svg: m[1] });
    last = m.index + m[0].length;
  }
  const rest = text.slice(last);
  const open = rest.indexOf("```svg");
  if (open >= 0) {
    if (open > 0) parts.push({ kind: "text", text: rest.slice(0, open) });
    parts.push({ kind: "drawing" });
  } else if (rest) parts.push({ kind: "text", text: rest });
  return parts;
}

// Text without drawings (for reading aloud and for files).
export function withoutDrawings(text: string, placeholder = "") {
  return text.replace(/```svg[\s\S]*?(```|$)/g, placeholder).trim();
}

