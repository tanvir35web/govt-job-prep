// Cover gradients. Each organisation keeps one colour, so its exams are easy to spot on Home and in Reels.
const COVERS = [
  "from-emerald-500 to-teal-700",
  "from-sky-500 to-indigo-600",
  "from-violet-500 to-fuchsia-700",
  "from-amber-500 to-orange-700",
  "from-rose-500 to-pink-700",
  "from-cyan-500 to-blue-700",
];

export function coverFor(organization: string) {
  let hash = 0;
  for (const ch of organization) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return COVERS[Math.abs(hash) % COVERS.length];
}
