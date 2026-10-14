// Phone numbers identify students inside a class. Stored as digits only, Israeli local format.
// "+972-52-123-4567", "052 1234567" → "0521234567". Returns null if it doesn't look like a phone.
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  return /^0\d{8,9}$/.test(d) ? d : null;
}

// For staff screens: only the last digits, e.g. "•••-4567".
export function maskPhone(p: string | null | undefined): string {
  return p ? `•••-${p.slice(-4)}` : "";
}
