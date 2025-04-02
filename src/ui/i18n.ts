import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import HttpApi from "i18next-http-backend";
// Import isDev utility if available and configured for renderer, otherwise use import.meta.env.DEV
// Assuming isDev is not directly usable here, use Vite's env variable
const isDevelopment = import.meta.env.DEV;

export const supportedLngs = ['en', 'es', 'de', 'ja', 'fr', 'pt', 'ru', 'it'];
export const fallbackLng = 'en';

i18n
  // Load translations using http -> see /public/locales
  // (works for Vite dev server and relative paths in production build)
  .use(HttpApi)
  // Pass the i18n instance to react-i18next.
  .use(initReactI18next)
  // Initialize i18next
  .init({
    // --- Basic Options ---
    // lng: 'en', // We will set the language dynamically later
    fallbackLng: fallbackLng,
    supportedLngs: supportedLngs,
    // Define namespaces (you'll add more in Phase 2)
    ns: ['common', 'form', 'results', 'errors'],
    defaultNS: 'common',
    // Load only the specific language, not fallbacks like en-US -> en
    load: 'languageOnly',

    // --- Backend Options (i18next-http-backend) ---
    backend: {
      // Path where resources get loaded from, relative to the domain
      // Vite serves files from 'public' at the root '/'
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    },

    // --- Debugging ---
    debug: isDevelopment, // Enable logs in development

    // --- React Integration ---
    react: {
      // Set to false if you don't want to use Suspense globally
      useSuspense: false,
    },

    // --- Other Options ---
    interpolation: {
      escapeValue: false, // Not needed for React as it escapes by default
    },

    // --- IMPORTANT ---
    // Defer initialization until language is explicitly set
    initImmediate: false,
  });

export default i18n;
