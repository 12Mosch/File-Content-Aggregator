import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n from "./i18n";
import { ThemeHandler, applyTheme } from "./ThemeManager";
import "./index.css";
import "highlight.js/styles/github-dark.css";
import type { ThemePreference } from "./vite-env.d";

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

/**
 * Initializes language and theme settings before rendering the main application.
 */
const initializeApp = async () => {
  let initialTheme: ThemePreference = "system";

  // --- Fetch Initial Theme Preference ---
  try {
    if (window.electronAPI?.getThemePreference) {
      initialTheme = await window.electronAPI.getThemePreference();
      console.log(`UI: Received initial theme preference: ${initialTheme}`);
    } else {
      console.warn("UI: getThemePreference API not available.");
    }
  } catch (error) {
    console.error("Error fetching initial theme preference:", error);
    initialTheme = "system";
  }

  // --- Apply Initial Theme BEFORE First Render ---
  applyTheme(initialTheme);
  console.log(`UI: Initial theme "${initialTheme}" applied before render.`);

  // --- Initialize Language ---
  try {
    if (!window.electronAPI?.getInitialLanguage) {
      console.error("Electron API not ready for language initialization.");
      if (!i18n.isInitialized) await i18n.init();
      await i18n.changeLanguage(i18n.options.fallbackLng as string);
    } else {
      const initialLng = await window.electronAPI.getInitialLanguage();
      console.log(`UI: Received initial language: ${initialLng}`);
      if (!i18n.isInitialized) await i18n.init();
      await i18n.changeLanguage(initialLng);
      console.log(`UI: i18next language set to: ${i18n.language}`);
    }
  } catch (error) {
    console.error("Error initializing i18n language:", error);
    try {
      if (!i18n.isInitialized) await i18n.init();
      if (!i18n.language) {
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
      }
    } catch (fallbackError) {
      console.error("Error setting fallback language:", fallbackError);
    }
  } finally {
    // --- Render the App ---
    // ThemeHandler is still needed to listen for subsequent changes
    root.render(
      <StrictMode>
        <ThemeHandler />
        <App />
      </StrictMode>
    );
  }
};

// Use void operator for floating promise
void initializeApp();

// Export applyTheme for use in SettingsModal etc.
export { applyTheme };
