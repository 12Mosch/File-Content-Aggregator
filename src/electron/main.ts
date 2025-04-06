// D:/Code/Electron/src/electron/main.ts
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  clipboard,
  session,
  protocol,
  shell,
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
  SearchParams, // Keep this for the search function itself
  ProgressData,
  SearchResult,
  FileReadError,
} from "./fileSearchService.js";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load mime ---
const mime = require("mime");

// --- Constants & Language Configuration ---
const APP_PROTOCOL = "app";
const supportedLngsMain = ['en', 'es', 'de', 'ja', 'fr', 'pt', 'ru', 'it'];
const fallbackLngMain = 'en';

// --- History Configuration ---
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_STORE_KEY = "searchHistory";

// --- Define SearchHistoryEntry structure (mirroring frontend) ---
// This structure should match what the frontend sends and expects
interface SearchHistoryEntry {
    id: string;
    timestamp: string; // ISO string
    searchParams: {
        searchPaths: string[];
        extensions: string[];
        excludeFiles: string[];
        excludeFolders: string[];
        folderExclusionMode?: 'contains' | 'exact' | 'startsWith' | 'endsWith';
        contentSearchTerm?: string; // Generated string query
        contentSearchMode?: 'term' | 'regex' | 'boolean';
        structuredQuery?: any | null; // Store the raw query builder structure if available
        caseSensitive?: boolean;
        modifiedAfter?: string;
        modifiedBefore?: string;
        minSizeBytes?: number;
        maxSizeBytes?: number;
        maxDepth?: number;
    };
}
// -------------------------------------------------------------

// --- Initialize Electron Store ---
// Add history to the schema
const schema = {
    userLanguage: { type: 'string', enum: supportedLngsMain },
    [HISTORY_STORE_KEY]: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                searchParams: { type: 'object' } // Keep params flexible for now
            },
            required: ['id', 'timestamp', 'searchParams']
        },
        default: []
    }
};
const store = new Store<{
    userLanguage?: string;
    searchHistory: SearchHistoryEntry[]; // Add typed history
}>({ schema });
// -------------------------------------------------------------

// --- Initialize i18next for Main Process ---
const i18nMain = i18next.createInstance();
i18nMain
  .use(Backend)
  .init({
    fallbackLng: fallbackLngMain,
    supportedLngs: supportedLngsMain,
    ns: ['common', 'dialogs'],
    defaultNS: 'common',
    backend: {
      loadPath: isDev()
        ? path.resolve('public/locales/{{lng}}/{{ns}}.json')
        : path.join(app.getAppPath(), 'dist-react/locales/{{lng}}/{{ns}}.json'),
    },
    initImmediate: false,
  });

async function initializeMainI18nLanguage() {
  let initialLang = fallbackLngMain;
  try {
    const storedLang = store.get("userLanguage") as string | undefined;
    if (storedLang && supportedLngsMain.includes(storedLang)) {
      initialLang = storedLang;
    } else {
      const osLocale = app.getLocale() || app.getSystemLocale();
      const baseLang = osLocale.split('-')[0];
      if (supportedLngsMain.includes(baseLang)) {
        initialLang = baseLang;
      }
    }
  } catch (error) {
    console.error("Main i18n: Error getting initial language:", error);
  }
  if (!i18nMain.isInitialized) {
    try {
        await i18nMain.init();
    } catch (initError) {
        console.error("Main i18n: Failed to initialize:", initError);
    }
  }
  if (i18nMain.isInitialized) {
      try {
          await i18nMain.changeLanguage(initialLang);
          console.log(`Main i18n initialized with language: ${i18nMain.language}`);
      } catch (changeLangError) {
          console.error(`Main i18n: Failed to change language to ${initialLang}:`, changeLangError);
      }
  } else {
      console.error("Main i18n: Initialization failed, cannot set language.");
  }
}

// --- Global Window Reference ---
let mainWindow: BrowserWindow | null = null;

// --- Custom Protocol Handler ---
function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const originalUrl = request.url;
    // console.log(`[Protocol Handler] Request URL: ${originalUrl}`); // Less verbose logging

    try {
      // 1. Decode URL and get path part after 'app://'
      const urlPath = decodeURIComponent(
        originalUrl.substring(`${APP_PROTOCOL}://`.length)
      );

      // 2. Normalize the path
      let requestedPath = urlPath.startsWith('index.html/')
          ? urlPath.substring('index.html/'.length)
          : urlPath;
      requestedPath = requestedPath.replace(/^\/+/, ''); // Remove leading slashes
      if (!requestedPath || requestedPath === '/') {
          requestedPath = 'index.html';
      }

      // console.log(`[Protocol Handler] Resolved Requested Path: ${requestedPath}`); // Less verbose

      // 3. Construct absolute file path
      const appRootPath = app.getAppPath();
      const absoluteFilePath = path.join(appRootPath, "dist-react", requestedPath);

      // console.log(`[Protocol Handler] Trying Absolute Path: ${absoluteFilePath}`); // Less verbose

      // 4. Security check
      const expectedBase = path.normalize(path.join(appRootPath, "dist-react"));
      if (!path.normalize(absoluteFilePath).startsWith(expectedBase)) {
        console.error(
          `[Protocol Handler] Blocked potentially malicious path traversal: ${requestedPath} resolved to ${absoluteFilePath}`
        );
        return new Response("Forbidden", { status: 403 });
      }

      // 5. Read the file
      let data: Buffer;
      try {
        // console.log(`[Protocol Handler] Attempting fs.readFile for: ${absoluteFilePath}`); // Less verbose
        data = await fs.readFile(absoluteFilePath);
        // console.log(`[Protocol Handler] Successfully read: ${absoluteFilePath} (Size: ${data.length})`); // Less verbose
      } catch (readError: any) {
        // console.error(`[Protocol Handler] *** fs.readFile Error for ${absoluteFilePath}:`, readError); // Less verbose
        if (readError.code === 'ENOENT') {
            return new Response("Not Found", { status: 404 });
        }
        throw readError;
      }

      // 6. Determine MIME type
      let resolvedMimeType: string;
      const fileExtension = path.extname(absoluteFilePath).toLowerCase();

      // Explicit MIME type checks
      if (requestedPath === "index.html" || fileExtension === ".html") resolvedMimeType = "text/html";
      else if (fileExtension === ".css") resolvedMimeType = "text/css";
      else if (fileExtension === ".js") resolvedMimeType = "application/javascript";
      else if (fileExtension === ".json") resolvedMimeType = "application/json";
      else if (fileExtension === ".svg") resolvedMimeType = "image/svg+xml";
      else if (fileExtension === ".png") resolvedMimeType = "image/png";
      else if (fileExtension === ".jpg" || fileExtension === ".jpeg") resolvedMimeType = "image/jpeg";
      else if (fileExtension === ".woff2") resolvedMimeType = "font/woff2";
      else if (fileExtension === ".woff") resolvedMimeType = "font/woff";
      else resolvedMimeType = mime.getType(absoluteFilePath) || "application/octet-stream";

      // console.log(`[Protocol Handler] Serving ${absoluteFilePath} with MIME type: ${resolvedMimeType}`); // Less verbose

      // 7. Return the response
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": resolvedMimeType },
      });
    } catch (error: any) {
      console.error(`[Protocol Handler] *** Outer Catch Error for ${originalUrl}:`, error);
      if (error.code) console.error(`[Protocol Handler] Error Code: ${error.code}`);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
  console.log(`Custom protocol "${APP_PROTOCOL}://" registered.`);
}

// --- Content Security Policy (CSP) ---
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let csp = "";
    const selfSrc = `'self'`;
    const appProtoSrc = `${APP_PROTOCOL}:`;

    if (isDev()) {
      // Development CSP
      const viteServer = "http://localhost:5123";
      const viteWs = "ws://localhost:5123";
      csp = [
        `default-src ${selfSrc} ${viteServer}`,
        `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer} blob:`, // Allow blob: for workers
        `style-src ${selfSrc} 'unsafe-inline'`,
        `connect-src ${selfSrc} ${viteWs} ${viteServer}`,
        `img-src ${selfSrc} data:`,
        `font-src ${selfSrc}`,
        `worker-src ${selfSrc} blob:`, // Explicitly allow blob URLs for workers
        `object-src 'none'`,
        `frame-ancestors 'none'`,
      ].join("; ");
    } else {
      // Production CSP
      csp = [
        `default-src ${appProtoSrc}`,
        `script-src ${appProtoSrc} blob:`, // Allow blob: for workers
        `style-src ${appProtoSrc} 'unsafe-inline'`, // Keep unsafe-inline if needed
        `connect-src ${appProtoSrc}`,
        `img-src ${appProtoSrc} data:`,
        `font-src ${appProtoSrc}`,
        `worker-src ${appProtoSrc} blob:`, // Explicitly allow blob URLs for workers
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

// --- Window Creation ---
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
    mainWindow.loadURL("http://localhost:5123");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`${APP_PROTOCOL}://index.html`);
    // mainWindow.webContents.openDevTools(); // Uncomment for debugging production builds
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- App Lifecycle & Security Setup ---
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

app.whenReady().then(async () => {
  await initializeMainI18nLanguage();
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

app.on("web-contents-created", (event, contents) => {
  contents.on("will-navigate", (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    const allowedOrigin = isDev() ? 'http://localhost:5123' : `${APP_PROTOCOL}://`;
    if (!navigationUrl.startsWith(allowedOrigin)) {
      console.warn(`Security: Blocked navigation attempt to ${navigationUrl}`);
      event.preventDefault();
    }
  });

  contents.setWindowOpenHandler(({ url }) => {
    console.warn(`Security: Blocked attempt to open new window for ${url}`);
    return { action: "deny" };
  });
});

// --- IPC Sender Validation Helper ---
function validateSender(senderFrame: Electron.WebFrameMain | null): boolean {
  if (!mainWindow || !senderFrame) return false;
  if (senderFrame === mainWindow.webContents.mainFrame) return true;
  console.error("IPC Validation Failed: Sender is not the main frame.");
  return false;
}

// --- IPC Handlers ---

// Search Files (remains largely the same)
ipcMain.handle(
  "search-files",
  async (event, params: SearchParams): Promise<SearchResult> => {
    if (!validateSender(event.senderFrame)) {
      return {
        output: "Error: Invalid IPC sender", structuredItems: [], filesFound: 0,
        filesProcessed: 0, errorsEncountered: 1, pathErrors: ["Invalid IPC sender"],
        fileReadErrors: [],
      };
    }
    console.log("IPC: Received search-files request with params:", params);
    const progressCallback = (data: ProgressData) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("search-progress", data);
      }
    };
    try {
      const results = await searchFiles(params, progressCallback);
      console.log(`IPC: search-files completed.`);
      return results;
    } catch (error: any) {
      console.error("IPC: Error during searchFiles execution:", error);
      const errorMsg = `Search failed: ${error.message || "Unknown error"}`;
      progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message });
      return {
        output: errorMsg, structuredItems: [], filesFound: 0, filesProcessed: 0,
        errorsEncountered: 1, pathErrors: [errorMsg], fileReadErrors: [],
      };
    }
  }
);

// Save File Dialog (unchanged)
ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => {
  if (!validateSender(event.senderFrame)) return undefined;
  if (!mainWindow) return undefined;
  try {
    await i18nMain.loadNamespaces("dialogs");
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: i18nMain.t("dialogs:saveDialogTitle"),
      buttonLabel: i18nMain.t("dialogs:saveDialogButtonLabel"),
      defaultPath: `file-content-aggregator-results.txt`,
      filters: [
        { name: i18nMain.t("dialogs:saveDialogFilterText"), extensions: ["txt"] },
        { name: i18nMain.t("dialogs:saveDialogFilterAll"), extensions: ["*"] },
      ],
    });
    return canceled || !filePath ? undefined : filePath;
  } catch (error: any) {
    console.error("IPC: Error showing save file dialog:", error);
    const errorMsg = i18nMain.isInitialized ? i18nMain.t('dialogs:showError', { detail: error.message }) : `Error showing save dialog: ${error.message}`;
    dialog.showErrorBox(i18nMain.isInitialized ? i18nMain.t('dialogs:errorTitle') : 'Dialog Error', errorMsg);
    return undefined;
  }
});

// Write File (unchanged)
ipcMain.handle(
  "write-file",
  async (event, filePath: string, content: string): Promise<boolean> => {
    if (!validateSender(event.senderFrame)) return false;
    if (!filePath) return false;
    try {
      await fs.writeFile(filePath, content, "utf8");
      return true;
    } catch (error: any) {
      console.error(`IPC: Error writing file '${filePath}':`, error);
      dialog.showErrorBox('File Write Error', `Failed to write file: ${filePath}\nError: ${error.message}`);
      return false;
    }
  }
);

// Copy to Clipboard (unchanged)
ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => {
  if (!validateSender(event.senderFrame)) return false;
  try {
    clipboard.writeText(content);
    return true;
  } catch (error: any) {
    console.error("IPC: Error copying to clipboard:", error);
    return false;
  }
});

// Language Handlers (unchanged)
ipcMain.handle("get-initial-language", async (event): Promise<string> => {
  if (!validateSender(event.senderFrame)) return fallbackLngMain;
  try {
    const storedLang = store.get("userLanguage") as string | undefined;
    if (storedLang && supportedLngsMain.includes(storedLang)) return storedLang;
    const osLocale = app.getLocale() || app.getSystemLocale();
    const baseLang = osLocale.split('-')[0];
    if (supportedLngsMain.includes(baseLang)) return baseLang;
    return fallbackLngMain;
  } catch (error) {
    console.error("IPC: Error getting initial language:", error);
    return fallbackLngMain;
  }
});
ipcMain.handle(
  "set-language-preference",
  async (event, lng: string): Promise<void> => {
    if (!validateSender(event.senderFrame)) {
      console.error("IPC: Invalid sender for set-language-preference");
      return;
    }
    if (supportedLngsMain.includes(lng)) {
      try {
        store.set("userLanguage", lng);
        console.log(`IPC: User language preference saved: ${lng}`);
      } catch (error) {
        console.error("IPC: Error saving language preference:", error);
      }
    } else {
      console.warn(`IPC: Attempted to save unsupported language: ${lng}`);
    }
  }
);
ipcMain.on("language-changed", (event, lng: string) => {
  if (!mainWindow || event.sender !== mainWindow.webContents) {
      console.warn("Ignoring language-changed from unexpected sender.");
      return;
  }
  if (supportedLngsMain.includes(lng)) {
    i18nMain
      .changeLanguage(lng)
      .then(() => {
        console.log(`Main i18n language changed to: ${i18nMain.language}`);
      })
      .catch((err) => {
        console.error("Main i18n: Error changing language:", err);
      });
  } else {
    console.warn(`Main i18n: Received unsupported language change request: ${lng}`);
  }
});

// --- NEW: Search History IPC Handlers ---
ipcMain.handle(
    "add-search-history-entry",
    async (event, entry: SearchHistoryEntry): Promise<void> => {
        if (!validateSender(event.senderFrame)) return;
        try {
            const currentHistory = store.get(HISTORY_STORE_KEY, []);
            // Optional: Prevent adding exact duplicate of the last entry
            // if (currentHistory.length > 0 && JSON.stringify(currentHistory[0].searchParams) === JSON.stringify(entry.searchParams)) {
            //     console.log("IPC: Skipping duplicate history entry.");
            //     return;
            // }
            const updatedHistory = [entry, ...currentHistory];
            // Limit history size
            if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
                updatedHistory.length = MAX_HISTORY_ENTRIES; // Truncate older entries
            }
            store.set(HISTORY_STORE_KEY, updatedHistory);
            console.log(`IPC: Added entry ${entry.id} to search history. Total: ${updatedHistory.length}`);
        } catch (error) {
            console.error("IPC: Error adding search history entry:", error);
        }
    }
);

ipcMain.handle(
    "get-search-history",
    async (event): Promise<SearchHistoryEntry[]> => {
        if (!validateSender(event.senderFrame)) return [];
        try {
            const history = store.get(HISTORY_STORE_KEY, []);
            return history;
        } catch (error) {
            console.error("IPC: Error getting search history:", error);
            return [];
        }
    }
);

ipcMain.handle(
    "delete-search-history-entry",
    async (event, entryId: string): Promise<void> => {
        if (!validateSender(event.senderFrame)) return;
        try {
            const currentHistory = store.get(HISTORY_STORE_KEY, []);
            const updatedHistory = currentHistory.filter(entry => entry.id !== entryId);
            store.set(HISTORY_STORE_KEY, updatedHistory);
            console.log(`IPC: Deleted history entry ${entryId}. Remaining: ${updatedHistory.length}`);
        } catch (error) {
            console.error(`IPC: Error deleting search history entry ${entryId}:`, error);
        }
    }
);

ipcMain.handle(
    "clear-search-history",
    async (event): Promise<void> => {
        if (!validateSender(event.senderFrame)) return;
        try {
            store.set(HISTORY_STORE_KEY, []); // Set to empty array
            console.log("IPC: Cleared search history.");
        } catch (error) {
            console.error("IPC: Error clearing search history:", error);
        }
    }
);
// --------------------------------------
