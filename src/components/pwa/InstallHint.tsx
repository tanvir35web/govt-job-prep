"use client";

import Image from "next/image";
import { useState } from "react";
import { useIsIOS, useStandalone } from "@/lib/offline";
import { ShareIcon, SquarePlusIcon, XIcon } from "../icons";

const DISMISS_KEY = "install-hint-dismissed";

function wasDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

// iOS Safari has no install prompt API, so explain the Share > Add to Home Screen steps instead.
export function InstallHint() {
  const isIOS = useIsIOS();
  const standalone = useStandalone();
  const [dismissed, setDismissed] = useState(wasDismissed);

  if (!isIOS || standalone || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage unavailable; the hint just shows again next time.
    }
  };

  return (
    <section className="relative animate-fade-in rounded-2xl bg-surface p-4 pr-11" aria-label="অ্যাপ হিসেবে ইনস্টল করুন">
      <button
        type="button"
        onClick={dismiss}
        aria-label="বন্ধ করুন"
        className="pressable absolute top-3 right-3 grid size-7 place-items-center rounded-full bg-fill text-secondary"
      >
        <XIcon className="size-4" />
      </button>
      <div className="flex items-center gap-3">
        <Image src="/icons/apple-touch-icon.png" alt="" width={44} height={44} unoptimized className="size-11 shrink-0 rounded-[10px]" />
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold">হোম স্ক্রিনে অ্যাপ যোগ করুন</h2>
          <p className="text-[13px] text-secondary">একবার খোলা প্রশ্ন ইন্টারনেট ছাড়াও পড়া যাবে।</p>
        </div>
      </div>
      <ol className="mt-3 space-y-1.5 text-[13px] text-secondary">
        <li className="flex items-center gap-2">
          <span className="font-semibold text-label">১.</span> নিচের
          <ShareIcon className="size-4 text-tint" />
          <span className="font-medium text-label">শেয়ার</span> বোতাম চাপুন
        </li>
        <li className="flex items-center gap-2">
          <span className="font-semibold text-label">২.</span>
          <SquarePlusIcon className="size-4 text-label" />
          <span className="font-medium text-label">Add to Home Screen</span> বেছে নিন
        </li>
      </ol>
    </section>
  );
}
