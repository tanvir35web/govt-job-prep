"use client";

import type { ReactNode } from "react";
import { CheckIcon } from "../icons";

// Building blocks for an iOS Settings-style inset grouped list.

export function Section({ title, footer, children }: { title?: string; footer?: ReactNode; children: ReactNode }) {
  return (
    <section className="mt-7 first:mt-2">
      {title && <h2 className="mb-1.5 px-4 text-[13px] text-secondary">{title}</h2>}
      <ul className="overflow-hidden rounded-2xl bg-surface">{children}</ul>
      {footer && <div className="mt-1.5 px-4 text-[13px] leading-relaxed text-secondary">{footer}</div>}
    </section>
  );
}

const TILE_COLORS = {
  green: "bg-[#34c759]",
  blue: "bg-[#007aff]",
  indigo: "bg-[#5856d6]",
  orange: "bg-[#ff9500]",
  red: "bg-[#ff3b30]",
  gray: "bg-[#8e8e93]",
  teal: "bg-linear-to-br from-emerald-500 to-teal-700",
} as const;

export type TileColor = keyof typeof TILE_COLORS;

function Tile({ icon, color }: { icon: ReactNode; color: TileColor }) {
  return <span className={`grid size-[29px] shrink-0 place-items-center rounded-[7px] text-white ${TILE_COLORS[color]}`}>{icon}</span>;
}

// Rows are separated by hairlines that start after the icon, as in iOS. The last row's line is hidden.
function RowBody({ label, detail, trailing, labelClass = "" }: { label: ReactNode; detail?: ReactNode; trailing?: ReactNode; labelClass?: string }) {
  return (
    <div className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li:not(:last-child)_&]:hairline-b">
      <div className="min-w-0 flex-1">
        <div className={`text-[17px] leading-snug ${labelClass}`}>{label}</div>
        {detail && <div className="mt-0.5 text-[13px] text-secondary">{detail}</div>}
      </div>
      {trailing}
    </div>
  );
}

export function ValueRow({ icon, color, label, value }: { icon?: ReactNode; color?: TileColor; label: ReactNode; value: ReactNode }) {
  return (
    <li className="flex items-center gap-3 pl-4">
      {icon && color && <Tile icon={icon} color={color} />}
      <RowBody label={label} trailing={<span className="shrink-0 text-[17px] text-secondary">{value}</span>} />
    </li>
  );
}

export function ButtonRow({
  icon,
  color,
  label,
  detail,
  value,
  onClick,
  disabled = false,
  destructive = false,
}: {
  icon?: ReactNode;
  color?: TileColor;
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
        className="flex w-full items-center gap-3 pl-4 text-left transition-colors active:bg-fill-strong disabled:opacity-40"
      >
        {icon && color && <Tile icon={icon} color={color} />}
        <RowBody
          label={label}
          detail={detail}
          labelClass={destructive ? "text-ios-red" : "text-tint"}
          trailing={value && <span className="shrink-0 text-[15px] text-secondary">{value}</span>}
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
        className="flex w-full items-center pl-4 text-left transition-colors active:bg-fill-strong"
      >
        <RowBody label={label} trailing={checked && <CheckIcon className="size-5 shrink-0 stroke-[2.5] text-tint" />} />
      </button>
    </li>
  );
}

export function SwitchRow({
  icon,
  color,
  label,
  detail,
  checked,
  onChange,
}: {
  icon?: ReactNode;
  color?: TileColor;
  label: ReactNode;
  detail?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 pl-4">
        {icon && color && <Tile icon={icon} color={color} />}
        <RowBody label={label} detail={detail} trailing={<Switch checked={checked} onChange={onChange} />} />
      </label>
    </li>
  );
}

// UISwitch: 51×31 track, green when on, white thumb that slides across.
function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <span className="relative inline-flex shrink-0">
      <input type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={`h-[31px] w-[51px] rounded-full transition-colors duration-200 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-tint ${
          checked ? "bg-[#34c759]" : "bg-fill-strong"
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
