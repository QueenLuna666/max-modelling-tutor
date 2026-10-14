// Renders the small Markdown subset the summaries and answers use: ### headings, "- " bullets, **bold**,
// and simple pipe tables (| a | b |).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((p, i) =>
    p.startsWith("**") && p.endsWith("**") ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

export function MiniMarkdown({ text }: { text: string }) {
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  let table: string[][] = [];
  const cells = (line: string) => line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const flushTable = () => {
    if (!table.length) return;
    const [head, ...rows] = table;
    blocks.push(
      <div key={blocks.length} className="overflow-x-auto">
        <table className="w-full border-collapse text-start text-sm">
          <thead>
            <tr>
              {head.map((c, i) => (
                <th key={i} className="border-b border-line px-2 py-1.5 text-start font-semibold">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-line/60 align-top">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1.5">
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
    );
    table = [];
  };
  const flush = () => {
    flushTable();
    if (list.length) {
      blocks.push(
        <ul key={blocks.length} className="list-disc space-y-1 ps-5">
          {list.map((l, i) => (
            <li key={i}>{inline(l)}</li>
          ))}
        </ul>,
      );
      list = [];
    }
  };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) {
      flush();
      continue;
    }
    if (line.startsWith("|") && line.endsWith("|")) {
      if (list.length) {
        const t = table;
        table = [];
        flush();
        table = t;
      }
      // the |---|---| separator row
      if (!/^\|[\s:|-]+\|$/.test(line)) table.push(cells(line));
      continue;
    }
    flushTable();
    if (/^[-*•]\s+/.test(line)) {
      list.push(line.replace(/^[-*•]\s+/, ""));
      continue;
    }
    flush();
    const h = line.match(/^#{1,4}\s+(.*)$/);
    if (h) blocks.push(<h3 key={blocks.length} className="mt-3 font-semibold text-accent-strong first:mt-0">{inline(h[1])}</h3>);
    else blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="space-y-1.5 text-sm leading-relaxed">{blocks}</div>;
}
