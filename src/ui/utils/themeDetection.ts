export type HighlightTheme = "light" | "dark" | "high-contrast";

/**
 * Get the current effective theme from the document root
 */
export function getCurrentTheme(): "light" | "dark" {
  try {
    // Check if document.documentElement exists
    if (!document?.documentElement) {
      return "light";
    }

    const rootEl = document.documentElement;

    // Check if classList is available before accessing it
    if (!rootEl.classList) {
      return "light";
    }

    // Check if dark class is applied
    if (rootEl.classList.contains("dark")) {
      return "dark";
    }

    // Check if light class is applied
    if (rootEl.classList.contains("light")) {
      return "light";
    }

    // Fallback: check system preference
    // Verify window.matchMedia is available and is a function
    if (typeof window?.matchMedia !== "function") {
      return "light";
    }

    try {
      const isDarkSystem = window.matchMedia(
        "(prefers-color-scheme: dark)"
      ).matches;
      return isDarkSystem ? "dark" : "light";
    } catch (_mediaQueryError) {
      // If media query throws an error, return default theme
      return "light";
    }
  } catch (_error) {
    // If any other error occurs, return default theme
    return "light";
  }
}
