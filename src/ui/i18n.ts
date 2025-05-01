import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";

const isDevelopment = import.meta.env.DEV;

export const supportedLngs = ["en", "es", "de", "ja", "fr", "pt", "ru", "it"];
export const fallbackLng = "en";

// Configure i18n but don't initialize it yet
// This prevents multiple initializations
i18n.use(HttpApi).use(initReactI18next);

// Import the InitOptions type from i18next for proper typing
import type { InitOptions } from "i18next";

// Export the i18n configuration options for use in main.tsx
export const i18nOptions: InitOptions = {
  fallbackLng: fallbackLng,
  supportedLngs: supportedLngs,
  ns: ["common", "form", "results", "errors", "dialogs", "cache", "settings"],
  defaultNS: "common",
  load: "languageOnly", // This is now properly typed as "languageOnly" | "all" | "currentOnly" | undefined
  backend: {
    loadPath: "/locales/{{lng}}/{{ns}}.json",
  },
  debug: isDevelopment,
  react: {
    useSuspense: false,
  },
  interpolation: {
    escapeValue: false,
  },
  initImmediate: false,
  keySeparator: ":",
};

export default i18n;
