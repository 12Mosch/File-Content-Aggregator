import { StrictMode, useEffect, useState } from "react"; // Ensure useState is imported
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
    const rootEl = window.document.documentElement;
    const isDarkSystem = window.matchMedia('(prefers-color-scheme: dark)').matches;

    rootEl.classList.remove('light', 'dark'); // Remove existing theme classes

    if (preference === 'system') {
        console.log(`Applying theme: system -> ${isDarkSystem ? 'dark' : 'light'}`);
        if (isDarkSystem) {
            rootEl.classList.add('dark');
        } else {
            // Explicitly add light for clarity if needed, but default is usually light
            // rootEl.classList.add('light');
        }
    } else {
         console.log(`Applying theme: ${preference}`);
         rootEl.classList.add(preference);
    }
};

/** Component to handle initial theme load and system listener */
const ThemeHandler = () => {
    // State to hold the *current* preference (initially fetched or updated via IPC)
    const [currentPreference, setCurrentPreference] = useState<ThemePreference>('system');

    // Effect 1: Fetch initial theme preference on mount
    useEffect(() => {
        let isMounted = true;
        const fetchInitialTheme = async () => {
            try {
                if (window.electronAPI?.getThemePreference) {
                    const pref = await window.electronAPI.getThemePreference();
                    if (isMounted) {
                        console.log("ThemeHandler: Fetched initial preference:", pref);
                        setCurrentPreference(pref); // Update state
                        applyTheme(pref); // Apply initial theme based on fetched pref
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
        fetchInitialTheme();
        return () => { isMounted = false; };
    }, []); // Empty dependency array: runs only once on mount

    // Effect 2: Listen for preference changes from main process
    useEffect(() => {
        let cleanupListener: (() => void) | null = null;
        if (window.electronAPI?.onThemePreferenceChanged) {
            console.log("ThemeHandler: Setting up preference change listener.");
            cleanupListener = window.electronAPI.onThemePreferenceChanged((newTheme) => {
                console.log("ThemeHandler: Received theme preference update:", newTheme);
                setCurrentPreference(newTheme); // Update state when preference changes
                // applyTheme(newTheme); // Apply theme immediately based on new pref
            });
        } else {
            console.warn("ThemeHandler: onThemePreferenceChanged API not available.");
        }
        // Cleanup listener on unmount
        return () => {
            if (cleanupListener) {
                console.log("ThemeHandler: Cleaning up preference change listener.");
                cleanupListener();
            }
        };
    }, []); // Empty dependency array: setup listener once on mount

    // Effect 3: Manage system theme listener based on currentPreference state
    useEffect(() => {
        let mediaQueryList: MediaQueryList | null = null;
        let systemChangeListener: ((event: MediaQueryListEvent) => void) | null = null;

        // Function to handle system theme changes
        const handleSystemThemeChange = (event: MediaQueryListEvent) => {
            console.log(`ThemeHandler: System theme changed (matches dark: ${event.matches}). Re-applying 'system' preference.`);
            applyTheme('system'); // Re-apply based on the *new* system state
        };

        // Setup listener only if preference is 'system'
        if (currentPreference === 'system') {
            console.log("ThemeHandler: Preference is 'system', adding system theme listener.");
            mediaQueryList = window.matchMedia('(prefers-color-scheme: dark)');
            systemChangeListener = handleSystemThemeChange; // Assign handler
            mediaQueryList.addEventListener('change', systemChangeListener);
            // Apply theme initially *again* in case the system changed *while* pref was not 'system'
            applyTheme('system');
        } else {
            console.log(`ThemeHandler: Preference is '${currentPreference}', ensuring no system listener.`);
             // Apply the specific theme if not system
             applyTheme(currentPreference);
        }

        // Cleanup function for this effect
        return () => {
            if (mediaQueryList && systemChangeListener) {
                console.log("ThemeHandler: Cleaning up system theme listener.");
                mediaQueryList.removeEventListener('change', systemChangeListener);
            }
        };
    // Re-run this effect whenever currentPreference changes
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

// Export applyTheme if SettingsModal needs to call it directly (still useful)
export { applyTheme };
