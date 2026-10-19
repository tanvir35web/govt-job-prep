import Link from "next/link";
import { AlertIcon, ArrowLeftIcon, ResetIcon } from "./icons";

export function ErrorState({
  title,
  message,
  onRetry,
  showHomeLink = false,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center rounded-3xl border border-stone-200 bg-white px-6 py-12 text-center shadow-sm dark:border-stone-800 dark:bg-stone-900">
      <span className="grid size-14 place-items-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
        <AlertIcon className="size-7" />
      </span>
      <h2 className="mt-5 text-lg font-semibold">{title}</h2>
      <p className="mt-2 text-sm text-stone-500 dark:text-stone-400">{message}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
          >
            <ResetIcon className="size-4" /> আবার চেষ্টা করুন
          </button>
        )}
        {showHomeLink && (
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-stone-300 px-5 py-2.5 text-sm font-medium transition hover:bg-stone-100 dark:border-stone-700 dark:hover:bg-stone-800"
          >
            <ArrowLeftIcon className="size-4" /> সব পরীক্ষা
          </Link>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-stone-200/80 dark:bg-stone-800 ${className}`} />;
}
