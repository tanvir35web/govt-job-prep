"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertIcon, GraduationCapIcon } from "../icons";

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
          ? "ইউজারনেম বা পাসওয়ার্ড ভুল।"
          : res.status === 429
            ? "অনেকবার ভুল চেষ্টা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন।"
            : res.status === 503
              ? "সার্ভারে অ্যাডমিন লগইন সেট করা নেই (.env-এ ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_SESSION_SECRET দিন)।"
              : "লগইন করা যায়নি। আবার চেষ্টা করুন।",
      );
    } catch {
      setError("সার্ভারের সাথে যোগাযোগ করা যায়নি।");
    }
    setSubmitting(false);
  }

  const inputClass =
    "mt-1.5 h-12 w-full rounded-xl border border-stone-300 bg-white px-4 text-base outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 dark:border-stone-700 dark:bg-stone-950";

  return (
    <main className="grid min-h-[calc(100vh-8rem)] place-items-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg shadow-emerald-900/20">
            <GraduationCapIcon className="size-7" />
          </span>
          <h1 className="mt-5 text-2xl font-bold">অ্যাডমিন লগইন</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">পরীক্ষা আপলোড ও পরিচালনা করতে লগইন করুন</p>
        </div>

        <form
          onSubmit={onSubmit}
          className="mt-8 space-y-4 rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8 dark:border-stone-800 dark:bg-stone-900"
        >
          {error && (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
              <AlertIcon className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          )}
          <label className="block text-sm font-medium">
            ইউজারনেম
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
          <label className="block text-sm font-medium">
            পাসওয়ার্ড
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className={`${inputClass} pr-20`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute top-1/2 right-2 mt-0.75 -translate-y-1/2 rounded-lg px-2.5 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                {showPassword ? "লুকান" : "দেখুন"}
              </button>
            </div>
          </label>
          <button
            type="submit"
            disabled={submitting}
            className="h-12 w-full rounded-xl bg-emerald-600 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? "লগইন হচ্ছে..." : "লগইন"}
          </button>
        </form>
      </div>
    </main>
  );
}
