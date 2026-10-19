"use client";

import { useOnline } from "@/lib/offline";
import { WifiOffIcon } from "./icons";

export function OfflineBadge({ className = "" }: { className?: string }) {
  const online = useOnline();
  if (online) return null;

  return (
    <span className={`inline-flex animate-fade-in items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-secondary ${className}`}>
      <WifiOffIcon className="size-3.5" /> অফলাইন
    </span>
  );
}
