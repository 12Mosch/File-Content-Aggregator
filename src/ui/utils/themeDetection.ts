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
