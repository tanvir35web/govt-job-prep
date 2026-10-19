import { TabBar } from "@/components/TabBar";

// Home, Reels and Settings share the bottom tab bar. Exam pages sit outside this group and use their own toolbar.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(3.5rem+max(0.5rem,calc(env(safe-area-inset-bottom)-1rem)))]">{children}</div>
      <TabBar />
    </>
  );
}
