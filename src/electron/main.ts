import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  session,
  protocol,
  nativeTheme,
  shell,
  WebFrameMain,
} from "electron";
import path from "path";
import fs from "fs/promises";
import Store from "electron-store";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
import type PLimit from "p-limit";
import { getProfiler } from "../lib/utils/Profiler.js";
import {
  getErrorHandler,
  ErrorSeverity,
} from "../lib/services/ErrorHandlingService.js";
import {
  validateSender as validateIpcSender,
  wrapIpcHandler,
} from "./utils/errorHandling.js";

// Import from optimized file search service
import { searchFiles, updateSearchSettings } from "./FileSearchService.js";

// Import types from types.ts
import {
  SearchParams as FileSearchParams,
  ProgressData,
  SearchResult,
  CancellationChecker,
  StructuredItem,
} from "./types.js";
import type {
  ExportFormat,
  SearchParams as UISearchParams,
} from "../ui/vite-env.js";

import module from "node:module";
const require = module.createRequire(import.meta.url);
const mime = require("mime") as { getType: (path: string) => string | null };
// Import p-limit correctly for use
const pLimitModule = require("p-limit") as {
  default?: typeof PLimit;
  __esModule?: boolean;
};
const pLimit: typeof PLimit =
  pLimitModule.default ?? (pLimitModule as typeof PLimit);
// -------------------------------------------------------------

const APP_PROTOCOL = "app";
const supportedLngsMain = ["en", "es", "de", "ja", "fr", "pt", "ru", "it"];
const fallbackLngMain = "en";
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_STORE_KEY = "searchHistory";
const THEME_PREFERENCE_KEY = "themePreference";
const DEFAULT_EXPORT_FORMAT_KEY = "defaultExportFormat";
const FUZZY_SEARCH_BOOLEAN_ENABLED_KEY = "fuzzySearchBooleanEnabled";
const FUZZY_SEARCH_NEAR_ENABLED_KEY = "fuzzySearchNearEnabled";
const WHOLE_WORD_MATCHING_ENABLED_KEY = "wholeWordMatchingEnabled";
type ThemePreference = "light" | "dark" | "system";
const EXPORT_CONTENT_READ_CONCURRENCY = 10;

// Use the SearchParams type defined in vite-env.d.ts for history storage
// This includes the structuredQuery property as 'unknown'
interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  name?: string;
  isFavorite?: boolean;
  searchParams: UISearchParams;
}

// Interface for data passed to export generation functions (includes content)
interface ExportItem {
  filePath: string;
  status: "Matched" | "Not Matched" | "Read Error";
  details: string | null;
}

// Define constants for new settings keys
const PROFILING_ENABLED_KEY = "profilingEnabled";
const DETAILED_MEMORY_TRACKING_ENABLED_KEY = "detailedMemoryTrackingEnabled";

const schema = {
  userLanguage: { type: "string", enum: supportedLngsMain },
  [HISTORY_STORE_KEY]: {
    type: "array",
    items: {
      type: "object",
      properties: {
        id: { type: "string" },
        timestamp: { type: "string", format: "date-time" },
        name: { type: "string" },
        isFavorite: { type: "boolean" },
        searchParams: { type: "object" }, // Keep as object for schema validation
      },
      required: ["id", "timestamp", "searchParams"],
    },
    default: [],
  },
  [THEME_PREFERENCE_KEY]: {
    type: "string",
    enum: ["light", "dark", "system"],
    default: "system",
  },
  // New setting for default export format
  [DEFAULT_EXPORT_FORMAT_KEY]: {
    type: "string",
    enum: ["txt", "csv", "json", "md"],
    default: "txt",
  },
  // Setting for fuzzy search in Boolean queries
  [FUZZY_SEARCH_BOOLEAN_ENABLED_KEY]: {
    type: "boolean",
    default: true,
  },
  // Setting for fuzzy search in NEAR function
  [FUZZY_SEARCH_NEAR_ENABLED_KEY]: {
    type: "boolean",
    default: true,
  },
  // Setting for whole word matching
  [WHOLE_WORD_MATCHING_ENABLED_KEY]: {
    type: "boolean",
    default: false,
  },
  // Setting for performance profiling
  [PROFILING_ENABLED_KEY]: {
    type: "boolean",
    default: false,
  },
  // Setting for detailed memory tracking
  [DETAILED_MEMORY_TRACKING_ENABLED_KEY]: {
    type: "boolean",
    default: false,
  },
};
const store = new Store<{
  userLanguage?: string;
  searchHistory: SearchHistoryEntry[];
  themePreference: ThemePreference;
  defaultExportFormat: ExportFormat;
  fuzzySearchBooleanEnabled: boolean;
  fuzzySearchNearEnabled: boolean;
  wholeWordMatchingEnabled: boolean;
  profilingEnabled: boolean;
  detailedMemoryTrackingEnabled: boolean;
}>({ schema });

const i18nMain = i18next.createInstance();
void i18nMain.use(Backend).init({
  fallbackLng: fallbackLngMain,
  supportedLngs: supportedLngsMain,
  ns: ["common", "dialogs", "cache", "settings"],
  defaultNS: "common",
  backend: {
    loadPath: isDev()
      ? path.resolve("public/locales/{{lng}}/{{ns}}.json")
      : path.join(app.getAppPath(), "dist-react/locales/{{lng}}/{{ns}}.json"),
  },
  initImmediate: false,
  keySeparator: ":",
});
async function initializeMainI18nLanguage() {
  let initialLang = fallbackLngMain;
  try {
    const storedLang = store.get("userLanguage");
    if (storedLang && supportedLngsMain.includes(storedLang)) {
      initialLang = storedLang;
    } else {
      const osLocale = app.getLocale() || app.getSystemLocale();
      const baseLang = osLocale.split("-")[0];
      if (supportedLngsMain.includes(baseLang)) {
        initialLang = baseLang;
      }
    }
  } catch (error: unknown) {
    console.error(
      "Main i18n: Error getting initial language:",
      error instanceof Error ? error.message : error
    );
  }
  if (!i18nMain.isInitialized) {
    try {
      await i18nMain.init();
      await i18nMain.loadNamespaces(["common", "dialogs"]);
    } catch (initError: unknown) {
      console.error(
        "Main i18n: Failed to initialize or load namespaces:",
        initError instanceof Error ? initError.message : initError
      );
    }
  }
  if (i18nMain.isInitialized) {
    try {
      await i18nMain.changeLanguage(initialLang);
      console.log(`Main i18n initialized with language: ${i18nMain.language}`);
    } catch (changeLangError: unknown) {
      console.error(
        `Main i18n: Failed to change language to ${initialLang}:`,
        changeLangError instanceof Error
          ? changeLangError.message
          : changeLangError
      );
    }
  } else {
    console.error("Main i18n: Initialization failed, cannot set language.");
  }
}

let mainWindow: BrowserWindow | null = null;
let isSearchCancelled = false;

function registerAppProtocol() {
  void protocol.handle(APP_PROTOCOL, async (request) => {
    const originalUrl = request.url;
    try {
      const urlPath = decodeURIComponent(
        originalUrl.substring(`${APP_PROTOCOL}://`.length)
      );
      let requestedPath = urlPath.startsWith("index.html/")
        ? urlPath.substring("index.html/".length)
        : urlPath;
      requestedPath = requestedPath.replace(/^\/+/, "");
      if (!requestedPath || requestedPath === "/") {
        requestedPath = "index.html";
      }
      const appRootPath = app.getAppPath();
      const absoluteFilePath = path.join(
        appRootPath,
        "dist-react",
        requestedPath
      );
      const expectedBase = path.normalize(path.join(appRootPath, "dist-react"));
      if (!path.normalize(absoluteFilePath).startsWith(expectedBase)) {
        console.error(
          `[Protocol Handler] Blocked path traversal: ${requestedPath}`
        );
        return new Response("Forbidden", { status: 403 });
      }
      let data: Buffer;
      try {
        data = await fs.readFile(absoluteFilePath);
      } catch (readError: unknown) {
        if (
          typeof readError === "object" &&
          readError !== null &&
          "code" in readError &&
          readError.code === "ENOENT"
        ) {
          return new Response("Not Found", { status: 404 });
        }
        throw readError;
      }
      let resolvedMimeType: string | null;
      const fileExtension = path.extname(absoluteFilePath).toLowerCase();
      if (requestedPath === "index.html" || fileExtension === ".html")
        resolvedMimeType = "text/html";
      else if (fileExtension === ".css") resolvedMimeType = "text/css";
      else if (fileExtension === ".js")
        resolvedMimeType = "application/javascript";
      else if (fileExtension === ".json") resolvedMimeType = "application/json";
      else if (fileExtension === ".svg") resolvedMimeType = "image/svg+xml";
      else if (fileExtension === ".png") resolvedMimeType = "image/png";
      else if (fileExtension === ".jpg" || fileExtension === ".jpeg")
        resolvedMimeType = "image/jpeg";
      else if (fileExtension === ".woff2") resolvedMimeType = "font/woff2";
      else if (fileExtension === ".woff") resolvedMimeType = "font/woff";
      else resolvedMimeType = mime.getType(absoluteFilePath);

      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": resolvedMimeType ?? "application/octet-stream",
        },
      });
    } catch (error: unknown) {
      console.error(
        `[Protocol Handler] Error for ${originalUrl}:`,
        error instanceof Error ? error.message : error
      );
      return new Response("Internal Server Error", { status: 500 });
    }
  });
  console.log(`Custom protocol "${APP_PROTOCOL}://" registered.`);
}
/**
 * Sets up Content Security Policy for the application.
 *
 * In development mode, we need to allow:
 * - Vite's dev server and WebSocket connections
 * - Unsafe inline scripts and eval for HMR (but restricted to dev server origin)
 *
 * In production mode, we use a much stricter policy:
 * - Only allow resources from our custom app protocol
 * - No unsafe-eval or unsafe-inline except where absolutely necessary
 * - Proper restrictions on all resource types
 */
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let csp = "";
    const selfSrc = `'self'`;
    const appProtoSrc = `${APP_PROTOCOL}:`;

    if (isDev()) {
      // Development mode - needs to allow Vite's dev server
      const viteServer = "http://localhost:5123";
      const viteWs = "ws://localhost:5123";

      // We need unsafe-inline and unsafe-eval for development with Vite
      // But we restrict it to only what's necessary
      csp = [
        `default-src ${selfSrc} ${viteServer}`,
        // Allow unsafe-eval only for development, but restrict to self and Vite server
        `script-src ${selfSrc} ${viteServer} 'unsafe-inline' 'unsafe-eval'`,
        `style-src ${selfSrc} ${viteServer} 'unsafe-inline'`,
        `connect-src ${selfSrc} ${viteWs} ${viteServer}`,
        `img-src ${selfSrc} data:`,
        `font-src ${selfSrc}`,
        `worker-src ${selfSrc} blob:`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'none'`,
      ].join("; ");
    } else {
      // Production mode - much stricter CSP
      csp = [
        `default-src 'self' ${appProtoSrc}`,
        `script-src 'self' ${appProtoSrc} blob:`,
        `style-src 'self' ${appProtoSrc} 'unsafe-inline'`, // Unsafe-inline needed for styled-components/CSS-in-JS
        `connect-src 'self' ${appProtoSrc}`,
        `img-src 'self' ${appProtoSrc} data:`,
        `font-src 'self' ${appProtoSrc}`,
        `worker-src 'self' ${appProtoSrc} blob:`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
        `base-uri 'self'`,
        `form-action 'none'`,
      ].join("; ");
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
        "X-Content-Type-Options": ["nosniff"],
        "X-Frame-Options": ["DENY"],
        "Referrer-Policy": ["strict-origin-when-cross-origin"],
        "Permissions-Policy": ["camera=(), microphone=(), geolocation=()"],
      },
    });
  });
}
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (isDev()) {
    void mainWindow.loadURL("http://localhost:5123");
    mainWindow.webContents.openDevTools();
  } else {
    void mainWindow.loadURL(`${APP_PROTOCOL}://index.html`);
  }
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  // Check for profiling flag and load performance test script if enabled
  const enableProfiling = process.argv.includes("--profile");
  if (enableProfiling && isDev() && mainWindow) {
    mainWindow.webContents.on("did-finish-load", () => {
      // Load the performance test script
      if (mainWindow) {
        void mainWindow.webContents.executeJavaScript(
          `const script = document.createElement('script');
          script.src = 'http://localhost:5123/scripts/performanceTest.js';
          document.head.appendChild(script);`
        );
        console.log("Performance test script loaded");
      }
    });
  }
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);
void app.whenReady().then(async () => {
  // Always enable profiling by default with detailed memory tracking
  const detailedMemoryTracking = true;
  getProfiler().setEnabled(true, { detailedMemoryTracking });
  store.set(PROFILING_ENABLED_KEY, true);
  store.set(DETAILED_MEMORY_TRACKING_ENABLED_KEY, true);
  console.log("Performance profiling enabled with detailed memory tracking");

  await initializeMainI18nLanguage();
  try {
    const storedTheme = store.get(THEME_PREFERENCE_KEY, "system");
    nativeTheme.themeSource = storedTheme;
    console.log(
      `Main: Initial nativeTheme.themeSource set to "${storedTheme}"`
    );

    // Initialize search settings
    const fuzzySearchBooleanEnabled = store.get(
      FUZZY_SEARCH_BOOLEAN_ENABLED_KEY,
      true
    );
    const fuzzySearchNearEnabled = store.get(
      FUZZY_SEARCH_NEAR_ENABLED_KEY,
      true
    );
    const wholeWordMatchingEnabled = store.get(
      WHOLE_WORD_MATCHING_ENABLED_KEY,
      false
    );
    // Use the new updateSearchSettings function
    updateSearchSettings(
      fuzzySearchBooleanEnabled,
      fuzzySearchNearEnabled,
      wholeWordMatchingEnabled
    );
    console.log(
      `Main: Initial search settings - Boolean: ${fuzzySearchBooleanEnabled}, NEAR: ${fuzzySearchNearEnabled}, WholeWord: ${wholeWordMatchingEnabled}`
    );
  } catch (error: unknown) {
    console.error(
      "Main: Error setting initial theme source or fuzzy search settings:",
      error instanceof Error ? error.message : error
    );
  }
  setupCSP();
  registerAppProtocol();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});
app.on("window-all-closed", () => {
  // Always quit the application when all windows are closed, even on macOS
  // This is a change from the Electron default behavior where apps keep running on macOS
  console.log("All windows closed, quitting application...");
  app.quit();

  // Force exit after a short delay to ensure all resources are cleaned up
  // This is particularly important on Windows where background processes might persist
  setTimeout(() => {
    console.log("Forcing immediate exit to ensure complete termination...");
    process.exit(0);
  }, 200); // Slightly longer delay to allow for cleanup operations
});

// Ensure clean termination in development mode
if (isDev()) {
  app.on("before-quit", () => {
    console.log("Application is quitting, preparing to terminate process...");
    // Clean up any development-specific resources here if needed
  });

  // Handle the 'will-quit' event in development mode
  app.on("will-quit", () => {
    console.log("Application will quit, ensuring all processes terminate...");
    // Force exit with a short delay to ensure logs are written
    setTimeout(() => {
      console.log("Forcing exit from will-quit event in development mode...");
      process.exit(0);
    }, 200);
  });
}

// Handle profiling data saving in production mode or when profiling is enabled
app.on("will-quit", (event) => {
  // Skip this handler in development mode as we have a separate handler for that
  if (isDev()) return;

  // Use async IIFE to handle async operations
  void (async () => {
    // Save profiling data if profiling was enabled
    const profiler = getProfiler();
    if (profiler.isEnabled()) {
      event.preventDefault(); // Prevent quitting until we save the report

      try {
        const timestamp = new Date().toISOString().replace(/:/g, "-");
        // Save to project directory instead of user data directory
        const reportPath = path.join(
          __dirname,
          "..",
          "..",
          "performance-results",
          `profile-report-${timestamp}.json`
        );

        // Ensure directory exists
        const fs = await import("fs/promises");
        try {
          await fs.mkdir(path.dirname(reportPath), { recursive: true });
        } catch (_error) {
          // Ignore if directory already exists
        }

        await profiler.saveReport(reportPath);
        console.log(`Profiling report saved to: ${reportPath}`);

        // Log the report to the console as well
        profiler.logReport();
      } catch (error) {
        console.error("Failed to save profiling report:", error);
      } finally {
        // Continue with app quit
        app.quit();
      }
    }
  })();
});
app.on("web-contents-created", (_event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const allowedOrigin = isDev()
      ? "http://localhost:5123"
      : `${APP_PROTOCOL}://`;
    if (!navigationUrl.startsWith(allowedOrigin)) {
      console.warn(`Security: Blocked navigation to ${navigationUrl}`);
      event.preventDefault();
    }
  });
  contents.setWindowOpenHandler(({ url }) => {
    console.warn(`Security: Blocked new window for ${url}`);
    return { action: "deny" };
  });
});

/**
 * Validates that the IPC message sender is the main frame of the main window.
 * @param senderFrame The WebFrameMain object of the sender.
 * @returns True if the sender is valid, false otherwise.
 */
function validateSender(senderFrame: WebFrameMain | null): boolean {
  return validateIpcSender(senderFrame, mainWindow);
}

// --- Export Helper Functions ---

/**
 * Escapes a string for CSV format.
 * Wraps the string in double quotes if it contains commas, double quotes, or newlines.
 * Doubles up existing double quotes within the string.
 */
function escapeCsvField(field: string | null | undefined): string {
  if (field === null || field === undefined) {
    return "";
  }
  const str = String(field);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generates CSV content from enriched export items (including content).
 */
function generateCsv(items: ExportItem[]): string {
  const header = ["FilePath", "Status", "Details"];
  const rows = items.map((item) => {
    return [
      escapeCsvField(item.filePath),
      escapeCsvField(item.status),
      escapeCsvField(item.details),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

/**
 * Generates JSON content from enriched export items (including content).
 */
function generateJson(items: ExportItem[]): string {
  try {
    return JSON.stringify(items, null, 2);
  } catch (error: unknown) {
    console.error("Error generating JSON:", error);
    throw new Error(
      `Failed to serialize results to JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generates Markdown content from enriched export items (including content).
 */
function generateMarkdown(items: ExportItem[]): string {
  return items
    .map((item) => {
      const details =
        item.status === "Read Error"
          ? `Error: ${item.details}`
          : (item.details ?? "No content.");

      return `## ${item.filePath} (Status: ${item.status})\n\n\`\`\`\n${details}\n\`\`\`\n`;
    })
    .join("\n---\n\n"); // Separate entries with a horizontal rule
}

/**
 * Generates plain text content from enriched export items (including content).
 */
function generateTxt(items: ExportItem[]): string {
  return items
    .map((item) => {
      const details =
        item.status === "Read Error"
          ? `Error: ${item.details}`
          : (item.details ?? "No content.");

      return `${item.filePath} (Status: ${item.status})\n${details}\n`;
    })
    .join("\n----------------------------------------\n\n"); // Separator
}

// --- Search History Helper ---

/**
 * Compares two SearchParams objects for equality, ignoring structuredQuery and array order.
 * @param params1 First SearchParams object.
 * @param params2 Second SearchParams object.
 * @returns True if the parameters are considered equal for history de-duplication.
 */
function areSearchParamsEqual(
  params1: UISearchParams | undefined,
  params2: UISearchParams | undefined
): boolean {
  if (!params1 || !params2) return params1 === params2; // Both must be defined

  // Compare simple properties
  if (
    params1.folderExclusionMode !== params2.folderExclusionMode ||
    params1.contentSearchTerm !== params2.contentSearchTerm ||
    params1.contentSearchMode !== params2.contentSearchMode ||
    params1.caseSensitive !== params2.caseSensitive ||
    params1.modifiedAfter !== params2.modifiedAfter ||
    params1.modifiedBefore !== params2.modifiedBefore ||
    params1.minSizeBytes !== params2.minSizeBytes ||
    params1.maxSizeBytes !== params2.maxSizeBytes ||
    params1.maxDepth !== params2.maxDepth
  ) {
    return false;
  }

  // Compare array properties (order-insensitive)
  const compareArrays = (arr1?: string[], arr2?: string[]): boolean => {
    const sorted1 = arr1 ? [...arr1].sort() : [];
    const sorted2 = arr2 ? [...arr2].sort() : [];
    return (
      sorted1.length === sorted2.length &&
      sorted1.every((val, index) => val === sorted2[index])
    );
  };

  if (
    !compareArrays(params1.searchPaths, params2.searchPaths) ||
    !compareArrays(params1.extensions, params2.extensions) ||
    !compareArrays(params1.excludeFiles, params2.excludeFiles) ||
    !compareArrays(params1.excludeFolders, params2.excludeFolders)
  ) {
    return false;
  }

  // Ignore structuredQuery for comparison
  return true;
}

// --- IPC Handlers ---

/**
 * Handles the 'search-files' IPC request from the renderer process.
 * Performs the file search based on the provided parameters.
 */
ipcMain.handle(
  "search-files",
  async (event, params: FileSearchParams): Promise<SearchResult> => {
    if (!validateSender(event.senderFrame))
      return {
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 1,
        pathErrors: ["Invalid IPC sender"],
        fileReadErrors: [],
      };

    isSearchCancelled = false;
    console.log("Starting search, cancellation flag reset.");

    const progressCallback = (data: ProgressData) => {
      if (mainWindow && !mainWindow.isDestroyed())
        mainWindow.webContents.send("search-progress", data);
    };

    const checkCancellation: CancellationChecker = () => {
      return isSearchCancelled;
    };

    try {
      const results = await searchFiles(
        params,
        progressCallback,
        checkCancellation
      );
      return results;
    } catch (error: unknown) {
      const errorMsg = `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      progressCallback({
        processed: 0,
        total: 0,
        message: errorMsg,
        error: error instanceof Error ? error.message : String(error),
        status: "error",
      });
      return {
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 1,
        pathErrors: [errorMsg],
        fileReadErrors: [],
      };
    }
  }
);

/**
 * Handles the 'cancel-search' IPC message from the renderer process.
 * Sets the cancellation flag for the ongoing search.
 */
ipcMain.on("cancel-search", (event) => {
  if (!validateSender(event.senderFrame)) {
    console.warn("IPC: Received cancel-search from invalid sender.");
    return;
  }
  console.log("IPC: Received cancel-search request. Setting flag.");
  isSearchCancelled = true;

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("search-progress", {
      status: "cancelling",
      message: "Cancellation requested...",
      processed: -1,
      total: -1,
    });
  }
});

/**
 * Handles the 'copy-to-clipboard' IPC request.
 * Copies the provided text content to the system clipboard.
 */
ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => {
  if (!validateSender(event.senderFrame)) return false;
  try {
    clipboard.writeText(content);
    return true;
  } catch (error: unknown) {
    console.error(
      "IPC: Error copying to clipboard:",
      error instanceof Error ? error.message : error
    );
    return false;
  }
});

/**
 * Handles the 'get-initial-language' IPC request.
 * Determines and returns the initial language for the UI based on stored preference or OS locale.
 */
ipcMain.handle("get-initial-language", (event): Promise<string> => {
  if (!validateSender(event.senderFrame))
    return Promise.resolve(fallbackLngMain);
  return new Promise((resolve) => {
    try {
      const storedLang = store.get("userLanguage");
      if (storedLang && supportedLngsMain.includes(storedLang)) {
        resolve(storedLang);
        return;
      }
      const osLocale = app.getLocale() || app.getSystemLocale();
      const baseLang = osLocale.split("-")[0];
      if (supportedLngsMain.includes(baseLang)) {
        resolve(baseLang);
        return;
      }
      resolve(fallbackLngMain);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting initial language:",
        error instanceof Error ? error.message : error
      );
      resolve(fallbackLngMain);
    }
  });
});

/**
 * Handles the 'set-language-preference' IPC request.
 * Stores the user's selected language preference.
 */
ipcMain.handle(
  "set-language-preference",
  (event, lng: string): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      if (supportedLngsMain.includes(lng)) {
        try {
          store.set("userLanguage", lng);
        } catch (error: unknown) {
          console.error(
            "IPC: Error saving language preference:",
            error instanceof Error ? error.message : error
          );
        }
      } else {
        console.warn(`IPC: Attempted to save unsupported language: ${lng}`);
      }
      resolve();
    });
  }
);

/**
 * Handles the 'language-changed' IPC message from the renderer.
 * Updates the main process i18n instance language.
 */
ipcMain.on("language-changed", (event, lng: string) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) return;
  if (supportedLngsMain.includes(lng))
    void i18nMain
      .changeLanguage(lng)
      .catch((err) =>
        console.error("Main i18n: Error changing language:", err)
      );
  else
    console.warn(
      `Main i18n: Received unsupported language change request: ${lng}`
    );
});

/**
 * Handles the 'add-search-history-entry' IPC request.
 * Adds a new entry to the search history, preventing exact duplicates based on searchParams.
 * If a duplicate is found, it updates the timestamp of the existing entry and moves it to the top.
 */
ipcMain.handle(
  "add-search-history-entry",
  (event, newEntry: SearchHistoryEntry): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const currentHistory = store.get(HISTORY_STORE_KEY, []);
        const updatedHistory = [...currentHistory];

        // Find if an entry with the same searchParams already exists
        const existingEntryIndex = updatedHistory.findIndex((entry) =>
          areSearchParamsEqual(entry.searchParams, newEntry.searchParams)
        );

        if (existingEntryIndex > -1) {
          // Duplicate found: Update timestamp and move to top
          console.log(
            `IPC: Found duplicate history entry at index ${existingEntryIndex}. Updating timestamp.`
          );
          const existingEntry = updatedHistory[existingEntryIndex];
          // Remove the old entry
          updatedHistory.splice(existingEntryIndex, 1);
          // Prepend the existing entry with updated timestamp, keeping original name/favorite
          updatedHistory.unshift({
            ...existingEntry, // Keep original ID, name, favorite, params
            timestamp: newEntry.timestamp, // Update timestamp
          });
        } else {
          // No duplicate: Add the new entry to the top
          console.log(`IPC: Adding new history entry ${newEntry.id}.`);
          const entryWithDefaults = {
            ...newEntry,
            name: newEntry.name ?? "",
            isFavorite: newEntry.isFavorite ?? false,
          };
          updatedHistory.unshift(entryWithDefaults); // Add to the beginning

          // Ensure history doesn't exceed the maximum size
          if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
            updatedHistory.length = MAX_HISTORY_ENTRIES; // Trim the end
          }
        }

        // Save the potentially modified history
        store.set(HISTORY_STORE_KEY, updatedHistory);
        console.log(
          `IPC: History updated. Total entries: ${updatedHistory.length}`
        );
      } catch (error: unknown) {
        console.error(
          "IPC: Error adding/updating search history entry:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Handles the 'get-search-history' IPC request.
 * Retrieves the search history from electron-store.
 */
ipcMain.handle("get-search-history", (event): Promise<SearchHistoryEntry[]> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve([]);
  return new Promise((resolve) => {
    try {
      const history = store.get(HISTORY_STORE_KEY, []);
      resolve(
        history.map((entry) => ({
          ...entry,
          name: entry.name ?? "",
          isFavorite: entry.isFavorite ?? false,
        }))
      );
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting search history:",
        error instanceof Error ? error.message : error
      );
      resolve([]);
    }
  });
});

/**
 * Handles the 'delete-search-history-entry' IPC request.
 * Removes a specific entry from the search history.
 */
ipcMain.handle(
  "delete-search-history-entry",
  (event, entryId: string): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const currentHistory = store.get(HISTORY_STORE_KEY, []);
        const updatedHistory = currentHistory.filter(
          (entry) => entry.id !== entryId
        );
        store.set(HISTORY_STORE_KEY, updatedHistory);
        console.log(
          `IPC: Deleted history entry ${entryId}. Remaining: ${updatedHistory.length}`
        );
      } catch (error: unknown) {
        console.error(
          `IPC: Error deleting search history entry ${entryId}:`,
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Handles the 'clear-search-history' IPC request.
 * Removes all entries from the search history.
 */
ipcMain.handle("clear-search-history", (event): Promise<boolean> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      store.set(HISTORY_STORE_KEY, []);
      console.log("IPC: Cleared search history.");
      resolve(true);
    } catch (error: unknown) {
      console.error(
        "IPC: Error clearing search history:",
        error instanceof Error ? error.message : error
      );
      resolve(false);
    }
  });
});

/**
 * Handles the 'update-search-history-entry' IPC request.
 * Updates the name or favorite status of a specific history entry.
 */
ipcMain.handle(
  "update-search-history-entry",
  (
    event,
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
  ): Promise<boolean> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve(false);
    if (
      !entryId ||
      !updates ||
      (updates.name === undefined && updates.isFavorite === undefined)
    )
      return Promise.resolve(false);
    return new Promise((resolve) => {
      try {
        const currentHistory = store.get(HISTORY_STORE_KEY, []);
        let updated = false;
        const updatedHistory = currentHistory.map((entry) => {
          if (entry.id === entryId) {
            updated = true;
            return {
              ...entry,
              ...(updates.name !== undefined && { name: updates.name }),
              ...(updates.isFavorite !== undefined && {
                isFavorite: updates.isFavorite,
              }),
            };
          }
          return entry;
        });
        if (updated) {
          store.set(HISTORY_STORE_KEY, updatedHistory);
          console.log(`IPC: Updated history entry ${entryId} with:`, updates);
          resolve(true);
        } else {
          console.warn(`IPC: History entry ${entryId} not found for update.`);
          resolve(false);
        }
      } catch (error: unknown) {
        console.error(
          `IPC: Error updating search history entry ${entryId}:`,
          error instanceof Error ? error.message : error
        );
        resolve(false);
      }
    });
  }
);

/**
 * Handles the 'get-theme-preference' IPC request.
 * Retrieves the user's stored theme preference.
 */
ipcMain.handle("get-theme-preference", (event): Promise<ThemePreference> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve("system");
  return new Promise((resolve) => {
    try {
      const preference = store.get(THEME_PREFERENCE_KEY, "system");
      resolve(preference);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting theme preference:",
        error instanceof Error ? error.message : error
      );
      resolve("system");
    }
  });
});

/**
 * Handles the 'set-theme-preference' IPC request.
 * Stores the user's selected theme preference and applies it to the native theme source.
 * Also notifies the renderer process about the change.
 */
ipcMain.handle(
  "set-theme-preference",
  (event, theme: ThemePreference): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      if (["light", "dark", "system"].includes(theme)) {
        try {
          store.set(THEME_PREFERENCE_KEY, theme);
          nativeTheme.themeSource = theme;
          console.log(
            `IPC: Theme preference saved and nativeTheme.themeSource set to "${theme}"`
          );

          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("theme-preference-changed", theme);
            console.log(
              `IPC: Sent theme-preference-changed event with theme: ${theme}`
            );
          }
        } catch (error: unknown) {
          console.error(
            `IPC: Error setting theme preference to "${theme}":`,
            error instanceof Error ? error.message : error
          );
        }
      } else {
        console.warn(
          `IPC: Attempted to save invalid theme preference: ${theme}`
        );
      }
      resolve();
    });
  }
);

/**
 * Reads content for multiple files concurrently, respecting a limit.
 * @param items The structured items (containing file paths) to read content for.
 * @returns A promise resolving to an array of ExportItem objects including content or errors.
 */
async function fetchContentForExport(
  items: StructuredItem[]
): Promise<ExportItem[]> {
  const limit = pLimit(EXPORT_CONTENT_READ_CONCURRENCY);
  const promises = items.map((item) =>
    limit(async (): Promise<ExportItem> => {
      let status: ExportItem["status"] = item.readError
        ? "Read Error"
        : item.matched
          ? "Matched"
          : "Not Matched";
      let details: string | null = item.readError ?? null; // Start with initial error

      // If matched and no initial read error, try reading content now
      if (status === "Matched") {
        try {
          details = await fs.readFile(item.filePath, { encoding: "utf8" });
        } catch (readError: unknown) {
          console.warn(
            `Export: Failed to read content for ${item.filePath}:`,
            readError
          );
          status = "Read Error";
          details =
            readError instanceof Error ? readError.message : String(readError);
        }
      } else if (status === "Read Error" && details) {
        // If there was an initial read error, use its key as the detail
        details = `Initial Read Error: ${details}`;
      } else {
        details = null;
      }

      return {
        filePath: item.filePath,
        status: status,
        details: details,
      };
    })
  );

  return Promise.all(promises);
}

/**
 * Handles the 'export-results' IPC request.
 * Fetches content for matched files, generates content in the specified format,
 * prompts the user for a save location, and writes the file.
 */
ipcMain.handle(
  "export-results",
  async (
    event,
    items: StructuredItem[],
    format: ExportFormat
  ): Promise<{ success: boolean; error?: string }> => {
    if (!validateSender(event.senderFrame) || !mainWindow) {
      return { success: false, error: "Invalid sender or main window." };
    }
    if (!items || items.length === 0) {
      return { success: false, error: "No results to export." };
    }

    // Determine file extension and filters based on format
    let fileExtension: string;
    let fileTypeName: string;
    switch (format) {
      case "json":
        fileExtension = "json";
        fileTypeName = "JSON Files";
        break;
      case "md":
        fileExtension = "md";
        fileTypeName = "Markdown Files";
        break;
      case "txt":
        fileExtension = "txt";
        fileTypeName = "Text Files";
        break;
      case "csv":
      default:
        fileExtension = "csv";
        fileTypeName = "CSV Files";
        break;
    }

    try {
      // Fetch content for relevant items BEFORE showing save dialog
      console.log(`Export: Fetching content for ${items.length} items...`);
      const itemsWithContent = await fetchContentForExport(items);
      console.log(`Export: Content fetched.`);

      // Ensure i18n is ready for dialogs
      await i18nMain.loadNamespaces("dialogs");

      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: i18nMain.t("dialogs:exportDialogTitle"),
        buttonLabel: i18nMain.t("dialogs:exportDialogButtonLabel"),
        defaultPath: `file-content-aggregator-results.${fileExtension}`,
        filters: [
          { name: fileTypeName, extensions: [fileExtension] },
          {
            name: i18nMain.t("dialogs:exportDialogFilterAll"),
            extensions: ["*"],
          },
        ],
      });

      if (canceled || !filePath) {
        console.log("Export cancelled by user.");
        return { success: false, error: "Export cancelled." };
      }

      // Generate content based on format using itemsWithContent
      let content: string;
      try {
        switch (format) {
          case "json":
            content = generateJson(itemsWithContent);
            break;
          case "md":
            content = generateMarkdown(itemsWithContent);
            break;
          case "txt":
            content = generateTxt(itemsWithContent);
            break;
          case "csv":
          default:
            content = generateCsv(itemsWithContent);
            break;
        }
      } catch (genError: unknown) {
        const specificErrorMsg =
          genError instanceof Error ? genError.message : String(genError);
        const errorMsg = i18nMain.t("dialogs:exportGenerationError", {
          format: format.toUpperCase(),
          detail: specificErrorMsg,
        });
        console.error(
          `Export Error: Failed to generate ${format.toUpperCase()} content: ${specificErrorMsg}`
        );
        dialog.showErrorBox(i18nMain.t("dialogs:exportErrorTitle"), errorMsg);
        return { success: false, error: errorMsg };
      }

      // Write content to file
      try {
        await fs.writeFile(filePath, content, "utf8");
        console.log(`Results successfully exported to ${filePath}`);
        return { success: true };
      } catch (writeError: unknown) {
        const errorMsg = `Failed to write export file: ${filePath}\nError: ${writeError instanceof Error ? writeError.message : String(writeError)}`;
        console.error(errorMsg);
        dialog.showErrorBox("File Write Error", errorMsg);
        return { success: false, error: errorMsg };
      }
    } catch (fetchOrDialogError: unknown) {
      const errorMsg = `Error during export preparation: ${fetchOrDialogError instanceof Error ? fetchOrDialogError.message : String(fetchOrDialogError)}`;
      console.error(errorMsg);
      dialog.showErrorBox("Export Preparation Error", errorMsg);
      return { success: false, error: errorMsg };
    }
  }
);

/**
 * Handles the 'get-file-content' IPC request.
 * Reads and returns the content of a single specified file.
 * Used for on-demand loading in the UI's Tree View.
 */
ipcMain.handle(
  "get-file-content",
  wrapIpcHandler(
    async (
      event,
      filePath: string
    ): Promise<{ content: string | null; error?: string }> => {
      if (!validateSender(event.senderFrame)) {
        return { content: null, error: "Invalid sender." };
      }
      if (!filePath) {
        return { content: null, error: "No file path provided." };
      }

      console.log(`IPC: Received request for content of: ${filePath}`);
      try {
        const content = await fs.readFile(filePath, { encoding: "utf8" });
        return { content: content, error: undefined };
      } catch (error: unknown) {
        const errorHandler = getErrorHandler();
        errorHandler.handleError(error, {
          severity: ErrorSeverity.MEDIUM,
          context: {
            component: "FileContentHandler",
            operation: "readFile",
            data: { filePath },
          },
        });

        // Determine the error reason for translation
        let reasonKey = "readError"; // Default error reason
        const code = (error as { code?: string })?.code;
        if (code === "EPERM" || code === "EACCES") {
          reasonKey = "readPermissionDenied";
        } else if (code === "ENOENT") {
          reasonKey = "fileNotFoundDuringRead";
        } else if (code === "EISDIR") {
          reasonKey = "pathIsDir";
        }

        // Return the reason key for potential translation in the UI
        return { content: null, error: reasonKey };
      }
    },
    "FileContentHandler"
  )
);

/**
 * Handles the 'generate-export-content' IPC request.
 * Fetches content for matched files, generates the export content string,
 * but does *not* save it. Used for the "Copy to Clipboard" functionality.
 */
ipcMain.handle(
  "generate-export-content",
  async (
    event,
    items: StructuredItem[],
    format: ExportFormat
  ): Promise<{ content: string | null; error?: string }> => {
    if (!validateSender(event.senderFrame)) {
      return { content: null, error: "Invalid sender." };
    }
    if (!items) {
      return { content: null, error: "No items provided." };
    }

    try {
      // Fetch content for relevant items
      console.log(`Copy: Fetching content for ${items.length} items...`);
      const itemsWithContent = await fetchContentForExport(items);
      console.log(`Copy: Content fetched.`);

      let content: string;
      switch (format) {
        case "json":
          content = generateJson(itemsWithContent);
          break;
        case "md":
          content = generateMarkdown(itemsWithContent);
          break;
        case "txt":
          content = generateTxt(itemsWithContent);
          break;
        case "csv":
        default:
          content = generateCsv(itemsWithContent);
          break;
      }
      return { content: content, error: undefined };
    } catch (genError: unknown) {
      const specificErrorMsg =
        genError instanceof Error ? genError.message : String(genError);
      console.error(
        `IPC Error: Failed to generate ${format.toUpperCase()} content for copy: ${specificErrorMsg}`
      );
      return { content: null, error: specificErrorMsg };
    }
  }
);

// --- Settings Handlers ---

/**
 * Gets the default export format preference.
 */
ipcMain.handle("get-default-export-format", (event): Promise<ExportFormat> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve("txt"); // Default fallback
  return new Promise((resolve) => {
    try {
      const format = store.get(DEFAULT_EXPORT_FORMAT_KEY, "txt");
      resolve(format);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting default export format:",
        error instanceof Error ? error.message : error
      );
      resolve("txt"); // Default fallback on error
    }
  });
});

/**
 * Gets the profiling enabled preference.
 */
ipcMain.handle("get-profiling-enabled", (event): Promise<boolean> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve(false); // Default fallback
  return new Promise((resolve) => {
    try {
      const enabled = store.get(PROFILING_ENABLED_KEY, false);
      resolve(enabled);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting profiling enabled:",
        error instanceof Error ? error.message : error
      );
      resolve(false); // Default fallback on error
    }
  });
});

/**
 * Sets the profiling enabled preference.
 */
ipcMain.handle(
  "set-profiling-enabled",
  (event, enabled: boolean): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        store.set(PROFILING_ENABLED_KEY, enabled);
        console.log(`IPC: Profiling ${enabled ? "enabled" : "disabled"}`);

        // Update the profiler
        const detailedMemoryTracking = store.get(
          DETAILED_MEMORY_TRACKING_ENABLED_KEY,
          false
        );
        getProfiler().setEnabled(enabled, { detailedMemoryTracking });
      } catch (error: unknown) {
        console.error(
          "IPC: Error setting profiling enabled:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Gets the detailed memory tracking enabled preference.
 */
ipcMain.handle(
  "get-detailed-memory-tracking-enabled",
  (event): Promise<boolean> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve(false); // Default fallback
    return new Promise((resolve) => {
      try {
        const enabled = store.get(DETAILED_MEMORY_TRACKING_ENABLED_KEY, false);
        resolve(enabled);
      } catch (error: unknown) {
        console.error(
          "IPC: Error getting detailed memory tracking enabled:",
          error instanceof Error ? error.message : error
        );
        resolve(false); // Default fallback on error
      }
    });
  }
);

/**
 * Sets the detailed memory tracking enabled preference.
 */
ipcMain.handle(
  "set-detailed-memory-tracking-enabled",
  (event, enabled: boolean): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        store.set(DETAILED_MEMORY_TRACKING_ENABLED_KEY, enabled);
        console.log(
          `IPC: Detailed memory tracking ${enabled ? "enabled" : "disabled"}`
        );

        // Update the profiler if it's enabled
        const profilingEnabled = store.get(PROFILING_ENABLED_KEY, false);
        if (profilingEnabled) {
          getProfiler().setEnabled(true, { detailedMemoryTracking: enabled });
        }
      } catch (error: unknown) {
        console.error(
          "IPC: Error setting detailed memory tracking enabled:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Gets the performance summary data.
 */
ipcMain.handle(
  "get-performance-summary",
  (event): Promise<Record<string, unknown> | null> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve(null);
    return new Promise((resolve) => {
      try {
        const profiler = getProfiler();
        if (profiler.isEnabled()) {
          const summary = profiler.generateSummary();
          // Convert to unknown first to avoid type checking issues
          resolve(summary as unknown as Record<string, unknown>);
        } else {
          resolve(null);
        }
      } catch (error: unknown) {
        console.error(
          "IPC: Error getting performance summary:",
          error instanceof Error ? error.message : error
        );
        resolve(null);
      }
    });
  }
);

/**
 * Gets the performance metrics history.
 */
ipcMain.handle(
  "get-performance-metrics-history",
  (event): Promise<Record<string, unknown>[]> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve([]);
    return new Promise((resolve) => {
      try {
        const profiler = getProfiler();
        if (profiler.isEnabled()) {
          const history = profiler.getMetricsHistory();
          // Convert to unknown first to avoid type checking issues
          resolve(history as unknown as Record<string, unknown>[]);
        } else {
          resolve([]);
        }
      } catch (error: unknown) {
        console.error(
          "IPC: Error getting performance metrics history:",
          error instanceof Error ? error.message : error
        );
        resolve([]);
      }
    });
  }
);

/**
 * Saves the performance report to a file.
 */
ipcMain.handle(
  "save-performance-report",
  async (event): Promise<{ success: boolean; error?: string }> => {
    if (!validateSender(event.senderFrame) || !mainWindow) {
      return { success: false, error: "Invalid sender or main window." };
    }

    try {
      const profiler = getProfiler();
      if (!profiler.isEnabled()) {
        return { success: false, error: "Profiling is not enabled." };
      }

      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: "Save Performance Report",
        buttonLabel: "Save",
        defaultPath: `performance-report-${new Date().toISOString().replace(/:/g, "-")}.json`,
        filters: [
          { name: "JSON Files", extensions: ["json"] },
          { name: "All Files", extensions: ["*"] },
        ],
      });

      if (canceled || !filePath) {
        console.log("Performance report save cancelled by user.");
        return { success: false, error: "Save cancelled." };
      }

      // Save the report
      await profiler.saveReport(filePath, true);
      console.log(`Performance report saved to ${filePath}`);
      return { success: true };
    } catch (error: unknown) {
      const errorMsg = `Error saving performance report: ${error instanceof Error ? error.message : String(error)}`;
      console.error(errorMsg);
      return { success: false, error: errorMsg };
    }
  }
);

/**
 * Clears all performance data.
 */
ipcMain.handle("clear-performance-data", (event): Promise<boolean> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      // Reset the profiler by disabling and re-enabling it
      const profiler = getProfiler();
      const wasEnabled = profiler.isEnabled();
      const detailedMemoryTracking = profiler.isDetailedMemoryTrackingEnabled();

      if (wasEnabled) {
        profiler.setEnabled(false);
        profiler.setEnabled(true, { detailedMemoryTracking });
        console.log("Performance data cleared.");
        resolve(true);
      } else {
        console.log("Profiling is not enabled, nothing to clear.");
        resolve(false);
      }
    } catch (error: unknown) {
      console.error(
        "IPC: Error clearing performance data:",
        error instanceof Error ? error.message : error
      );
      resolve(false);
    }
  });
});

/**
 * Sets the default export format preference.
 */
ipcMain.handle(
  "set-default-export-format",
  (event, format: ExportFormat): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      if (["txt", "csv", "json", "md"].includes(format)) {
        try {
          store.set(DEFAULT_EXPORT_FORMAT_KEY, format);
          console.log(`IPC: Default export format set to "${format}"`);
        } catch (error: unknown) {
          console.error(
            `IPC: Error setting default export format to "${format}":`,
            error instanceof Error ? error.message : error
          );
        }
      } else {
        console.warn(
          `IPC: Attempted to save invalid default export format: ${format}`
        );
      }
      resolve();
    });
  }
);

/**
 * Gets the fuzzy search in Boolean queries enabled preference.
 */
ipcMain.handle(
  "get-fuzzy-search-boolean-enabled",
  (event): Promise<boolean> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve(true); // Default fallback
    return new Promise((resolve) => {
      try {
        const enabled = store.get(FUZZY_SEARCH_BOOLEAN_ENABLED_KEY, true);
        resolve(enabled);
      } catch (error: unknown) {
        console.error(
          "IPC: Error getting fuzzy search Boolean enabled:",
          error instanceof Error ? error.message : error
        );
        resolve(true); // Default fallback on error
      }
    });
  }
);

/**
 * Sets the fuzzy search in Boolean queries enabled preference.
 */
ipcMain.handle(
  "set-fuzzy-search-boolean-enabled",
  (event, enabled: boolean): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        store.set(FUZZY_SEARCH_BOOLEAN_ENABLED_KEY, enabled);
        console.log(
          `IPC: Fuzzy search in Boolean queries ${enabled ? "enabled" : "disabled"}`
        );

        // Update the settings in fileSearchService
        const nearEnabled = store.get(FUZZY_SEARCH_NEAR_ENABLED_KEY, true);
        const wholeWordEnabled = store.get(
          WHOLE_WORD_MATCHING_ENABLED_KEY,
          false
        );
        updateSearchSettings(enabled, nearEnabled, wholeWordEnabled);
      } catch (error: unknown) {
        console.error(
          "IPC: Error setting fuzzy search Boolean enabled:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Gets the fuzzy search in NEAR function enabled preference.
 */
ipcMain.handle("get-fuzzy-search-near-enabled", (event): Promise<boolean> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve(true); // Default fallback
  return new Promise((resolve) => {
    try {
      const enabled = store.get(FUZZY_SEARCH_NEAR_ENABLED_KEY, true);
      resolve(enabled);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting fuzzy search NEAR enabled:",
        error instanceof Error ? error.message : error
      );
      resolve(true); // Default fallback on error
    }
  });
});

/**
 * Sets the fuzzy search in NEAR function enabled preference.
 */
ipcMain.handle(
  "set-fuzzy-search-near-enabled",
  (event, enabled: boolean): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        store.set(FUZZY_SEARCH_NEAR_ENABLED_KEY, enabled);
        console.log(
          `IPC: Fuzzy search in NEAR function ${enabled ? "enabled" : "disabled"}`
        );

        // Update the settings in fileSearchService
        const booleanEnabled = store.get(
          FUZZY_SEARCH_BOOLEAN_ENABLED_KEY,
          true
        );
        const wholeWordEnabled = store.get(
          WHOLE_WORD_MATCHING_ENABLED_KEY,
          false
        );
        updateSearchSettings(booleanEnabled, enabled, wholeWordEnabled);
      } catch (error: unknown) {
        console.error(
          "IPC: Error setting fuzzy search NEAR enabled:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Gets the whole word matching enabled preference.
 */
ipcMain.handle("get-whole-word-matching-enabled", (event): Promise<boolean> => {
  if (!validateSender(event.senderFrame)) return Promise.resolve(false); // Default fallback
  return new Promise((resolve) => {
    try {
      const enabled = store.get(WHOLE_WORD_MATCHING_ENABLED_KEY, false);
      resolve(enabled);
    } catch (error: unknown) {
      console.error(
        "IPC: Error getting whole word matching enabled:",
        error instanceof Error ? error.message : error
      );
      resolve(false); // Default fallback on error
    }
  });
});

/**
 * Sets the whole word matching enabled preference.
 */
ipcMain.handle(
  "set-whole-word-matching-enabled",
  (event, enabled: boolean): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        store.set(WHOLE_WORD_MATCHING_ENABLED_KEY, enabled);
        console.log(
          `IPC: Whole word matching ${enabled ? "enabled" : "disabled"}`
        );

        // Update the settings in fileSearchService
        const booleanEnabled = store.get(
          FUZZY_SEARCH_BOOLEAN_ENABLED_KEY,
          true
        );
        const nearEnabled = store.get(FUZZY_SEARCH_NEAR_ENABLED_KEY, true);
        updateSearchSettings(booleanEnabled, nearEnabled, enabled);
      } catch (error: unknown) {
        console.error(
          "IPC: Error setting whole word matching enabled:",
          error instanceof Error ? error.message : error
        );
      }
      resolve();
    });
  }
);

/**
 * Handles the 'open-file' IPC request.
 * Opens the specified file with the default system application.
 */
ipcMain.handle(
  "open-file",
  async (
    event,
    filePath: string
  ): Promise<{ success: boolean; error?: string }> => {
    if (!validateSender(event.senderFrame)) {
      return { success: false, error: "Invalid sender." };
    }
    if (!filePath) {
      return { success: false, error: "No file path provided." };
    }

    console.log(`IPC: Received request to open file: ${filePath}`);
    try {
      await shell.openPath(filePath);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error opening file '${filePath}':`, message);
      return { success: false, error: "openFileError" };
    }
  }
);

/**
 * Handles the 'open-file-location' IPC request.
 * Shows the specified file in its parent folder using the system's file explorer.
 */
ipcMain.handle(
  "open-file-location",
  (event, filePath: string): { success: boolean; error?: string } => {
    if (!validateSender(event.senderFrame)) {
      return { success: false, error: "Invalid sender." };
    }
    if (!filePath) {
      return { success: false, error: "No file path provided." };
    }

    console.log(`IPC: Received request to show file location: ${filePath}`);
    try {
      // On Windows, use showItemInFolder which highlights the file in Explorer
      shell.showItemInFolder(filePath);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error showing file location for '${filePath}':`, message);
      return { success: false, error: "openFileLocationError" };
    }
  }
);

/**
 * Handles the 'copy-file-paths' IPC request.
 * Copies the file paths of selected files to the clipboard.
 */
ipcMain.handle(
  "copy-file-paths",
  (event, filePaths: string[]): { success: boolean; error?: string } => {
    if (!validateSender(event.senderFrame)) {
      return { success: false, error: "Invalid sender." };
    }
    if (!filePaths || filePaths.length === 0) {
      return { success: false, error: "No file paths provided." };
    }

    console.log(`IPC: Received request to copy ${filePaths.length} file paths`);
    try {
      // Join paths with newlines for better readability when pasted
      const content = filePaths.join("\n");
      clipboard.writeText(content);
      return { success: true };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error copying file paths to clipboard:`, message);
      return { success: false, error: "copyFilePathsError" };
    }
  }
);

/**
 * Handles the 'copy-files-to-folder' IPC request.
 * Copies selected files to a destination folder.
 */
ipcMain.handle(
  "copy-files-to-folder",
  async (
    event,
    filePaths: string[]
  ): Promise<{
    success: boolean;
    error?: string;
    destinationFolder?: string;
  }> => {
    if (!validateSender(event.senderFrame) || !mainWindow) {
      return { success: false, error: "Invalid sender or main window." };
    }
    if (!filePaths || filePaths.length === 0) {
      return { success: false, error: "No file paths provided." };
    }

    console.log(
      `IPC: Received request to copy ${filePaths.length} files to a folder`
    );

    try {
      // Ensure i18n is ready for dialogs
      await i18nMain.loadNamespaces("dialogs");

      // Show folder selection dialog
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: i18nMain.t(
          "dialogs:selectDestinationFolderTitle",
          "Select Destination Folder"
        ),
        buttonLabel: i18nMain.t(
          "dialogs:selectDestinationFolderButton",
          "Select"
        ),
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Operation cancelled." };
      }

      const destinationFolder = result.filePaths[0];

      // Copy each file
      let successCount = 0;
      const errors: string[] = [];

      for (const filePath of filePaths) {
        try {
          const fileName = path.basename(filePath);
          const destinationPath = path.join(destinationFolder, fileName);

          // Check if destination file already exists
          try {
            await fs.access(destinationPath);
            // If we get here, the file exists
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "question",
              buttons: [
                i18nMain.t("dialogs:replaceButton", "Replace"),
                i18nMain.t("dialogs:skipButton", "Skip"),
                i18nMain.t("dialogs:cancelButton", "Cancel"),
              ],
              defaultId: 0,
              title: i18nMain.t(
                "dialogs:fileExistsTitle",
                "File Already Exists"
              ),
              message: i18nMain.t("dialogs:fileExistsMessage", {
                fileName,
                defaultValue: `File "${fileName}" already exists in the destination folder.`,
              }),
            });

            if (response === 2) {
              // Cancel
              return {
                success: successCount > 0,
                error: "Operation cancelled by user.",
                destinationFolder,
              };
            } else if (response === 1) {
              // Skip
              continue;
            }
            // If response === 0 (Replace), we continue with the copy
          } catch (_error) {
            // File doesn't exist, which is fine
          }

          // Copy the file
          const fileContent = await fs.readFile(filePath);
          await fs.writeFile(destinationPath, fileContent);
          successCount++;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`${path.basename(filePath)}: ${message}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: successCount > 0,
          error: `Copied ${successCount} of ${filePaths.length} files. Errors: ${errors.join("; ")}`,
          destinationFolder,
        };
      }

      return {
        success: true,
        destinationFolder,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error copying files to folder:`, message);
      return { success: false, error: "copyFilesToFolderError" };
    }
  }
);

/**
 * Handles the 'move-files-to-folder' IPC request.
 * Moves selected files to a destination folder.
 */
ipcMain.handle(
  "move-files-to-folder",
  async (
    event,
    filePaths: string[]
  ): Promise<{
    success: boolean;
    error?: string;
    destinationFolder?: string;
  }> => {
    if (!validateSender(event.senderFrame) || !mainWindow) {
      return { success: false, error: "Invalid sender or main window." };
    }
    if (!filePaths || filePaths.length === 0) {
      return { success: false, error: "No file paths provided." };
    }

    console.log(
      `IPC: Received request to move ${filePaths.length} files to a folder`
    );

    try {
      // Ensure i18n is ready for dialogs
      await i18nMain.loadNamespaces("dialogs");

      // Show folder selection dialog
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory"],
        title: i18nMain.t(
          "dialogs:selectDestinationFolderTitle",
          "Select Destination Folder"
        ),
        buttonLabel: i18nMain.t(
          "dialogs:selectDestinationFolderButton",
          "Select"
        ),
      });

      if (result.canceled || result.filePaths.length === 0) {
        return { success: false, error: "Operation cancelled." };
      }

      const destinationFolder = result.filePaths[0];

      // Move each file
      let successCount = 0;
      const errors: string[] = [];

      for (const filePath of filePaths) {
        try {
          const fileName = path.basename(filePath);
          const destinationPath = path.join(destinationFolder, fileName);

          // Check if destination file already exists
          try {
            await fs.access(destinationPath);
            // If we get here, the file exists
            const { response } = await dialog.showMessageBox(mainWindow, {
              type: "question",
              buttons: [
                i18nMain.t("dialogs:replaceButton", "Replace"),
                i18nMain.t("dialogs:skipButton", "Skip"),
                i18nMain.t("dialogs:cancelButton", "Cancel"),
              ],
              defaultId: 0,
              title: i18nMain.t(
                "dialogs:fileExistsTitle",
                "File Already Exists"
              ),
              message: i18nMain.t("dialogs:fileExistsMessage", {
                fileName,
                defaultValue: `File "${fileName}" already exists in the destination folder.`,
              }),
            });

            if (response === 2) {
              // Cancel
              return {
                success: successCount > 0,
                error: "Operation cancelled by user.",
                destinationFolder,
              };
            } else if (response === 1) {
              // Skip
              continue;
            }
            // If response === 0 (Replace), we continue with the move
          } catch (_error) {
            // File doesn't exist, which is fine
          }

          // Move the file (copy then delete)
          const fileContent = await fs.readFile(filePath);
          await fs.writeFile(destinationPath, fileContent);
          await fs.unlink(filePath);
          successCount++;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : String(error);
          errors.push(`${path.basename(filePath)}: ${message}`);
        }
      }

      if (errors.length > 0) {
        return {
          success: successCount > 0,
          error: `Moved ${successCount} of ${filePaths.length} files. Errors: ${errors.join("; ")}`,
          destinationFolder,
        };
      }

      return {
        success: true,
        destinationFolder,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Error moving files to folder:`, message);
      return { success: false, error: "moveFilesToFolderError" };
    }
  }
);

/**
 * Handles the 'show-directory-dialog' IPC request.
 * Shows a directory selection dialog that allows multiple selections.
 */
ipcMain.handle(
  "show-directory-dialog",
  async (
    event
  ): Promise<{ filePaths: string[]; canceled: boolean; error?: string }> => {
    if (!validateSender(event.senderFrame) || !mainWindow) {
      return {
        filePaths: [],
        canceled: true,
        error: "Invalid sender or main window.",
      };
    }

    console.log("IPC: Received request to show directory selection dialog");
    try {
      // Ensure i18n is ready for dialogs
      await i18nMain.loadNamespaces("dialogs");

      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ["openDirectory", "multiSelections"],
        title: i18nMain.t("dialogs:directoryDialogTitle", "Select Directories"),
        buttonLabel: i18nMain.t("dialogs:directoryDialogButtonLabel", "Select"),
      });

      return {
        filePaths: result.filePaths,
        canceled: result.canceled,
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Error showing directory dialog:", message);
      return { filePaths: [], canceled: true, error: "directoryDialogError" };
    }
  }
);
