// Shared by the root layout (server) and lib/settings.ts (client), so it must stay free of client-only code.

export const THEME_KEY = "theme";

// Runs inline in <head> before first paint so the page never flashes the wrong theme.
// Keep it in step with applyTheme in lib/settings.ts.
export const THEME_INIT_SCRIPT = `(function(){var r=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light"}catch(e){r.dataset.theme="light"}})()`;
