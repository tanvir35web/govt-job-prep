"use client";

import { useEffect } from "react";
import { applyFont, fontSetting } from "@/lib/settings";

// Keeps <html data-font> in step with the Bangla font chosen in Settings, including from other tabs.
export function FontWatcher() {
  const font = fontSetting.use();

  useEffect(() => {
    applyFont(font);
  }, [font]);

  return null;
}
