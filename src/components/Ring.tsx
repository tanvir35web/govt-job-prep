// Activity-style progress ring: a fill-coloured track with an arc in the current text colour (tint by default).
export function Ring({
  value,
  total,
  size,
  stroke,
  className = "text-tint",
  animate = true,
  children,
}: {
  value: number;
  total: number;
  size: number;
  stroke: number;
  className?: string;
  /** Ease changes; turn off for a ticking countdown. */
  animate?: boolean;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? Math.min(1, Math.max(0, value / total)) : 0;
  return (
    <span className={`relative grid shrink-0 place-items-center ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-fill" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className={animate ? "transition-[stroke-dashoffset] duration-700 ease-out" : "transition-[stroke-dashoffset] duration-300 ease-linear"}
        />
      </svg>
      <span className="relative text-label">{children}</span>
    </span>
  );
}
