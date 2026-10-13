// Staff (teacher / researcher / admin) login: scrypt password hashes + a signed, httpOnly cookie.
// Students never log in with a password — they use class code + nickname.
import "server-only";
import { cookies } from "next/headers";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "teacher" | "researcher" | "admin";
export type StaffSession = { id: string; role: Role; name: string; email: string; exp: number };

const COOKIE = "max_staff";
const TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET is missing or shorter than 16 characters");
  return s;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, saltB64, hashB64] = stored.split("$");
  if (alg !== "scrypt" || !saltB64 || !hashB64) return false;
  const hash = Buffer.from(hashB64, "base64");
  const test = scryptSync(password, Buffer.from(saltB64, "base64"), hash.length);
  return timingSafeEqual(hash, test);
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

function encode(session: StaffSession): string {
  const data = Buffer.from(JSON.stringify(session)).toString("base64url");
  return `${data}.${sign(data)}`;
}

function decode(token: string): StaffSession | null {
  const [data, sig] = token.split(".");
  if (!data || !sig) return null;
  const expected = sign(data);
  if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    const s = JSON.parse(Buffer.from(data, "base64url").toString()) as StaffSession;
    return s.exp > Date.now() ? s : null;
  } catch {
    return null;
  }
}

export async function getStaff(): Promise<StaffSession | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  return token ? decode(token) : null;
}

export async function startStaffSession(user: { id: string; role: Role; name: string; email: string }) {
  const session: StaffSession = { ...user, exp: Date.now() + TTL_MS };
  (await cookies()).set(COOKIE, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function endStaffSession() {
  (await cookies()).delete(COOKIE);
}

export function isResearcher(s: StaffSession): boolean {
  return s.role === "researcher" || s.role === "admin";
}

// Teachers see only their own classes; researchers and admins see all.
export function canSeeClass(s: StaffSession, cls: { teacher_id: string | null }): boolean {
  return isResearcher(s) || cls.teacher_id === s.id;
}

export function unauthorized() {
  return Response.json({ error: "צריך להתחבר מחדש" }, { status: 401 });
}

export function forbidden() {
  return Response.json({ error: "אין לך הרשאה לצפות בזה" }, { status: 403 });
}

// Admin endpoints (creating staff accounts) are protected by a shared secret.
export function checkAdminSecret(given: string | null | undefined): boolean {
  const s = process.env.ADMIN_SECRET;
  if (!s || !given) return false;
  const a = Buffer.from(s);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}
