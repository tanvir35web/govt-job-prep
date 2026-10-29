// Shared by the root layout (server) and lib/settings.ts (client), so it must stay free of client-only code.

export const THEME_KEY = "theme";

// Runs inline in <head> before first paint so the page never flashes the wrong theme.
// Keep it in step with applyTheme in lib/settings.ts.
export const FONT_KEY = "bangla-font";

// Same idea for the Bangla font: copies the saved choice to data-font. globals.css ignores unknown values.
// Keep it in step with applyFont in lib/settings.ts.
export const FONT_INIT_SCRIPT = `(function(){try{var f=localStorage.getItem(${JSON.stringify(FONT_KEY)});if(f)document.documentElement.dataset.font=f}catch(e){}})()`;

export const THEME_INIT_SCRIPT =`(function(){var r=document.documentElement;try{var t=localStorage.getItem(${JSON.stringify(THEME_KEY)});var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);r.dataset.theme=d?"dark":"light"}catch(e){r.dataset.theme="light"}})()`;
