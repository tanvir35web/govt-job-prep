"use client";

// UISegmentedControl for any number of options: a grey track with a raised thumb that slides to the choice.
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  format = String,
  isDisabled,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  format?: (value: T) => string;
  isDisabled?: (value: T) => boolean;
}) {
  const index = Math.max(0, options.indexOf(value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative grid rounded-[9px] bg-fill p-0.5"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0.5 left-0.5 rounded-[7px] bg-white shadow-[0_3px_8px_rgb(0_0_0/0.12),0_3px_1px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-out dark:bg-[#636366]"
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((option) => {
        const selected = option === value;
        const disabled = isDisabled?.(option) ?? false;
        return (
          <button
            key={String(option)}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(option)}
            className={`relative h-8 text-[15px] tabular-nums transition-colors disabled:opacity-35 ${
              selected ? "font-semibold text-label" : "font-medium text-secondary"
            }`}
          >
            {format(option)}
          </button>
        );
      })}
    </div>
  );
}
