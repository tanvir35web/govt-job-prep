"use client";

import { usePathname } from "next/navigation";
import { useUpdateAvailable } from "@/lib/update";
import { AppLink } from "./AppLink";
import { GearIcon, HomeIcon, ReelsIcon, TimerIcon } from "./icons";

const TABS = [
  { href: "/", label: "Home", Icon: HomeIcon },
  { href: "/reels", label: "Reels", Icon: ReelsIcon },
  { href: "/exam", label: "Exam", Icon: TimerIcon },
  { href: "/settings", label: "Settings", Icon: GearIcon },
] as const;

// Floating tab bar in the iOS 26 style: a translucent capsule above the home indicator, with a
// highlight that slides to the current tab. Tapping the current tab scrolls it to the top.
// Its height and bottom offset are mirrored in the padding of app/(tabs)/layout.tsx.
export function TabBar() {
  const pathname = usePathname();
  const updateAvailable = useUpdateAvailable();
  const activeIndex = TABS.findIndex((t) => t.href === pathname);

  return (
    <nav
      aria-label="Main menu"
      className="px-safe pointer-events-none fixed inset-x-0 bottom-[max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem))] z-30 flex justify-center"
    >
      <ul className="ios-material pointer-events-auto relative grid h-16 w-full max-w-96 grid-cols-4 rounded-full p-1 shadow-[0_8px_32px_rgb(0_0_0/0.14),0_2px_6px_rgb(0_0_0/0.06)] ring-[0.5px] ring-separator dark:shadow-[0_8px_32px_rgb(0_0_0/0.6)] dark:ring-white/10">
        {activeIndex >= 0 && (
          <span
            aria-hidden="true"
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-full bg-fill transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
        )}
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          const badge = href === "/settings" && updateAvailable;
          return (
            <li key={href}>
              <AppLink
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? `${label}, update available` : label}
                onClick={(e) => {
                  if (!active) return;
                  e.preventDefault();
                  window.scrollTo({ top: 0 });
                }}
                className={`relative flex h-full flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${active ? "text-tint" : "text-secondary active:text-label"}`}
              >
                <span className="relative">
                  <Icon className={`size-6 ${active ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                  {badge && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-ios-red ring-2 ring-canvas" />}
                </span>
                <span className="text-[10px] font-medium">{label}</span>
              </AppLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
