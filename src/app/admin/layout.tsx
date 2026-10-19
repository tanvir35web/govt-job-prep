import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "অ্যাডমিন",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return children;
}
