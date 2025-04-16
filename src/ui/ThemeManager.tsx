import { useState, useEffect } from "react";
import type { ThemePreference } from "./vite-env.d";
import { applyTheme } from "./themeUtils";

/**
 * Component to handle listening for theme changes (from settings or system)
 * AFTER the initial theme has been applied in main.tsx.
 */
export const ThemeHandler = () => {
  // State to track the *current* preference, initialized assuming 'system'
  // or whatever the initial fetch in main.tsx determined.
  // This state is mainly used to decide whether to listen to system changes.
  const [currentPreference, setCurrentPreference] =
    useState<ThemePreference>("system");

  // Effect to fetch the *initial* preference ONLY to set the state correctly
  // for the system listener logic. The actual theme application happens in main.tsx.
  useEffect(() => {
    let isMounted = true;
    const fetchInitialPreferenceForState = async () => {
      try {
        if (window.electronAPI?.getThemePreference) {
          const pref = await window.electronAPI.getThemePreference();
          if (isMounted) {
            console.log(
              "ThemeHandler: Setting initial state based on preference:",
              pref
            );
            setCurrentPreference(pref);
          }
        } else {
          console.warn(
            "ThemeHandler: getThemePreference API not available for initial state."
          );
          if (isMounted) setCurrentPreference("system");
        }
      } catch (error: unknown) {
        console.error(
          "ThemeHandler: Error fetching theme preference for initial state:",
          error instanceof Error ? error.message : error
        );
        if (isMounted) setCurrentPreference("system");
      }
    };
    void fetchInitialPreferenceForState();
    return () => {
      isMounted = false;
    };
  }, []);

  // Effect to listen for preference changes triggered by the Settings modal
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
          applyTheme(newTheme);
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

  // Effect to listen for system theme changes ONLY if preference is 'system'
  useEffect(() => {
    let mediaQueryList: MediaQueryList | null = null;
    let systemChangeListener: ((event: MediaQueryListEvent) => void) | null =
      null;

    const handleSystemThemeChange = (_event: MediaQueryListEvent) => {
      console.log(
        `ThemeHandler: System theme changed (matches dark: ${_event.matches}). Re-applying 'system' preference.`
      );
      // Re-apply the theme based on the 'system' preference
      applyTheme("system");
    };

    // Only add listener if the current preference is 'system'
    if (currentPreference === "system") {
      console.log(
        "ThemeHandler: Preference is 'system', adding system theme listener."
      );
      mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
      systemChangeListener = handleSystemThemeChange;
      // Ensure the theme is correct initially when switching TO system preference
      applyTheme("system");
      mediaQueryList.addEventListener("change", systemChangeListener);
    } else {
      console.log(
        `ThemeHandler: Preference is '${currentPreference}', ensuring no system listener.`
      );
      // Apply the specific theme if it's not system
      applyTheme(currentPreference);
    }

    // Cleanup function to remove the listener
    return () => {
      if (mediaQueryList && systemChangeListener) {
        console.log("ThemeHandler: Cleaning up system theme listener.");
        mediaQueryList.removeEventListener("change", systemChangeListener);
      }
    };
  }, [currentPreference]); // Re-run this effect when the preference changes

  // This component doesn't render anything itself
  return null;
};
