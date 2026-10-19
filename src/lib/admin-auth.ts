import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { connection } from "next/server";

export const ADMIN_COOKIE = "admin_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12; // 12 hours

type AdminConfig = { username: string; password: string; secret: string };

function getConfig(): AdminConfig | null {
  const { ADMIN_USERNAME: username, ADMIN_PASSWORD: password, ADMIN_SESSION_SECRET: secret } = process.env;
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

export function isAdminConfigured(): boolean {
  return getConfig() !== null;
}

// Hash first so timingSafeEqual gets equal-length buffers and the comparison
// doesn't leak the length or content of the expected value.
function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function checkCredentials(username: string, password: string): boolean {
  const config = getConfig();
  if (!config) return false;
  const userOk = safeEqual(username, config.username);
  const passOk = safeEqual(password, config.password);
  return userOk && passOk;
}

// The signing key includes the password, so changing ADMIN_PASSWORD (or the secret)
// invalidates every existing session.
function sign(payload: string, config: AdminConfig): string {
  return createHmac("sha256", `${config.secret}:${config.password}`).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const config = getConfig();
  if (!config) throw new Error("Admin credentials are not configured.");
  const payload = `admin.${Date.now() + SESSION_TTL_SECONDS * 1000}`;
  return `${payload}.${sign(payload, config)}`;
}

export function verifySessionToken(token: string | undefined): boolean {
  const config = getConfig();
  if (!config || !token) return false;
  const dot = token.lastIndexOf(".");
  if (dot === -1) return false;
  const payload = token.slice(0, dot);
  if (!safeEqual(token.slice(dot + 1), sign(payload, config))) return false;
  const expiresAt = Number(payload.split(".")[1]);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/",
  maxAge: SESSION_TTL_SECONDS,
};

export async function isAdmin(): Promise<boolean> {
  // The expiry check reads Date.now(), and an auth decision must never be
  // prerendered or prefetched, so wait for the real request first.
  await connection();
  const store = await cookies();
  return verifySessionToken(store.get(ADMIN_COOKIE)?.value);
}
