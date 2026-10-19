// Each organisation keeps one colour, so its exams are easy to spot on Home and in Reels.
// The strong gradient and the soft tone at the same index are the same hue.

const COVERS = [
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-600",
  "from-violet-500 to-fuchsia-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-blue-700",
];

// The "from" colour of each cover above (Tailwind's 500 shades), for places that need a plain colour
// rather than a class, such as the browser's theme-color.
const COVER_FROM_HEX = ["#10b981", "#0ea5e9", "#8b5cf6", "#f59e0b", "#f43f5e", "#06b6d4"];

export type SoftTone = {
  /** Card background for Reels: a very faint wash, so the cards stay quiet. */
  card: string;
  /** A more see-through version of card, for Home. */
  wash: string;
  /** Text and icons in the hue, readable on the card. */
  accent: string;
  /** Solid fill: progress bars. */
  solid: string;
  /** Progress bar track. */
  track: string;
};

// Full class strings, so Tailwind can see every one of them.
const SOFT_TONES: SoftTone[] = [
  {
    card: "bg-emerald-50/50 dark:bg-emerald-400/7",
    wash: "bg-emerald-50/60 dark:bg-emerald-400/10",
    accent: "text-emerald-700 dark:text-emerald-300",
    solid: "bg-emerald-600 dark:bg-emerald-400",
    track: "bg-emerald-600/15 dark:bg-emerald-300/15",
  },
  {
    card: "bg-sky-50/50 dark:bg-sky-400/7",
    wash: "bg-sky-50/60 dark:bg-sky-400/10",
    accent: "text-sky-700 dark:text-sky-300",
    solid: "bg-sky-600 dark:bg-sky-400",
    track: "bg-sky-600/15 dark:bg-sky-300/15",
  },
  {
    card: "bg-violet-50/50 dark:bg-violet-400/7",
    wash: "bg-violet-50/60 dark:bg-violet-400/10",
    accent: "text-violet-700 dark:text-violet-300",
    solid: "bg-violet-600 dark:bg-violet-400",
    track: "bg-violet-600/15 dark:bg-violet-300/15",
  },
  {
    card: "bg-amber-50/50 dark:bg-amber-400/7",
    wash: "bg-amber-50/60 dark:bg-amber-400/10",
    accent: "text-amber-700 dark:text-amber-300",
    solid: "bg-amber-600 dark:bg-amber-400",
    track: "bg-amber-600/15 dark:bg-amber-300/15",
  },
  {
    card: "bg-rose-50/50 dark:bg-rose-400/7",
    wash: "bg-rose-50/60 dark:bg-rose-400/10",
    accent: "text-rose-700 dark:text-rose-300",
    solid: "bg-rose-600 dark:bg-rose-400",
    track: "bg-rose-600/15 dark:bg-rose-300/15",
  },
  {
    card: "bg-cyan-50/50 dark:bg-cyan-400/7",
    wash: "bg-cyan-50/60 dark:bg-cyan-400/10",
    accent: "text-cyan-700 dark:text-cyan-300",
    solid: "bg-cyan-600 dark:bg-cyan-400",
    track: "bg-cyan-600/15 dark:bg-cyan-300/15",
  },
];

function toneIndex(name: string) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return Math.abs(hash) % COVERS.length;
}

/** Strong gradient (use with bg-linear-to-*), for tiles and slide washes. */
export function coverFor(name: string) {
  return COVERS[toneIndex(name)];
}

/** Soft, theme-aware tone in the same hue, for calm cards. */
export function softToneFor(name: string): SoftTone {
  return SOFT_TONES[toneIndex(name)];
}

/** The starting colour of the name's cover gradient, as a hex string. */
export function coverFromHex(name: string) {
  return COVER_FROM_HEX[toneIndex(name)];
}
