"use client";
// Runs the research assistant's Python in the browser with Pyodide (pandas + matplotlib).
// Nothing is sent anywhere: the data and the code stay in the researcher's browser.

const PYODIDE_URL = "https://cdn.jsdelivr.net/pyodide/v0.27.2/full/";

type Pyodide = {
  loadPackage: (pkgs: string[]) => Promise<void>;
  runPythonAsync: (code: string) => Promise<unknown>;
  setStdout: (o: { batched: (s: string) => void }) => void;
  setStderr: (o: { batched: (s: string) => void }) => void;
  FS: { writeFile: (path: string, data: string) => void };
};

let loading: Promise<Pyodide> | null = null;

export function loadPython(onStage?: (s: string) => void): Promise<Pyodide> {
  if (loading) return loading;
  loading = (async () => {
    onStage?.("python");
    const w = window as unknown as { loadPyodide?: (o: { indexURL: string }) => Promise<Pyodide> };
    if (!w.loadPyodide) {
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement("script");
        s.src = `${PYODIDE_URL}pyodide.js`;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error("Could not load Python (Pyodide)"));
        document.head.appendChild(s);
      });
    }
    const py = await w.loadPyodide!({ indexURL: PYODIDE_URL });
    onStage?.("packages");
    await py.loadPackage(["pandas", "matplotlib"]);
    return py;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}

export type RunResult = { stdout: string; charts: string[]; error: string | null };

export async function runAnalysis(py: Pyodide, code: string, files: Record<string, string>): Promise<RunResult> {
  for (const [name, content] of Object.entries(files)) py.FS.writeFile(name, content);
  const out: string[] = [];
  py.setStdout({ batched: (s) => out.push(s) });
  py.setStderr({ batched: (s) => out.push(s) });
  await py.runPythonAsync(`
import matplotlib
matplotlib.use("AGG")
import matplotlib.pyplot as plt
plt.close("all")
plt.rcParams.update({"figure.dpi": 110, "font.size": 10})
`);
  let error: string | null = null;
  try {
    await py.runPythonAsync(code);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const charts = (await py.runPythonAsync(`
import io, base64
_imgs = []
for _n in plt.get_fignums():
    _buf = io.BytesIO()
    plt.figure(_n).savefig(_buf, format="png", bbox_inches="tight")
    _imgs.append(base64.b64encode(_buf.getvalue()).decode())
plt.close("all")
"\\n".join(_imgs)
`)) as string;
  return { stdout: out.join("\n"), charts: charts ? charts.split("\n").filter(Boolean).map((b) => `data:image/png;base64,${b}`) : [], error };
}
