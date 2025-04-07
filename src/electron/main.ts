import {
  app, BrowserWindow, ipcMain, dialog, clipboard, session,
  protocol, shell, nativeTheme,
} from "electron";
import path from "path";
import fs from "fs/promises";
import Store from "electron-store";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";

import {
  searchFiles, SearchParams, ProgressData, SearchResult,
  FileReadError, CancellationChecker,
} from "./fileSearchService.js";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);
const mime = require("mime");

// --- Constants & Config ---
const APP_PROTOCOL = "app";
const supportedLngsMain = ['en', 'es', 'de', 'ja', 'fr', 'pt', 'ru', 'it'];
const fallbackLngMain = 'en';
const MAX_HISTORY_ENTRIES = 50;
const HISTORY_STORE_KEY = "searchHistory";
const THEME_PREFERENCE_KEY = "themePreference";
type ThemePreference = "light" | "dark" | "system";

// --- Define SearchHistoryEntry structure ---
interface SearchHistoryEntry { id: string; timestamp: string; name?: string; isFavorite?: boolean; searchParams: { searchPaths: string[]; extensions: string[]; excludeFiles: string[]; excludeFolders: string[]; folderExclusionMode?: 'contains' | 'exact' | 'startsWith' | 'endsWith'; contentSearchTerm?: string; contentSearchMode?: 'term' | 'regex' | 'boolean'; structuredQuery?: any | null; caseSensitive?: boolean; modifiedAfter?: string; modifiedBefore?: string; minSizeBytes?: number; maxSizeBytes?: number; maxDepth?: number; }; }

// --- Initialize Electron Store ---
const schema = { userLanguage: { type: 'string', enum: supportedLngsMain }, [HISTORY_STORE_KEY]: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, timestamp: { type: 'string', format: 'date-time' }, name: { type: 'string' }, isFavorite: { type: 'boolean' }, searchParams: { type: 'object' } }, required: ['id', 'timestamp', 'searchParams'] }, default: [] }, [THEME_PREFERENCE_KEY]: { type: 'string', enum: ['light', 'dark', 'system'], default: 'system' } };
const store = new Store<{ userLanguage?: string; searchHistory: SearchHistoryEntry[]; themePreference: ThemePreference; }>({ schema });

// --- i18n Initialization ---
const i18nMain = i18next.createInstance();
i18nMain.use(Backend).init({ /* ... */ fallbackLng: fallbackLngMain, supportedLngs: supportedLngsMain, ns: ['common', 'dialogs'], defaultNS: 'common', backend: { loadPath: isDev() ? path.resolve('public/locales/{{lng}}/{{ns}}.json') : path.join(app.getAppPath(), 'dist-react/locales/{{lng}}/{{ns}}.json'), }, initImmediate: false, });
async function initializeMainI18nLanguage() { /* ... */ let initialLang = fallbackLngMain; try { const storedLang = store.get("userLanguage") as string | undefined; if (storedLang && supportedLngsMain.includes(storedLang)) { initialLang = storedLang; } else { const osLocale = app.getLocale() || app.getSystemLocale(); const baseLang = osLocale.split('-')[0]; if (supportedLngsMain.includes(baseLang)) { initialLang = baseLang; } } } catch (error) { console.error("Main i18n: Error getting initial language:", error); } if (!i18nMain.isInitialized) { try { await i18nMain.init(); await i18nMain.loadNamespaces(['common', 'dialogs']); } catch (initError) { console.error("Main i18n: Failed to initialize or load namespaces:", initError); } } if (i18nMain.isInitialized) { try { await i18nMain.changeLanguage(initialLang); console.log(`Main i18n initialized with language: ${i18nMain.language}`); } catch (changeLangError) { console.error(`Main i18n: Failed to change language to ${initialLang}:`, changeLangError); } } else { console.error("Main i18n: Initialization failed, cannot set language."); } }

// --- Global Window Reference ---
let mainWindow: BrowserWindow | null = null;

// --- Cancellation Flag ---
let isSearchCancelled = false; // Flag for ongoing search cancellation

// --- Protocol Handler, CSP, Window Creation (Unchanged) ---
function registerAppProtocol() { /* ... */ protocol.handle(APP_PROTOCOL, async (request) => { const originalUrl = request.url; try { const urlPath = decodeURIComponent( originalUrl.substring(`${APP_PROTOCOL}://`.length) ); let requestedPath = urlPath.startsWith('index.html/') ? urlPath.substring('index.html/'.length) : urlPath; requestedPath = requestedPath.replace(/^\/+/, ''); if (!requestedPath || requestedPath === '/') { requestedPath = 'index.html'; } const appRootPath = app.getAppPath(); const absoluteFilePath = path.join(appRootPath, "dist-react", requestedPath); const expectedBase = path.normalize(path.join(appRootPath, "dist-react")); if (!path.normalize(absoluteFilePath).startsWith(expectedBase)) { console.error(`[Protocol Handler] Blocked path traversal: ${requestedPath}`); return new Response("Forbidden", { status: 403 }); } let data: Buffer; try { data = await fs.readFile(absoluteFilePath); } catch (readError: any) { if (readError.code === 'ENOENT') return new Response("Not Found", { status: 404 }); throw readError; } let resolvedMimeType: string; const fileExtension = path.extname(absoluteFilePath).toLowerCase(); if (requestedPath === "index.html" || fileExtension === ".html") resolvedMimeType = "text/html"; else if (fileExtension === ".css") resolvedMimeType = "text/css"; else if (fileExtension === ".js") resolvedMimeType = "application/javascript"; else if (fileExtension === ".json") resolvedMimeType = "application/json"; else if (fileExtension === ".svg") resolvedMimeType = "image/svg+xml"; else if (fileExtension === ".png") resolvedMimeType = "image/png"; else if (fileExtension === ".jpg" || fileExtension === ".jpeg") resolvedMimeType = "image/jpeg"; else if (fileExtension === ".woff2") resolvedMimeType = "font/woff2"; else if (fileExtension === ".woff") resolvedMimeType = "font/woff"; else resolvedMimeType = mime.getType(absoluteFilePath) || "application/octet-stream"; return new Response(data, { status: 200, headers: { "Content-Type": resolvedMimeType } }); } catch (error: any) { console.error(`[Protocol Handler] Error for ${originalUrl}:`, error); return new Response("Internal Server Error", { status: 500 }); } }); console.log(`Custom protocol "${APP_PROTOCOL}://" registered.`); }
function setupCSP() { /* ... */ session.defaultSession.webRequest.onHeadersReceived((details, callback) => { let csp = ""; const selfSrc = `'self'`; const appProtoSrc = `${APP_PROTOCOL}:`; if (isDev()) { const viteServer = "http://localhost:5123"; const viteWs = "ws://localhost:5123"; csp = [`default-src ${selfSrc} ${viteServer}`, `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer} blob:`, `style-src ${selfSrc} 'unsafe-inline'`, `connect-src ${selfSrc} ${viteWs} ${viteServer}`, `img-src ${selfSrc} data:`, `font-src ${selfSrc}`, `worker-src ${selfSrc} blob:`, `object-src 'none'`, `frame-ancestors 'none'`].join("; "); } else { csp = [`default-src ${appProtoSrc}`, `script-src ${appProtoSrc} blob:`, `style-src ${appProtoSrc} 'unsafe-inline'`, `connect-src ${appProtoSrc}`, `img-src ${appProtoSrc} data:`, `font-src ${appProtoSrc}`, `worker-src ${appProtoSrc} blob:`, `object-src 'none'`, `frame-ancestors 'none'`].join("; "); } callback({ responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp], "X-Content-Type-Options": ["nosniff"], "X-Frame-Options": ["DENY"] } }); }); }
function createWindow() { /* ... */ mainWindow = new BrowserWindow({ width: 1000, height: 800, webPreferences: { preload: getPreloadPath(), contextIsolation: true, nodeIntegration: false, sandbox: true }, }); if (isDev()) { mainWindow.loadURL("http://localhost:5123"); mainWindow.webContents.openDevTools(); } else { mainWindow.loadURL(`${APP_PROTOCOL}://index.html`); } mainWindow.on("closed", () => { mainWindow = null; }); }

// --- App Lifecycle & Security Setup ---
protocol.registerSchemesAsPrivileged([{ scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);
app.whenReady().then(async () => { await initializeMainI18nLanguage(); try { const storedTheme = store.get(THEME_PREFERENCE_KEY, 'system'); nativeTheme.themeSource = storedTheme; console.log(`Main: Initial nativeTheme.themeSource set to "${storedTheme}"`); } catch (error) { console.error("Main: Error setting initial theme source:", error); } setupCSP(); registerAppProtocol(); createWindow(); app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); }); });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("web-contents-created", (event, contents) => { contents.on("will-navigate", (event, navigationUrl) => { const allowedOrigin = isDev() ? 'http://localhost:5123' : `${APP_PROTOCOL}://`; if (!navigationUrl.startsWith(allowedOrigin)) { console.warn(`Security: Blocked navigation to ${navigationUrl}`); event.preventDefault(); } }); contents.setWindowOpenHandler(({ url }) => { console.warn(`Security: Blocked new window for ${url}`); return { action: "deny" }; }); });

// --- IPC Sender Validation Helper ---
function validateSender(senderFrame: Electron.WebFrameMain | null): boolean { if (!mainWindow || !senderFrame) return false; if (senderFrame === mainWindow.webContents.mainFrame) return true; console.error("IPC Validation Failed: Sender is not main frame."); return false; }

// --- IPC Handlers ---

// Search Files
ipcMain.handle("search-files", async (event, params: SearchParams): Promise<SearchResult> => {
  if (!validateSender(event.senderFrame)) return { output: "Error: Invalid IPC sender", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 1, pathErrors: ["Invalid IPC sender"], fileReadErrors: [] };

  // Reset cancellation flag for new search
  isSearchCancelled = false;
  console.log("Starting search, cancellation flag reset.");

  const progressCallback = (data: ProgressData) => {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("search-progress", data);
  };

  // Define the cancellation checker function
  const checkCancellation: CancellationChecker = () => {
    // console.log("Checking cancellation status:", isSearchCancelled); // Debug log
    return isSearchCancelled;
  };

  try {
    // Pass the checker function to searchFiles
    const results = await searchFiles(params, progressCallback, checkCancellation);
    return results;
  } catch (error: any) {
    const errorMsg = `Search failed: ${error.message || "Unknown error"}`;
    progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message, status: 'error' });
    return { output: errorMsg, structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 1, pathErrors: [errorMsg], fileReadErrors: [] };
  } finally {
      // Optional: Reset flag again after completion/error, though it's reset at the start of the next search
      // isSearchCancelled = false;
  }
});

// --- NEW: Cancel Search Handler ---
ipcMain.on("cancel-search", (event) => {
    // Validate sender for security
    if (!validateSender(event.senderFrame)) {
        console.warn("IPC: Received cancel-search from invalid sender.");
        return;
    }
    console.log("IPC: Received cancel-search request. Setting flag.");
    isSearchCancelled = true;

    // Optionally send a progress update indicating cancellation attempt
    if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("search-progress", {
            status: 'cancelling',
            message: 'Cancellation requested...',
            processed: -1, // Use -1 or similar to indicate intermediate state
            total: -1
        });
    }
});
// --------------------------------

// Save File Dialog
ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => { /* ... */ if (!validateSender(event.senderFrame) || !mainWindow) return undefined; try { await i18nMain.loadNamespaces("dialogs"); const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, { title: i18nMain.t("dialogs:saveDialogTitle"), buttonLabel: i18nMain.t("dialogs:saveDialogButtonLabel"), defaultPath: `file-content-aggregator-results.txt`, filters: [{ name: i18nMain.t("dialogs:saveDialogFilterText"), extensions: ["txt"] }, { name: i18nMain.t("dialogs:saveDialogFilterAll"), extensions: ["*"] }] }); return canceled || !filePath ? undefined : filePath; } catch (error: any) { const errorMsg = i18nMain.isInitialized ? i18nMain.t('dialogs:showError', { detail: error.message }) : `Error showing save dialog: ${error.message}`; dialog.showErrorBox(i18nMain.isInitialized ? i18nMain.t('dialogs:errorTitle') : 'Dialog Error', errorMsg); return undefined; } });
// Write File
ipcMain.handle("write-file", async (event, filePath: string, content: string): Promise<boolean> => { /* ... */ if (!validateSender(event.senderFrame) || !filePath) return false; try { await fs.writeFile(filePath, content, "utf8"); return true; } catch (error: any) { dialog.showErrorBox('File Write Error', `Failed to write file: ${filePath}\nError: ${error.message}`); return false; } });
// Copy to Clipboard
ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => { /* ... */ if (!validateSender(event.senderFrame)) return false; try { clipboard.writeText(content); return true; } catch (error: any) { console.error("IPC: Error copying to clipboard:", error); return false; } });
// Language Handlers
ipcMain.handle("get-initial-language", async (event): Promise<string> => { /* ... */ if (!validateSender(event.senderFrame)) return fallbackLngMain; try { const storedLang = store.get("userLanguage") as string | undefined; if (storedLang && supportedLngsMain.includes(storedLang)) return storedLang; const osLocale = app.getLocale() || app.getSystemLocale(); const baseLang = osLocale.split('-')[0]; if (supportedLngsMain.includes(baseLang)) return baseLang; return fallbackLngMain; } catch (error) { return fallbackLngMain; } });
ipcMain.handle("set-language-preference", async (event, lng: string): Promise<void> => { /* ... */ if (!validateSender(event.senderFrame)) return; if (supportedLngsMain.includes(lng)) try { store.set("userLanguage", lng); } catch (error) { console.error("IPC: Error saving language preference:", error); } else console.warn(`IPC: Attempted to save unsupported language: ${lng}`); });
ipcMain.on("language-changed", (event, lng: string) => { /* ... */ if (!mainWindow || event.sender !== mainWindow.webContents) return; if (supportedLngsMain.includes(lng)) i18nMain.changeLanguage(lng).catch((err) => console.error("Main i18n: Error changing language:", err)); else console.warn(`Main i18n: Received unsupported language change request: ${lng}`); });
// Search History IPC Handlers
ipcMain.handle("add-search-history-entry", async (event, entry: SearchHistoryEntry): Promise<void> => { /* ... */ if (!validateSender(event.senderFrame)) return; try { const currentHistory = store.get(HISTORY_STORE_KEY, []); const entryWithDefaults = { ...entry, name: entry.name ?? '', isFavorite: entry.isFavorite ?? false, }; const updatedHistory = [entryWithDefaults, ...currentHistory]; if (updatedHistory.length > MAX_HISTORY_ENTRIES) { updatedHistory.length = MAX_HISTORY_ENTRIES; } store.set(HISTORY_STORE_KEY, updatedHistory); console.log(`IPC: Added entry ${entry.id} to search history. Total: ${updatedHistory.length}`); } catch (error) { console.error("IPC: Error adding search history entry:", error); } });
ipcMain.handle("get-search-history", async (event): Promise<SearchHistoryEntry[]> => { /* ... */ if (!validateSender(event.senderFrame)) return []; try { const history = store.get(HISTORY_STORE_KEY, []); return history.map(entry => ({ ...entry, name: entry.name ?? '', isFavorite: entry.isFavorite ?? false, })); } catch (error) { console.error("IPC: Error getting search history:", error); return []; } });
ipcMain.handle("delete-search-history-entry", async (event, entryId: string): Promise<void> => { /* ... */ if (!validateSender(event.senderFrame)) return; try { const currentHistory = store.get(HISTORY_STORE_KEY, []); const updatedHistory = currentHistory.filter(entry => entry.id !== entryId); store.set(HISTORY_STORE_KEY, updatedHistory); console.log(`IPC: Deleted history entry ${entryId}. Remaining: ${updatedHistory.length}`); } catch (error) { console.error(`IPC: Error deleting search history entry ${entryId}:`, error); } });
ipcMain.handle("clear-search-history", async (event): Promise<boolean> => { /* ... */ if (!validateSender(event.senderFrame)) return false; try { store.set(HISTORY_STORE_KEY, []); console.log("IPC: Cleared search history."); return true; } catch (error) { console.error("IPC: Error clearing search history:", error); return false; } });
ipcMain.handle("update-search-history-entry", async (event, entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>): Promise<boolean> => { /* ... */ if (!validateSender(event.senderFrame)) return false; if (!entryId || !updates || (updates.name === undefined && updates.isFavorite === undefined)) return false; try { const currentHistory = store.get(HISTORY_STORE_KEY, []); let updated = false; const updatedHistory = currentHistory.map(entry => { if (entry.id === entryId) { updated = true; return { ...entry, ...(updates.name !== undefined && { name: updates.name }), ...(updates.isFavorite !== undefined && { isFavorite: updates.isFavorite }), }; } return entry; }); if (updated) { store.set(HISTORY_STORE_KEY, updatedHistory); console.log(`IPC: Updated history entry ${entryId} with:`, updates); return true; } else { console.warn(`IPC: History entry ${entryId} not found for update.`); return false; } } catch (error) { console.error(`IPC: Error updating search history entry ${entryId}:`, error); return false; } });
// Theme Preference IPC Handlers
ipcMain.handle("get-theme-preference", async (event): Promise<ThemePreference> => { /* ... */ if (!validateSender(event.senderFrame)) return 'system'; try { const preference = store.get(THEME_PREFERENCE_KEY, 'system'); return preference; } catch (error) { console.error("IPC: Error getting theme preference:", error); return 'system'; } });
ipcMain.handle("set-theme-preference", async (event, theme: ThemePreference): Promise<void> => { /* ... */ if (!validateSender(event.senderFrame)) return; if (['light', 'dark', 'system'].includes(theme)) { try { store.set(THEME_PREFERENCE_KEY, theme); nativeTheme.themeSource = theme; console.log(`IPC: Theme preference saved and nativeTheme.themeSource set to "${theme}"`); } catch (error) { console.error(`IPC: Error setting theme preference to "${theme}":`, error); } } else { console.warn(`IPC: Attempted to save invalid theme preference: ${theme}`); } });
// --------------------------------------
