import type { Metadata, Viewport } from "next";
import { Hind_Siliguri } from "next/font/google";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { ThemeWatcher } from "@/components/pwa/ThemeWatcher";
import { THEME_INIT_SCRIPT } from "@/lib/theme-script";
import "./globals.css";

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Govt Job Prep",
    template: "%s | Govt Job Prep",
  },
  description: "Past government job exam questions with correct answers and explanations. Study them or practise on your own.",
  applicationName: "Govt Job Prep",
  appleWebApp: {
    capable: true,
    title: "Job Prep",
    // "default" keeps dark status bar text on the light bar; "black-translucent" would force white text.
    statusBarStyle: "default",
  },
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, email: false, address: false },
  // Next.js emits only "mobile-web-app-capable"; iOS before 17.4 still reads the Apple-prefixed tag.
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // data-theme is set by the inline script before hydration, so React must not compare it.
    <html lang="en" className={`${hindSiliguri.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegistrar />
        <ThemeWatcher />
      </body>
    </html>
  );
}
