import { Baloo_Da_2, Hind_Siliguri, Noto_Sans_Bengali, Noto_Serif_Bengali, Tiro_Bangla } from "next/font/google";
import localFont from "next/font/local";

// The Bangla fonts offered in Settings. Each exposes a CSS variable; globals.css points --font-bangla at the chosen one.
// Only the default is preloaded. Browsers download the others only once text is shown in them.

// Kalpurush is not on Google Fonts, so it is self-hosted. It ships one weight; browsers synthesise bold from it.
const kalpurush = localFont({
  src: "./fonts/Kalpurush.woff2",
  variable: "--font-kalpurush",
  weight: "400",
  display: "swap",
});

// SolaimanLipi, Nikosh and AdorshoLipi are not on Google Fonts either. Only SolaimanLipi has a bold cut.
const solaimanLipi = localFont({
  src: [
    { path: "./fonts/SolaimanLipi-Regular.woff2", weight: "400" },
    { path: "./fonts/SolaimanLipi-Bold.woff2", weight: "700" },
  ],
  variable: "--font-solaiman-lipi",
  display: "swap",
  preload: false,
});

const nikosh = localFont({ src: "./fonts/Nikosh.woff2", variable: "--font-nikosh", weight: "400", display: "swap", preload: false });

const adorshoLipi = localFont({ src: "./fonts/AdorshoLipi.woff2", variable: "--font-adorsho-lipi", weight: "400", display: "swap", preload: false });

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["bengali"],
  weight: ["400", "500", "600", "700"],
  preload: false,
});

const notoSansBengali = Noto_Sans_Bengali({ variable: "--font-noto-sans-bengali", subsets: ["bengali"], preload: false });

const notoSerifBengali = Noto_Serif_Bengali({ variable: "--font-noto-serif-bengali", subsets: ["bengali"], preload: false });

const balooDa2 = Baloo_Da_2({ variable: "--font-baloo-da-2", subsets: ["bengali"], preload: false });

const tiroBangla = Tiro_Bangla({ variable: "--font-tiro-bangla", subsets: ["bengali"], weight: "400", preload: false });

export const banglaFontVariables = [kalpurush, solaimanLipi, nikosh, adorshoLipi, hindSiliguri, notoSansBengali, notoSerifBengali, balooDa2, tiroBangla]
  .map((f) => f.variable)
  .join(" ");
