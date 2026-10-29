import type { Metadata, Viewport } from "next";
import { FontWatcher } from "@/components/pwa/FontWatcher";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { ThemeWatcher } from "@/components/pwa/ThemeWatcher";
import { FONT_INIT_SCRIPT, THEME_INIT_SCRIPT } from "@/lib/theme-script";
import { banglaFontVariables } from "./fonts";
import "./globals.css";

// Social previews need absolute URLs. Set NEXT_PUBLIC_SITE_URL to the public domain; Vercel's production URL is the fallback.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

const description = "Past government job exam questions with correct answers and explanations. Study them or practise on your own.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Govt Job Prep",
    template: "%s | Govt Job Prep",
  },
  description,
  applicationName: "Govt Job Prep",
  keywords: ["govt job", "government job", "BCS", "job exam", "question bank", "MCQ", "exam preparation", "Bangladesh"],
  category: "education",
  // The image comes from app/opengraph-image.tsx; Next.js adds it to these tags.
  openGraph: {
    type: "website",
    siteName: "Govt Job Prep",
    title: "Govt Job Prep",
    description,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Govt Job Prep",
    description,
  },
  appleWebApp: {
    capable: true,
    title: "Job Prep",
    // "default" keeps dark status bar text on the light bar; "black-translucent" would force white text.
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
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
    // data-theme and data-font are set by the inline scripts before hydration, so React must not compare them.
    <html lang="en" className={`${banglaFontVariables} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: FONT_INIT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        {children}
        <ServiceWorkerRegistrar />
        <ThemeWatcher />
        <FontWatcher />
      </body>
    </html>
  );
}
