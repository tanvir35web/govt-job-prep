"use client";

import { useEffect } from "react";
import { applyTheme, themeSetting } from "@/lib/settings";

// Keeps <html data-theme> and the status bar colour in step with the Settings choice,
// and with the system appearance while "system" is selected.
export function ThemeWatcher() {
  const theme = themeSetting.use();

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("system");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  return null;
}
