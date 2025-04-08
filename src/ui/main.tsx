import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n from "./i18n";
import { ThemeHandler, applyTheme } from "./ThemeManager";
import "./index.css";
import 'highlight.js/styles/github-dark.css';

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

const initializeApp = async () => {
  try {
    if (!window.electronAPI?.getInitialLanguage) {
        console.error("Electron API not ready for language initialization.");
        // Ensure i18n is initialized before changing language
        if (!i18n.isInitialized) await i18n.init();
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
    } else {
        const initialLng = await window.electronAPI.getInitialLanguage();
        console.log(`UI: Received initial language: ${initialLng}`);
        // Ensure i18n is initialized before changing language
        if (!i18n.isInitialized) await i18n.init();
        await i18n.changeLanguage(initialLng);
        console.log(`UI: i18next language set to: ${i18n.language}`);
    }

  } catch (error) {
    console.error("Error initializing i18n language:", error);
    try {
        // Attempt to initialize and set fallback language on error
        if (!i18n.isInitialized) await i18n.init();
        if (!i18n.language) {
            await i18n.changeLanguage(i18n.options.fallbackLng as string);
        }
    } catch (fallbackError) {
        console.error("Error setting fallback language:", fallbackError);
    }
  } finally {
    // Render the app only after language initialization attempt
    root.render(
      <StrictMode>
        <ThemeHandler />
        <App />
      </StrictMode>,
    );
  }
};

// Use void operator for floating promise
void initializeApp();

export { applyTheme };
