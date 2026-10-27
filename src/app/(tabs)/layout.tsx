import { TabBar } from "@/components/TabBar";

// Home, Study, Reels, Exam and Settings share the floating tab bar; the bottom padding is its height (4rem) + a 1rem gap + its offset. Exam pages sit outside this group and use their own toolbar.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col pb-[calc(5rem+max(0.75rem,calc(env(safe-area-inset-bottom)-0.5rem)))]">{children}</div>
      <TabBar />
    </>
  );
}
