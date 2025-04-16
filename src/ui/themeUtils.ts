import type { ThemePreference } from "./vite-env.d";

/** Applies the theme class based on preference and system settings */
export const applyTheme = (preference: ThemePreference) => {
  const rootEl = window.document.documentElement;
  const isDarkSystem = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  rootEl.classList.remove("light", "dark");

  if (preference === "system") {
    console.log(`Applying theme: system -> ${isDarkSystem ? "dark" : "light"}`);
    if (isDarkSystem) {
      rootEl.classList.add("dark");
    } else {
      rootEl.classList.add("light");
    }
  } else {
    console.log(`Applying theme: ${preference}`);
    rootEl.classList.add(preference);
  }
};
