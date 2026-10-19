"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "../icons";

// Building blocks for a grouped settings list. Flat and quiet: translucent cards with a hairline edge
// (as on Home), plain line icons in the secondary colour, sentence-case labels.

export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-8 first:mt-3">
      {title && <h2 className="mb-2 px-1 text-[13px] font-semibold text-secondary">{title}</h2>}
      <ul className="overflow-hidden rounded-2xl bg-surface/60 ring-[0.5px] ring-black/5 dark:ring-white/10">{children}</ul>
      {footer && <div className="mt-2 px-1 text-[13px] leading-relaxed text-secondary">{footer}</div>}
    </section>
  );
}

function RowIcon({ icon }: { icon?: ReactNode }) {
  if (!icon) return null;
  return <span className="grid size-5 shrink-0 place-items-center text-secondary">{icon}</span>;
}

// Rows are separated by hairlines that start after the icon. The last row's line is hidden.
function RowBody({ label, detail, trailing, labelClass = "" }: { label: ReactNode; detail?: ReactNode; trailing?: ReactNode; labelClass?: string }) {
  return (
    <div className="flex min-h-13 min-w-0 flex-1 items-center gap-3 py-3 pr-4 [li:not(:last-child)_&]:hairline-b">
      <div className="min-w-0 flex-1">
        <div className={`text-[16px] leading-snug ${labelClass}`}>{label}</div>
        {detail && <div className="mt-0.5 text-[13px] leading-snug text-secondary">{detail}</div>}
      </div>
      {trailing}
    </div>
  );
}

export function ValueRow({ icon, label, detail, value }: { icon?: ReactNode; label: ReactNode; detail?: ReactNode; value: ReactNode }) {
  return (
    <li className="flex items-center gap-3.5 pl-4">
      <RowIcon icon={icon} />
      <RowBody label={label} detail={detail} trailing={<span className="shrink-0 text-[15px] text-secondary tabular-nums">{value}</span>} />
    </li>
  );
}

export function ButtonRow({
  icon,
  label,
  detail,
  value,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex w-full items-center gap-3.5 pl-4 text-left transition-colors active:bg-fill disabled:opacity-40"
      >
        <RowIcon icon={icon} />
        <RowBody
          label={label}
          detail={detail}
          labelClass={destructive ? "text-ios-red" : "text-label"}
          trailing={value && <span className="shrink-0 text-[15px] text-secondary tabular-nums">{value}</span>}
        />
      </button>
    </li>
  );
}

export function CheckRow({ label, checked, onSelect }: { label: ReactNode; checked: boolean; onSelect: () => void }) {
  return (
    <li>
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        onClick={onSelect}
        className="flex w-full items-center pl-4 text-left transition-colors active:bg-fill"
      >
        <RowBody label={label} trailing={checked && <CheckIcon className="size-5 shrink-0 stroke-[2.5] text-tint" />} />
      </button>
    </li>
  );
}

export function SwitchRow({
  icon,
  label,
  detail,
  checked,
  onChange,
}: {
  icon?: ReactNode;
  label: ReactNode;
  detail?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3.5 pl-4">
        <RowIcon icon={icon} />
        <RowBody label={label} detail={detail} trailing={<Switch checked={checked} onChange={onChange} />} />
      </label>
    </li>
  );
}

// A row holding any control (a segmented picker, a progress summary), padded like the other rows.
export function CustomRow({ children }: { children: ReactNode }) {
  return <li className="px-4 py-3.5 not-last:hairline-b">{children}</li>;
}

// Switch: 51×31 track in the app's tint when on, white thumb that slides across.
function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`h-[31px] w-[51px] rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tint ${
          checked ? "bg-tint" : "bg-fill-strong"
        }`}
      />
      <span
        aria-hidden="true"
        className={`absolute top-0.5 left-0.5 size-[27px] rounded-full bg-white shadow-[0_3px_8px_rgb(0_0_0/0.15),0_3px_1px_rgb(0_0_0/0.06)] transition-transform duration-200 ${
          checked ? "translate-x-5" : ""
        }`}
      />
    </span>
  );
}
