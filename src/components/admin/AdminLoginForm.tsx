"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon } from "../icons";

export function AdminLoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/admin");
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? "Incorrect username or password."
          : res.status === 429
            ? "Too many failed attempts. Try again in 15 minutes."
            : res.status === 503
              ? "Admin sign-in is not set up on the server (set ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_SESSION_SECRET in .env)."
              : "Couldn't sign in. Try again.",
      );
    } catch {
      setError("Couldn't reach the server.");
    }
    setSubmitting(false);
  }

  const inputClass =
    "mt-1 h-10 w-full rounded-md border border-stone-300 bg-transparent px-3 text-sm outline-none transition focus:border-stone-900 dark:border-stone-700 dark:focus:border-stone-100";

  return (
    <main className="grid min-h-[calc(100vh-8rem)] place-items-center px-4 py-12">
      <div className="w-full max-w-xs">
        <h1 className="text-xl font-semibold">Admin Sign In</h1>
        <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">Manage exams</p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-rose-600 dark:text-rose-400">
              <AlertIcon className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            Username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              className={inputClass}
            />
          </label>
          <label className="block text-sm text-stone-600 dark:text-stone-400">
            Password
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={`${inputClass} pr-14`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-3 mt-0.5 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="h-10 w-full rounded-md bg-stone-900 text-sm font-medium text-white transition hover:bg-stone-700 disabled:opacity-50 dark:bg-stone-100 dark:text-stone-900 dark:hover:bg-stone-300"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
