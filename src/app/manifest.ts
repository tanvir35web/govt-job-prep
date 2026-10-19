import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "সরকারি চাকরি প্রস্তুতি",
    short_name: "চাকরি প্রস্তুতি",
    description: "বিগত সরকারি চাকরি পরীক্ষার প্রশ্ন, সঠিক উত্তর ও ব্যাখ্যা। অফলাইনেও পড়া যায়।",
    lang: "bn",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
