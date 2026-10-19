import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { failure, success } from "@/lib/api-response";
import { ADMIN_COOKIE, checkCredentials, createSessionToken, isAdminConfigured, sessionCookieOptions } from "@/lib/admin-auth";
import { resetTokens, takeToken } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

// POST /api/admin/login  { username, password }
export async function POST(request: NextRequest) {
  if (!isAdminConfigured()) {
    return failure("Admin login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET.", 503);
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const limit = takeToken(`login:${ip}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!limit.allowed) {
    return Response.json(
      { status: "error", code: 429, message: "Too many login attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!checkCredentials(username, password)) {
    return failure("Invalid username or password.", 401);
  }

  resetTokens(`login:${ip}`);
  (await cookies()).set(ADMIN_COOKIE, createSessionToken(), sessionCookieOptions);
  return success("Logged in.", {});
}
