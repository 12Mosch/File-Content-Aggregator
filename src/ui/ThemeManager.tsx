import { useState, useEffect } from "react";
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

/** Component to handle initial theme load and system listener */
export const ThemeHandler = () => {
  const [currentPreference, setCurrentPreference] =
    useState<ThemePreference>("system");

  useEffect(() => {
    let isMounted = true;
    const fetchInitialTheme = async () => {
      try {
        if (window.electronAPI?.getThemePreference) {
          const pref = await window.electronAPI.getThemePreference(); // Await here
          if (isMounted) {
            console.log("ThemeHandler: Fetched initial preference:", pref);
            setCurrentPreference(pref);
            applyTheme(pref);
          }
        } else {
          console.warn("ThemeHandler: getThemePreference API not available.");
          if (isMounted) applyTheme("system");
        }
      } catch (error: unknown) {
        console.error(
          "ThemeHandler: Error fetching theme preference:",
          error instanceof Error ? error.message : error
        );
        if (isMounted) applyTheme("system");
      }
    };
    // Use void operator for floating promise
    void fetchInitialTheme();
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let cleanupListener: (() => void) | null = null;
    if (window.electronAPI?.onThemePreferenceChanged) {
      console.log("ThemeHandler: Setting up preference change listener.");
      cleanupListener = window.electronAPI.onThemePreferenceChanged(
        (newTheme) => {
          console.log(
            "ThemeHandler: Received theme preference update:",
            newTheme
          );
          setCurrentPreference(newTheme);
        }
      );
    } else {
      console.warn("ThemeHandler: onThemePreferenceChanged API not available.");
    }
    return () => {
      if (cleanupListener) {
        console.log("ThemeHandler: Cleaning up preference change listener.");
        cleanupListener();
      }
    };
  }, []);

  useEffect(() => {
    let mediaQueryList: MediaQueryList | null = null;
    let systemChangeListener: ((event: MediaQueryListEvent) => void) | null =
      null;

    const handleSystemThemeChange = (_event: MediaQueryListEvent) => {
      // Prefix unused event
      console.log(
        `ThemeHandler: System theme changed (matches dark: ${_event.matches}). Re-applying 'system' preference.`
      );
      applyTheme("system");
    };

    applyTheme(currentPreference);

    if (currentPreference === "system") {
      console.log(
        "ThemeHandler: Preference is 'system', adding system theme listener."
      );
      mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
      systemChangeListener = handleSystemThemeChange;
      mediaQueryList.addEventListener("change", systemChangeListener);
    } else {
      console.log(
        `ThemeHandler: Preference is '${currentPreference}', ensuring no system listener.`
      );
    }

    return () => {
      if (mediaQueryList && systemChangeListener) {
        console.log("ThemeHandler: Cleaning up system theme listener.");
        mediaQueryList.removeEventListener("change", systemChangeListener);
      }
    };
  }, [currentPreference]);

  return null;
};
