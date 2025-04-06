import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n from "./i18n";
import type { ThemePreference } from "./vite-env.d";
import "./index.css";
import 'highlight.js/styles/github-dark.css';

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

/** Applies the theme class based on preference and system settings */
const applyTheme = (preference: ThemePreference) => {
    const root = window.document.documentElement;
    const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;

    root.classList.remove('light', 'dark'); // Remove existing theme classes

    if (preference === 'system') {
        console.log(`Applying theme: system -> ${isDarkSystem ? 'dark' : 'light'}`);
        if (isDarkSystem) {
            root.classList.add('dark');
        } else {
            root.classList.add('light'); // Explicitly add light for clarity if needed
        }
    } else {
         console.log(`Applying theme: ${preference}`);
         root.classList.add(preference);
    }
};

/** Component to handle initial theme load and system listener */
const ThemeHandler = () => {
    // useState was missing from import
    const [currentPreference, setCurrentPreference] = useState<ThemePreference>('system');

    // Effect to fetch initial theme and set up listener
    useEffect(() => {
        let isMounted = true;
        let mediaQueryList: MediaQueryList | null = null;
        let preferenceListenerCleanup: (() => void) | null = null;

        const fetchAndApplyInitialTheme = async () => {
            try {
                if (window.electronAPI?.getThemePreference) {
                    const pref = await window.electronAPI.getThemePreference();
                    if (isMounted) {
                        setCurrentPreference(pref);
                        applyTheme(pref); // Apply initial theme
                    }
                } else {
                    console.warn("ThemeHandler: getThemePreference API not available.");
                    if (isMounted) applyTheme('system'); // Fallback
                }
            } catch (error) {
                console.error("ThemeHandler: Error fetching theme preference:", error);
                 if (isMounted) applyTheme('system'); // Fallback
            }
        };

        fetchAndApplyInitialTheme();

        // Listener for system changes (only active if preference is 'system')
        const handleSystemThemeChange = (event: MediaQueryListEvent) => {
            console.log("System theme changed, re-applying 'system' preference.");
            // Check currentPreference again inside the handler, in case it changed
            // This check might be better placed where the preference is set (SettingsModal)
            // For simplicity here, we just re-apply 'system' if that's the current state.
            // A more robust solution might involve a global state or context.
            if (currentPreference === 'system') {
                 applyTheme('system');
            }
        };

        // Function to manage the media query listener based on preference
        const setupMediaQueryListener = (preference: ThemePreference) => {
            // Clean up existing listener first
            if (mediaQueryList && preferenceListenerCleanup) {
                mediaQueryList.removeEventListener('change', handleSystemThemeChange);
                preferenceListenerCleanup = null;
                mediaQueryList = null;
                console.log("ThemeHandler: Removed system theme listener.");
            }
            // Add listener only if preference is 'system'
            if (preference === 'system') {
                mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
                mediaQueryList.addEventListener('change', handleSystemThemeChange);
                preferenceListenerCleanup = () => {
                    mediaQueryList?.removeEventListener('change', handleSystemThemeChange);
                };
                 console.log("ThemeHandler: Added system theme listener.");
            }
        };

        // Set up listener based on initial preference state
        setupMediaQueryListener(currentPreference);

        // Cleanup on unmount
        return () => {
            isMounted = false;
            preferenceListenerCleanup?.(); // Clean up listener
        };
    // Rerun listener setup if preference changes
    }, [currentPreference]);


    return null; // This component doesn't render anything visual
};


// Asynchronously initialize i18n and then render the app
const initializeApp = async () => {
  try {
    // --- Language Init ---
    if (!window.electronAPI?.getInitialLanguage) {
        console.error("Electron API not ready for language initialization.");
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
    } else {
        const initialLng = await window.electronAPI.getInitialLanguage();
        console.log(`UI: Received initial language: ${initialLng}`);
        await i18n.changeLanguage(initialLng);
        console.log(`UI: i18next language set to: ${i18n.language}`);
    }
    // --- End Language Init ---

  } catch (error) {
    console.error("Error initializing i18n language:", error);
    if (!i18n.language) {
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
    }
  } finally {
    // Render the app
    root.render(
      <StrictMode>
        {/* Render ThemeHandler alongside App to manage theme */}
        <ThemeHandler />
        <App />
      </StrictMode>,
    );
  }
};

initializeApp();

// Export applyTheme if SettingsModal needs to call it directly
export { applyTheme };
