import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import i18n from "./i18n"; // Import your i18n configuration
import "./index.css";
import 'highlight.js/styles/github-dark.css'; // Import highlight.js CSS theme

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Failed to find the root element");

const root = createRoot(rootElement);

// Asynchronously initialize i18n and then render the app
const initializeApp = async () => {
  try {
    // Check if electronAPI is available (preload script finished)
    if (!window.electronAPI?.getInitialLanguage) {
        console.error("Electron API not ready for language initialization.");
        // Fallback or wait? For now, fallback to default English.
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
    } else {
        // Get initial language from main process
        const initialLng = await window.electronAPI.getInitialLanguage();
        console.log(`UI: Received initial language: ${initialLng}`);
        // Set the language in i18next, this triggers resource loading
        await i18n.changeLanguage(initialLng);
        console.log(`UI: i18next language set to: ${i18n.language}`);
    }

  } catch (error) {
    console.error("Error initializing i18n language:", error);
    // Fallback to default language on error
    if (!i18n.language) { // Check if language was set at all
        await i18n.changeLanguage(i18n.options.fallbackLng as string);
    }
  } finally {
    // Render the app only after i18n is initialized (or fallback attempted)
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
  }
};

// Start the initialization process
initializeApp();
