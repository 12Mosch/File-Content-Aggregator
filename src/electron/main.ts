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
// Added name and isFavorite fields
interface SearchHistoryEntry {
    id: string;
    timestamp: string; // ISO string
    name?: string; // Optional user-defined name
    isFavorite?: boolean; // Optional favorite flag
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
// Add history with new fields to the schema
const schema = {
    userLanguage: { type: 'string', enum: supportedLngsMain },
    [HISTORY_STORE_KEY]: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                id: { type: 'string' },
                timestamp: { type: 'string', format: 'date-time' },
                name: { type: 'string' }, // Add name
                isFavorite: { type: 'boolean' }, // Add favorite flag
                searchParams: { type: 'object' } // Keep params flexible
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
    ns: ['common', 'dialogs'], // Ensure 'common' is loaded for confirmations
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
        await i18nMain.init(); // Ensure init completes
        await i18nMain.loadNamespaces(['common', 'dialogs']); // Preload namespaces
    } catch (initError) {
        console.error("Main i18n: Failed to initialize or load namespaces:", initError);
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

// --- Custom Protocol Handler (Unchanged) ---
function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const originalUrl = request.url;
    try {
      const urlPath = decodeURIComponent(
        originalUrl.substring(`${APP_PROTOCOL}://`.length)
      );
      let requestedPath = urlPath.startsWith('index.html/')
          ? urlPath.substring('index.html/'.length)
          : urlPath;
      requestedPath = requestedPath.replace(/^\/+/, '');
      if (!requestedPath || requestedPath === '/') {
          requestedPath = 'index.html';
      }
      const appRootPath = app.getAppPath();
      const absoluteFilePath = path.join(appRootPath, "dist-react", requestedPath);
      const expectedBase = path.normalize(path.join(appRootPath, "dist-react"));
      if (!path.normalize(absoluteFilePath).startsWith(expectedBase)) {
        console.error(`[Protocol Handler] Blocked path traversal: ${requestedPath}`);
        return new Response("Forbidden", { status: 403 });
      }
      let data: Buffer;
      try {
        data = await fs.readFile(absoluteFilePath);
      } catch (readError: any) {
        if (readError.code === 'ENOENT') return new Response("Not Found", { status: 404 });
        throw readError;
      }
      let resolvedMimeType: string;
      const fileExtension = path.extname(absoluteFilePath).toLowerCase();
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
      return new Response(data, { status: 200, headers: { "Content-Type": resolvedMimeType } });
    } catch (error: any) {
      console.error(`[Protocol Handler] Error for ${originalUrl}:`, error);
      return new Response("Internal Server Error", { status: 500 });
    }
  });
  console.log(`Custom protocol "${APP_PROTOCOL}://" registered.`);
}

// --- Content Security Policy (CSP) (Unchanged) ---
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let csp = "";
    const selfSrc = `'self'`;
    const appProtoSrc = `${APP_PROTOCOL}:`;
    if (isDev()) {
      const viteServer = "http://localhost:5123";
      const viteWs = "ws://localhost:5123";
      csp = [`default-src ${selfSrc} ${viteServer}`, `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer} blob:`, `style-src ${selfSrc} 'unsafe-inline'`, `connect-src ${selfSrc} ${viteWs} ${viteServer}`, `img-src ${selfSrc} data:`, `font-src ${selfSrc}`, `worker-src ${selfSrc} blob:`, `object-src 'none'`, `frame-ancestors 'none'`].join("; ");
    } else {
      csp = [`default-src ${appProtoSrc}`, `script-src ${appProtoSrc} blob:`, `style-src ${appProtoSrc} 'unsafe-inline'`, `connect-src ${appProtoSrc}`, `img-src ${appProtoSrc} data:`, `font-src ${appProtoSrc}`, `worker-src ${appProtoSrc} blob:`, `object-src 'none'`, `frame-ancestors 'none'`].join("; ");
    }
    callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp], "X-Content-Type-Options": ["nosniff"], "X-Frame-Options": ["DENY"] } });
  });
}

// --- Window Creation (Unchanged) ---
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: { preload: getPreloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (isDev()) { mainWindow.loadURL("http://localhost:5123"); mainWindow.webContents.openDevTools(); }
  else { mainWindow.loadURL(`${APP_PROTOCOL}://index.html`); }
  mainWindow.on("closed", () => { mainWindow = null; });
}

// --- App Lifecycle & Security Setup (Unchanged) ---
protocol.registerSchemesAsPrivileged([{ scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.whenReady().then(async () => { await initializeMainI18nLanguage(); setupCSP(); registerAppProtocol(); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("web-contents-created", (event, contents) => { contents.on("will-navigate", (event, navigationUrl) => { const allowedOrigin = isDev() ? 'http://localhost:5123' : `${APP_PROTOCOL}://`; if (!navigationUrl.startsWith(allowedOrigin)) { console.warn(`Security: Blocked navigation to ${navigationUrl}`); event.preventDefault(); } }); contents.setWindowOpenHandler(({ url }) => { console.warn(`Security: Blocked new window for ${url}`); return { action: "deny" }; }); });

// --- IPC Sender Validation Helper (Unchanged) ---
function validateSender(senderFrame: Electron.WebFrameMain | null): boolean { if (!mainWindow || !senderFrame) return false; if (senderFrame === mainWindow.webContents.mainFrame) return true; console.error("IPC Validation Failed: Sender is not main frame."); return false; }

// --- IPC Handlers ---

// Search Files (Unchanged)
ipcMain.handle("search-files", async (event, params: SearchParams): Promise<SearchResult> => { if (!validateSender(event.senderFrame)) return { output: "Error: Invalid IPC sender", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 1, pathErrors: ["Invalid IPC sender"], fileReadErrors: [] }; const progressCallback = (data: ProgressData) => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("search-progress", data); }; try { const results = await searchFiles(params, progressCallback); return results; } catch (error: any) { const errorMsg = `Search failed: ${error.message || "Unknown error"}`; progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message }); return { output: errorMsg, structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 1, pathErrors: [errorMsg], fileReadErrors: [] }; } });
// Save File Dialog (Unchanged)
ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => { if (!validateSender(event.senderFrame) || !mainWindow) return undefined; try { await i18nMain.loadNamespaces("dialogs"); const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: i18nMain.t("dialogs:saveDialogTitle"), buttonLabel: i18nMain.t("dialogs:saveDialogButtonLabel"), defaultPath: `file-content-aggregator-results.txt`, filters: [{ name: i18nMain.t("dialogs:saveDialogFilterText"), extensions: ["txt"] }, { name: i18nMain.t("dialogs:saveDialogFilterAll"), extensions: ["*"] }] }); return canceled || !filePath ? undefined : filePath; } catch (error: any) { const errorMsg = i18nMain.isInitialized ? i18nMain.t('dialogs:showError', { detail: error.message }) : `Error showing save dialog: ${error.message}`; dialog.showErrorBox(i18nMain.isInitialized ? i18nMain.t('dialogs:errorTitle') : 'Dialog Error', errorMsg); return undefined; } });
// Write File (Unchanged)
ipcMain.handle("write-file", async (event, filePath: string, content: string): Promise<boolean> => { if (!validateSender(event.senderFrame) || !filePath) return false; try { await fs.writeFile(filePath, content, "utf8"); return true; } catch (error: any) { dialog.showErrorBox('File Write Error', `Failed to write file: ${filePath}\nError: ${error.message}`); return false; } });
// Copy to Clipboard (Unchanged)
ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => { if (!validateSender(event.senderFrame)) return false; try { clipboard.writeText(content); return true; } catch (error: any) { return false; } });
// Language Handlers (Unchanged)
ipcMain.handle("get-initial-language", async (event): Promise<string> => { if (!validateSender(event.senderFrame)) return fallbackLngMain; try { const storedLang = store.get("userLanguage") as string | undefined; if (storedLang && supportedLngsMain.includes(storedLang)) return storedLang; const osLocale = app.getLocale() || app.getSystemLocale(); const baseLang = osLocale.split('-')[0]; if (supportedLngsMain.includes(baseLang)) return baseLang; return fallbackLngMain; } catch (error) { return fallbackLngMain; } });
ipcMain.handle("set-language-preference", async (event, lng: string): Promise<void> => { if (!validateSender(event.senderFrame)) return; if (supportedLngsMain.includes(lng)) try { store.set("userLanguage", lng); } catch (error) { console.error("IPC: Error saving language preference:", error); } else console.warn(`IPC: Attempted to save unsupported language: ${lng}`); });
ipcMain.on("language-changed", (event, lng: string) => { if (!mainWindow || event.sender !== mainWindow.webContents) return; if (supportedLngsMain.includes(lng)) i18nMain.changeLanguage(lng).catch((err) => console.error("Main i18n: Error changing language:", err)); else console.warn(`Main i18n: Received unsupported language change request: ${lng}`); });

// --- Search History IPC Handlers ---
ipcMain.handle(
    "add-search-history-entry",
    async (event, entry: SearchHistoryEntry): Promise<void> => {
        if (!validateSender(event.senderFrame)) return;
        try {
            const currentHistory = store.get(HISTORY_STORE_KEY, []);
            // Add default values for new fields if missing (for backward compatibility)
            const entryWithDefaults = {
                ...entry,
                name: entry.name ?? '', // Default name to empty string
                isFavorite: entry.isFavorite ?? false, // Default favorite to false
            };
            const updatedHistory = [entryWithDefaults, ...currentHistory];
            if (updatedHistory.length > MAX_HISTORY_ENTRIES) {
                updatedHistory.length = MAX_HISTORY_ENTRIES;
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
            // Ensure default values for older entries that might lack the new fields
            return history.map(entry => ({
                ...entry,
                name: entry.name ?? '',
                isFavorite: entry.isFavorite ?? false,
            }));
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
    async (event): Promise<boolean> => { // Return boolean for success/failure
        if (!validateSender(event.senderFrame)) return false;

        // Confirmation Dialog
        if (!mainWindow) return false;
        await i18nMain.loadNamespaces("common"); // Ensure translations are loaded
        const choice = await dialog.showMessageBox(mainWindow, {
            type: 'warning',
            buttons: [i18nMain.t('dialogCancel', { ns: 'common' }), i18nMain.t('dialogConfirm', { ns: 'common' })],
            defaultId: 0, // Default to Cancel
            cancelId: 0,
            title: i18nMain.t('historyClearConfirmTitle', { ns: 'common' }),
            message: i18nMain.t('historyClearConfirmMessage', { ns: 'common' }),
            detail: i18nMain.t('historyClearConfirmDetail', { ns: 'common' })
        });

        if (choice.response === 0) { // User clicked Cancel
            console.log("IPC: Clear history cancelled by user.");
            return false;
        }

        // Proceed with clearing
        try {
            store.set(HISTORY_STORE_KEY, []); // Set to empty array
            console.log("IPC: Cleared search history.");
            return true;
        } catch (error) {
            console.error("IPC: Error clearing search history:", error);
            return false;
        }
    }
);

// --- NEW: Update History Entry IPC Handler ---
ipcMain.handle(
    "update-search-history-entry",
    async (event, entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>): Promise<boolean> => {
        if (!validateSender(event.senderFrame)) return false;
        if (!entryId || !updates || (updates.name === undefined && updates.isFavorite === undefined)) {
            console.warn("IPC: Invalid arguments for update-search-history-entry");
            return false;
        }
        try {
            const currentHistory = store.get(HISTORY_STORE_KEY, []);
            let updated = false;
            const updatedHistory = currentHistory.map(entry => {
                if (entry.id === entryId) {
                    updated = true;
                    return {
                        ...entry,
                        // Only update fields that are present in the 'updates' object
                        ...(updates.name !== undefined && { name: updates.name }),
                        ...(updates.isFavorite !== undefined && { isFavorite: updates.isFavorite }),
                    };
                }
                return entry;
            });

            if (updated) {
                store.set(HISTORY_STORE_KEY, updatedHistory);
                console.log(`IPC: Updated history entry ${entryId} with:`, updates);
                return true;
            } else {
                console.warn(`IPC: History entry ${entryId} not found for update.`);
                return false;
            }
        } catch (error) {
            console.error(`IPC: Error updating search history entry ${entryId}:`, error);
            return false;
        }
    }
);
// --------------------------------------
