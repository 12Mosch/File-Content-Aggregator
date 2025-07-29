/**
 * Theme Detection Utilities
 *
 * Utilities for detecting the current theme and converting between
 * application theme names and highlighting theme names.
 */

export type AppTheme = "light" | "dark" | "system";
export type HighlightTheme = "light" | "dark" | "high-contrast";

/**
 * Get the current effective theme from the document root
 */
export function getCurrentTheme(): "light" | "dark" {
  const rootEl = document.documentElement;

  // Check if dark class is applied
  if (rootEl.classList.contains("dark")) {
    return "dark";
  }

  // Check if light class is applied
  if (rootEl.classList.contains("light")) {
    return "light";
  }

  // Fallback: check system preference
  const isDarkSystem = window.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;
  return isDarkSystem ? "dark" : "light";
}

/**
 * Convert application theme to highlighting theme
 */
export function getHighlightTheme(
  appTheme?: AppTheme,
  useHighContrast: boolean = false
): HighlightTheme {
  if (useHighContrast) {
    return "high-contrast";
  }

  if (appTheme) {
    if (appTheme === "system") {
      return getCurrentTheme();
    }
    return appTheme as HighlightTheme;
  }

  // Auto-detect current theme
  return getCurrentTheme();
}

/**
 * Listen for theme changes and call callback
 */
export function onThemeChange(
  callback: (theme: "light" | "dark") => void
): () => void {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (
        mutation.type === "attributes" &&
        mutation.attributeName === "class"
      ) {
        const newTheme = getCurrentTheme();
        callback(newTheme);
      }
    });
  });

  // Observe changes to the document root class attribute
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Also listen for system theme changes
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
  const handleSystemChange = () => {
    // Only trigger if we're in system mode (no explicit light/dark class)
    const rootEl = document.documentElement;
    if (
      !rootEl.classList.contains("light") &&
      !rootEl.classList.contains("dark")
    ) {
      callback(getCurrentTheme());
    }
  };

  mediaQuery.addEventListener("change", handleSystemChange);

  // Return cleanup function
  return () => {
    observer.disconnect();
    mediaQuery.removeEventListener("change", handleSystemChange);
  };
}

/**
 * Hook for React components to get current theme and listen for changes
 * Note: This would require React import in actual usage
 */
export function useCurrentTheme(): HighlightTheme {
  // This function is provided for reference but requires React import
  // Use getCurrentTheme() directly for non-React contexts
  throw new Error(
    "useCurrentTheme requires React import. Use getCurrentTheme() instead."
  );
}
