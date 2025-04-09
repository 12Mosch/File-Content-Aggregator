import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  session,
  protocol,
  nativeTheme,
  WebFrameMain,
} from "electron";
import path from "path";
import fs from "fs/promises";
import Store from "electron-store";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";

import {
  searchFiles,
  SearchParams,
  ProgressData,
  SearchResult,
  CancellationChecker,
  StructuredItem,
} from "./fileSearchService.js";
import type { ExportFormat } from "../ui/vite-env.js";

import module from "node:module";
const require = module.createRequire(import.meta.url);
const mime = require("mime") as { getType: (path: string) => string | null };

const APP_PROTOCOL = "app";
const supportedLngsMain = ["en", "es", "de", "ja", "fr", "pt", "ru", "it"];
const fallbackLngMain = "en";
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_STORE_KEY = "searchHistory";
const THEME_PREFERENCE_KEY = "themePreference";
type ThemePreference = "light" | "dark" | "system";

interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  name?: string;
  isFavorite?: boolean;
  searchParams: {
    searchPaths: string[];
    extensions: string[];
    excludeFiles: string[];
    excludeFolders: string[];
    folderExclusionMode?: "contains" | "exact" | "startsWith" | "endsWith";
    contentSearchTerm?: string;
    contentSearchMode?: "term" | "regex" | "boolean";
    structuredQuery?: unknown | null;
    caseSensitive?: boolean;
    modifiedAfter?: string;
    modifiedBefore?: string;
    minSizeBytes?: number;
    maxSizeBytes?: number;
    maxDepth?: number;
  };
}

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
        searchParams: { type: "object" },
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
};
const store = new Store<{
  userLanguage?: string;
  searchHistory: SearchHistoryEntry[];
  themePreference: ThemePreference;
}>({ schema });

const i18nMain = i18next.createInstance();
void i18nMain.use(Backend).init({
  fallbackLng: fallbackLngMain,
  supportedLngs: supportedLngsMain,
  ns: ["common", "dialogs"],
  defaultNS: "common",
  backend: {
    loadPath: isDev()
      ? path.resolve("public/locales/{{lng}}/{{ns}}.json")
      : path.join(app.getAppPath(), "dist-react/locales/{{lng}}/{{ns}}.json"),
  },
  initImmediate: false,
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
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let csp = "";
    const selfSrc = `'self'`;
    const appProtoSrc = `${APP_PROTOCOL}:`;
    if (isDev()) {
      const viteServer = "http://localhost:5123";
      const viteWs = "ws://localhost:5123";
      csp = [
        `default-src ${selfSrc} ${viteServer}`,
        `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer} blob:`,
        `style-src ${selfSrc} 'unsafe-inline'`,
        `connect-src ${selfSrc} ${viteWs} ${viteServer}`,
        `img-src ${selfSrc} data:`,
        `font-src ${selfSrc}`,
        `worker-src ${selfSrc} blob:`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
      ].join("; ");
    } else {
      csp = [
        `default-src ${appProtoSrc}`,
        `script-src ${appProtoSrc} blob:`,
        `style-src ${appProtoSrc} 'unsafe-inline'`,
        `connect-src ${appProtoSrc}`,
        `img-src ${appProtoSrc} data:`,
        `font-src ${appProtoSrc}`,
        `worker-src ${appProtoSrc} blob:`,
        `object-src 'none'`,
        `frame-ancestors 'none'`,
      ].join("; ");
    }
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
        "X-Content-Type-Options": ["nosniff"],
        "X-Frame-Options": ["DENY"],
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
  await initializeMainI18nLanguage();
  try {
    const storedTheme = store.get(THEME_PREFERENCE_KEY, "system");
    nativeTheme.themeSource = storedTheme;
    console.log(
      `Main: Initial nativeTheme.themeSource set to "${storedTheme}"`
    );
  } catch (error: unknown) {
    console.error(
      "Main: Error setting initial theme source:",
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
  if (process.platform !== "darwin") app.quit();
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
  if (!mainWindow || !senderFrame) return false;
  if (senderFrame === mainWindow.webContents.mainFrame) return true;
  console.error("IPC Validation Failed: Sender is not main frame.");
  return false;
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
 * Generates CSV content from structured items.
 */
function generateCsv(items: StructuredItem[]): string {
  const header = ["FilePath", "Status", "Details"];
  const rows = items.map((item) => {
    const status = item.readError
      ? "Read Error"
      : item.content !== null
        ? "Matched"
        : "Not Matched";
    const details = item.readError
      ? item.readError // Use the error key as detail
      : item.content ?? ""; // Use content if available, otherwise empty string
    return [
      escapeCsvField(item.filePath),
      escapeCsvField(status),
      escapeCsvField(details),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

/**
 * Generates JSON content from structured items.
 */
function generateJson(items: StructuredItem[]): string {
  try {
    return JSON.stringify(items, null, 2); // Pretty-print with 2 spaces
  } catch (error: unknown) {
    console.error("Error generating JSON:", error);
    throw new Error(
      `Failed to serialize results to JSON: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Generates Markdown content from structured items.
 */
function generateMarkdown(items: StructuredItem[]): string {
  return items
    .map((item) => {
      const status = item.readError
        ? ` (Status: Read Error - ${item.readError})`
        : item.content !== null
          ? " (Status: Matched)"
          : " (Status: Not Matched)";
      const details = item.readError
        ? `Error: ${item.readError}`
        : item.content ?? "No content preview available.";

      return `## ${item.filePath}${status}\n\n\`\`\`\n${details}\n\`\`\`\n`;
    })
    .join("\n---\n\n"); // Separate entries with a horizontal rule
}

// --- IPC Handlers ---

/**
 * Handles the 'search-files' IPC request from the renderer process.
 * Performs the file search based on the provided parameters.
 */
ipcMain.handle(
  "search-files",
  async (event, params: SearchParams): Promise<SearchResult> => {
    if (!validateSender(event.senderFrame))
      return {
        output: "Error: Invalid IPC sender",
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
        output: errorMsg,
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
 * Adds a new entry to the search history stored in electron-store.
 */
ipcMain.handle(
  "add-search-history-entry",
  (event, entry: SearchHistoryEntry): Promise<void> => {
    if (!validateSender(event.senderFrame)) return Promise.resolve();
    return new Promise((resolve) => {
      try {
        const currentHistory = store.get(HISTORY_STORE_KEY, []);
        const entryWithDefaults = {
          ...entry,
          name: entry.name ?? "",
          isFavorite: entry.isFavorite ?? false,
        };
        const updatedHistory = [entryWithDefaults, ...currentHistory];
        if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
          updatedHistory.length = MAX_HISTORY_ENTRIES;
        }
        store.set(HISTORY_STORE_KEY, updatedHistory);
        console.log(
          `IPC: Added entry ${entry.id} to search history. Total: ${updatedHistory.length}`
        );
      } catch (error: unknown) {
        console.error(
          "IPC: Error adding search history entry:",
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
 * Handles the 'export-results' IPC request.
 * Generates content in the specified format (CSV, JSON, Markdown) from the provided structured results,
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
      case "csv":
      default:
        fileExtension = "csv";
        fileTypeName = "CSV Files";
        break;
    }

    try {
      // Ensure i18n is ready for dialogs
      await i18nMain.loadNamespaces("dialogs");

      // Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: i18nMain.t("dialogs:exportDialogTitle"), // Use specific key
        buttonLabel: i18nMain.t("dialogs:exportDialogButtonLabel"), // Use specific key
        defaultPath: `file-content-aggregator-results.${fileExtension}`,
        filters: [
          { name: fileTypeName, extensions: [fileExtension] },
          {
            name: i18nMain.t("dialogs:exportDialogFilterAll"), // Use specific key
            extensions: ["*"],
          },
        ],
      });

      if (canceled || !filePath) {
        console.log("Export cancelled by user.");
        return { success: false, error: "Export cancelled." };
      }

      // Generate content based on format
      let content: string;
      try {
        switch (format) {
          case "json":
            content = generateJson(items);
            break;
          case "md":
            content = generateMarkdown(items);
            break;
          case "csv":
          default:
            content = generateCsv(items);
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
    } catch (dialogError: unknown) {
      const errorMsg = `Error showing save dialog for export: ${dialogError instanceof Error ? dialogError.message : String(dialogError)}`;
      console.error(errorMsg);
      dialog.showErrorBox("Dialog Error", errorMsg);
      return { success: false, error: errorMsg };
    }
  }
);
