"use client";
// Big class code + QR for the board: students scan it and land on the login with the code filled in.
import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function ClassQr({ code }: { code: string }) {
  const [svg, setSvg] = useState("");
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = `${window.location.origin}/student?code=${encodeURIComponent(code)}`;
    QRCode.toString(u, { type: "svg", margin: 1, color: { dark: "#1a2330", light: "#ffffff" } }).then((s) => {
      setUrl(u);
      setSvg(s);
    });
  }, [code]);
  return (
    <div className="text-center">
      <div className="mx-auto w-full max-w-[320px] rounded-xl bg-white p-3" aria-label="QR" dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="mt-4 text-sm text-muted">או היכנסו לאתר והקלידו את הקוד:</p>
      <p dir="ltr" className="mt-1 font-mono text-5xl font-bold tracking-[0.2em] text-ink">
        {code}
      </p>
      <p dir="ltr" className="mt-3 text-xs break-all text-muted">{url}</p>
    </div>
  );
}
