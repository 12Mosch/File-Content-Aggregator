import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n, { i18nOptions } from "./i18n";
import { ThemeHandler } from "./ThemeManager";
import { applyTheme } from "./themeUtils";
import ErrorBoundary from "../components/ErrorBoundary";
import { getErrorHandler } from "../lib/services/ErrorHandlingService";
import "./index.css";
import "highlight.js/styles/github-dark.css";
import "./styles/highlight-themes.css";
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
    // Initialize i18n only once with the options from i18n.ts
    if (!i18n.isInitialized) {
      // Using type assertion to handle i18next API compatibility
      await i18n.init(i18nOptions);
      console.log("UI: i18next initialized with options");
    }

    // Set the language based on user preference or system default
    if (!window.electronAPI?.getInitialLanguage) {
      console.error("Electron API not ready for language initialization.");
      await i18n.changeLanguage(
        typeof i18nOptions.fallbackLng === "string"
          ? i18nOptions.fallbackLng
          : "en"
      );
    } else {
      const initialLng = await window.electronAPI.getInitialLanguage();
      console.log(`UI: Received initial language: ${initialLng}`);
      await i18n.changeLanguage(initialLng);
      console.log(`UI: i18next language set to: ${i18n.language}`);
    }
  } catch (error) {
    console.error("Error initializing i18n language:", error);
    try {
      // If there was an error and i18n is still not initialized, try one more time
      if (!i18n.isInitialized) {
        // Using type assertion to handle i18next API compatibility
        await i18n.init(i18nOptions);
      }
      if (!i18n.language) {
        await i18n.changeLanguage(
          typeof i18nOptions.fallbackLng === "string"
            ? i18nOptions.fallbackLng
            : "en"
        );
      }
    } catch (fallbackError) {
      console.error("Error setting fallback language:", fallbackError);
    }
  } finally {
    // Initialize error handler
    const errorHandler = getErrorHandler();

    // --- Render the App ---
    // ThemeHandler is still needed to listen for subsequent changes
    root.render(
      <StrictMode>
        <ErrorBoundary
          component="RootApp"
          onError={(error, errorInfo) => {
            errorHandler.handleError(error, {
              context: {
                component: "RootApp",
                operation: "rendering",
                data: errorInfo,
              },
            });
          }}
        >
          <ThemeHandler />
          <App />
        </ErrorBoundary>
      </StrictMode>
    );
  }
};

// Use void operator for floating promise
void initializeApp();

// Export applyTheme for use in SettingsModal etc.
export { applyTheme };
