import type { ReactNode } from "react";

// iOS large title at the top of a tab page. Pages have no navigation bar, so this is the page heading.
export function PageTitle({ title, subtitle, trailing }: { title: string; subtitle?: ReactNode; trailing?: ReactNode }) {
  return (
    <header className="pb-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-[34px] leading-tight font-bold tracking-tight">{title}</h1>
        {trailing}
      </div>
      {subtitle && <p className="mt-0.5 text-[15px] text-secondary">{subtitle}</p>}
    </header>
  );
}
