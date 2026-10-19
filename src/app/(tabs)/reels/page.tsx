import type { Metadata } from "next";
import { ReelsList } from "@/components/ReelsList";

export const metadata: Metadata = { title: "Reels" };

export default function ReelsPage() {
  return <ReelsList />;
}
