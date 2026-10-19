import { AlertIcon, ResetIcon, WifiOffIcon } from "./icons";
import { AppLink } from "./AppLink";

export function ErrorState({
  title,
  message,
  onRetry,
  showHomeLink = false,
  offline = false,
}: {
  title: string;
  message: string;
  onRetry?: () => void;
  showHomeLink?: boolean;
  offline?: boolean;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-fill text-secondary">
        {offline ? <WifiOffIcon className="size-8" /> : <AlertIcon className="size-8" />}
      </span>
      <h2 className="mt-5 text-[20px] font-semibold">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-secondary">{message}</p>
      <div className="mt-7 grid w-full gap-2.5">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="pressable inline-flex h-[50px] items-center justify-center gap-2 rounded-[14px] bg-tint text-[17px] font-semibold text-white dark:text-black"
          >
            <ResetIcon className="size-5" /> আবার চেষ্টা করুন
          </button>
        )}
        {showHomeLink && (
          <AppLink
            href="/"
            className="pressable inline-flex h-[50px] items-center justify-center rounded-[14px] bg-fill text-[17px] font-semibold text-tint"
          >
            সব পরীক্ষা
          </AppLink>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-fill ${className}`} />;
}
