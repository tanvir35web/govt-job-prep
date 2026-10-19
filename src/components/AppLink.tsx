"use client";

import Link from "next/link";
import type { ComponentProps } from "react";

// A next/link that switches to a full page load while offline. Client-side navigation needs the
// network for the route payload; a full load lets the service worker serve the saved page instead.
export function AppLink({ onClick, href, ...props }: ComponentProps<typeof Link> & { href: string }) {
  return (
    <Link
      href={href}
      {...props}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || navigator.onLine) return;
        e.preventDefault();
        window.location.assign(href);
      }}
    />
  );
}
