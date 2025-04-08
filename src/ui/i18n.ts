import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";

const isDevelopment = import.meta.env.DEV;

export const supportedLngs = ["en", "es", "de", "ja", "fr", "pt", "ru", "it"];
export const fallbackLng = "en";

// Use void operator for floating promise
void i18n
  .use(HttpApi)
  .use(initReactI18next)
  .init({
    fallbackLng: fallbackLng,
    supportedLngs: supportedLngs,
    ns: ["common", "form", "results", "errors", "dialogs"],
    defaultNS: "common",
    load: "languageOnly",
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
  });

export default i18n;
