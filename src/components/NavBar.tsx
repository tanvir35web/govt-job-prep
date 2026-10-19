"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { useOnline } from "@/lib/offline";
import { AppLink } from "./AppLink";
import { ChevronLeftIcon, WifiOffIcon } from "./icons";

// iOS navigation bar. Transparent at the top of the page, translucent material once content scrolls under it.
// With `largeTitle`, the title sits large below the bar and moves into the bar when it scrolls away.
export function NavBar({
  title,
  largeTitle = false,
  subtitle,
  back,
  trailing,
  width = "max-w-3xl",
}: {
  title: string;
  largeTitle?: boolean;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  trailing?: ReactNode;
  width?: string;
}) {
  const online = useOnline();
  const barRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const bar = barRef.current;
    const sentinel = sentinelRef.current;
    if (!bar || !sentinel) return;

    const observer = new IntersectionObserver(([entry]) => setCollapsed(!entry.isIntersecting), {
      rootMargin: `-${bar.offsetHeight}px 0px 0px 0px`,
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const showBarTitle = !largeTitle || collapsed;

  return (
    <>
      <header
        ref={barRef}
        className={`sticky top-0 z-30 pt-[env(safe-area-inset-top)] transition-[background-color,box-shadow] duration-200 ${
          collapsed ? "ios-material hairline-b" : "bg-canvas"
        }`}
      >
        <div className={`px-safe mx-auto grid h-11 w-full ${width} grid-cols-[minmax(5rem,1fr)_minmax(0,auto)_minmax(5rem,1fr)] items-center gap-2`}>
          <div className="min-w-0">
            {back && (
              <AppLink
                href={back.href}
                className="pressable -ml-2 inline-flex max-w-full items-center text-[17px] text-tint"
                aria-label={`ফিরে যান: ${back.label}`}
              >
                <ChevronLeftIcon className="size-7 shrink-0 stroke-[2.5]" />
                <span className="truncate">{back.label}</span>
              </AppLink>
            )}
          </div>

          <p
            aria-hidden={!showBarTitle}
            className={`truncate text-center text-[17px] font-semibold transition-opacity duration-200 ${
              showBarTitle ? "opacity-100" : "opacity-0"
            }`}
          >
            {title}
          </p>

          <div className="flex min-w-0 items-center justify-end gap-2">
            {!online && (
              <span className="inline-flex animate-fade-in items-center gap-1 rounded-full bg-fill px-2 py-0.5 text-xs font-medium text-secondary">
                <WifiOffIcon className="size-3.5" /> অফলাইন
              </span>
            )}
            {trailing}
          </div>
        </div>
      </header>

      {largeTitle && (
        <div className={`px-safe mx-auto w-full ${width} pt-1 pb-2`}>
          <h1 className="text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
          {subtitle && <div className="mt-0.5 text-[15px] text-secondary">{subtitle}</div>}
        </div>
      )}
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
    </>
  );
}
