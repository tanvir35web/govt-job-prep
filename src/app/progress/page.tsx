import type { Metadata } from "next";
import { ProgressView } from "@/components/ProgressView";

export const metadata: Metadata = { title: "Progress" };

// Outside the (tabs) group: a detail page reached from the progress card on Home, with its own back link.
export default function ProgressPage() {
  return <ProgressView />;
}
