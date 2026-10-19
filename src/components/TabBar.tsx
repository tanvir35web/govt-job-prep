"use client";

import { usePathname } from "next/navigation";
import { useUpdateAvailable } from "@/lib/update";
import { AppLink } from "./AppLink";
import { GearIcon, HomeIcon, ReelsIcon } from "./icons";

const TABS = [
  { href: "/", label: "হোম", Icon: HomeIcon },
  { href: "/reels", label: "রিলস", Icon: ReelsIcon },
  { href: "/settings", label: "সেটিংস", Icon: GearIcon },
] as const;

// UITabBar: translucent, pinned above the home indicator. Tapping the current tab scrolls it to the top.
export function TabBar() {
  const pathname = usePathname();
  const updateAvailable = useUpdateAvailable();

  return (
    <nav aria-label="প্রধান মেনু" className="ios-material hairline-t px-safe fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)]">
      <ul className="mx-auto grid h-[49px] max-w-md grid-cols-3">
        {TABS.map(({ href, label, Icon }) => {
          const active = pathname === href;
          const badge = href === "/settings" && updateAvailable;
          return (
            <li key={href}>
              <AppLink
                href={href}
                aria-current={active ? "page" : undefined}
                aria-label={badge ? `${label}, নতুন আপডেট আছে` : label}
                onClick={(e) => {
                  if (!active) return;
                  e.preventDefault();
                  window.scrollTo({ top: 0 });
                }}
                className={`flex h-full flex-col items-center justify-center gap-0.5 transition-colors ${active ? "text-tint" : "text-secondary"}`}
              >
                <span className="relative">
                  <Icon className={`size-6 ${active ? "stroke-[2.2]" : "stroke-[1.8]"}`} />
                  {badge && <span className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-ios-red ring-2 ring-surface" />}
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
