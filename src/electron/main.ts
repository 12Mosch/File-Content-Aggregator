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
import Store from "electron-store"; // For storing user preferences
import i18next from "i18next"; // For main process translations
import Backend from "i18next-fs-backend"; // To load translations from files
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
import {
  searchFiles,
  SearchParams,
  ProgressData,
  SearchResult,
  FileReadError,
} from "./fileSearchService.js";
import mime from "mime";

// --- Constants & Language Configuration ---
const APP_PROTOCOL = "app"; // Custom protocol scheme
// Define supported languages and fallback (ensure this matches renderer config)
const supportedLngsMain = ['en', 'es', 'de', 'ja', 'fr', 'pt', 'ru', 'it'];
const fallbackLngMain = 'en';

// --- Initialize Electron Store ---
// Define schema for type safety and potential defaults
const schema = {
	userLanguage: {
		type: 'string',
        enum: supportedLngsMain, // Restrict stored value to supported languages
		// No default: detect OS language on first run if not set
	}
};
const store = new Store({ schema });
// --------------------------------

// --- Initialize i18next for Main Process ---
const i18nMain = i18next.createInstance();
i18nMain
  .use(Backend) // Use filesystem backend to load translation files
  .init({
    // Note: 'lng' will be set by initializeMainI18nLanguage()
    fallbackLng: fallbackLngMain,
    supportedLngs: supportedLngsMain,
    // Define namespaces needed in the main process (e.g., for dialogs)
    ns: ['common', 'dialogs'],
    defaultNS: 'common',
    backend: {
      // Path to locale files relative to the packaged app's resources path
      // This path assumes locales are copied to 'dist-react/locales' during build
      loadPath: path.join(app.getAppPath(), 'dist-react/locales/{{lng}}/{{ns}}.json'),
    },
    // Initialize manually after determining the language
    initImmediate: false,
  });

// Function to determine and set initial language for the main process i18n instance
async function initializeMainI18nLanguage() {
  let initialLang = fallbackLngMain; // Default to fallback
  try {
    // 1. Check stored user preference
    const storedLang = store.get("userLanguage") as string | undefined;
    if (storedLang && supportedLngsMain.includes(storedLang)) {
      initialLang = storedLang;
    } else {
      // 2. If no valid stored preference, detect OS language
      const osLocale = app.getLocale() || app.getSystemLocale(); // e.g., 'en-US', 'es'
      const baseLang = osLocale.split('-')[0]; // Extract base language (e.g., 'en' from 'en-US')
      if (supportedLngsMain.includes(baseLang)) {
        initialLang = baseLang;
      }
      // If OS language is also not supported, initialLang remains fallbackLngMain
    }
  } catch (error) {
    console.error("Main i18n: Error getting initial language:", error);
    // Fallback already set, just log the error
  }
  // Set the determined language for the main process i18n instance
  await i18nMain.changeLanguage(initialLang);
  console.log(`Main i18n initialized with language: ${i18nMain.language}`);
}
// ------------------------------------------

// --- Global Window Reference ---
let mainWindow: BrowserWindow | null = null;

// --- Custom Protocol Handler ---
function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    try {
      let requestedPath = decodeURIComponent(
        request.url.substring(`${APP_PROTOCOL}://`.length),
      );
      // Default to index.html if path is empty or root
      if (!requestedPath || requestedPath === "/") {
        requestedPath = "index.html";
      }
      // Base path for production React build
      const appBasePath = path.join(app.getAppPath(), "dist-react");
      const absoluteFilePath = path.normalize(
        path.join(appBasePath, requestedPath),
      );
      // Security: Prevent path traversal attacks
      if (!absoluteFilePath.startsWith(appBasePath)) {
        console.error(
          `Blocked potentially malicious path traversal: ${requestedPath}`,
        );
        return new Response("Not Found", { status: 404 });
      }
      // Read file and determine MIME type
      const data = await fs.readFile(absoluteFilePath);
      const mimeType = mime.getType(absoluteFilePath) || "text/plain"; // Default MIME type
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": mimeType },
      });
    } catch (error: any) {
      console.error(`Error handling ${APP_PROTOCOL} request: ${request.url}`, error);
      // Handle file not found and other errors
      if (error.code === "ENOENT") {
        return new Response("Not Found", { status: 404 });
      } else {
        return new Response("Internal Server Error", { status: 500 });
      }
    }
  });
  console.log(`Custom protocol "${APP_PROTOCOL}://" registered.`);
}

// --- Content Security Policy (CSP) ---
function setupCSP() {
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    let csp = "";
    const selfSrc = `'self'`;
    const appProtoSrc = `${APP_PROTOCOL}:`; // Custom protocol source

    if (isDev()) {
      // Development CSP: Allow Vite HMR, inline styles/scripts
      const viteServer = "http://localhost:5123";
      const viteWs = "ws://localhost:5123";
      csp = [
        `default-src ${selfSrc}`,
        `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer}`,
        `style-src ${selfSrc} 'unsafe-inline'`,
        `connect-src ${selfSrc} ${viteWs}`,
        `img-src ${selfSrc} data:`,
        `font-src ${selfSrc}`,
        `object-src 'none'`,
      ].join("; ");
    } else {
      // Production CSP: Use custom protocol, disallow inline/eval
      csp = [
        `default-src ${appProtoSrc}`,
        `script-src ${appProtoSrc}`,
        `style-src ${appProtoSrc}`, // Ensure no inline styles in production build
        `connect-src ${appProtoSrc}`,
        `img-src ${appProtoSrc} data:`,
        `font-src ${appProtoSrc}`,
        `object-src 'none'`,
        `frame-ancestors 'none'`, // Prevent clickjacking
      ].join("; ");
    }

    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [csp],
        // Add other security headers
        "X-Content-Type-Options": ["nosniff"],
        "X-Frame-Options": ["DENY"], // Covered by CSP frame-ancestors, but good practice
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
      contextIsolation: true, // Required for security
      nodeIntegration: false, // Required for security
      sandbox: true, // Enable sandboxing for renderer process
    },
  });

  // Load content based on environment
  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123"); // Vite dev server
    mainWindow.webContents.openDevTools(); // Open DevTools in dev
  } else {
    mainWindow.loadURL(`${APP_PROTOCOL}://index.html`); // Custom protocol for production
  }

  // Clean up window reference on close
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// --- App Lifecycle & Security Setup ---

// Register custom protocol as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  { scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
]);

// App ready handler
app.whenReady().then(async () => { // Make async to await i18n init
  await initializeMainI18nLanguage(); // Initialize main process i18n
  setupCSP(); // Set up Content Security Policy
  registerAppProtocol(); // Register custom file protocol handler
  createWindow(); // Create the main application window

  // macOS specific: Re-create window on activate if none exist
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed (except macOS)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// Security: Limit Navigation & Window Creation for all WebContents
app.on("web-contents-created", (event, contents) => {
  // Prevent navigation to unexpected URLs
  contents.on("will-navigate", (event, navigationUrl) => {
    console.warn(`Security: Blocked navigation attempt to ${navigationUrl}`);
    event.preventDefault();
  });

  // Prevent creation of new Electron windows (popups)
  contents.setWindowOpenHandler(({ url }) => {
    console.warn(`Security: Blocked attempt to open new window for ${url}`);
    // Optional: Add logic here to safely open validated external links
    // using shell.openExternal(url) if needed.
    return { action: "deny" };
  });
});

// --- IPC Sender Validation Helper ---
function validateSender(senderFrame: Electron.WebFrameMain | null): boolean {
  if (!mainWindow || !senderFrame) {
    return false;
  }
  // Ensure message comes from the main frame of our primary window
  if (senderFrame === mainWindow.webContents.mainFrame) {
    return true;
  }
  console.error("IPC Validation Failed: Sender is not the main frame.");
  return false;
}

// --- IPC Handlers ---

// Search Files Handler
ipcMain.handle(
  "search-files",
  async (event, params: SearchParams): Promise<SearchResult> => {
    if (!validateSender(event.senderFrame)) {
      return {
        output: "Error: Invalid IPC sender", filesFound: 0, filesProcessed: 0,
        errorsEncountered: 1, pathErrors: ["Invalid IPC sender"], fileReadErrors: [],
      };
    }
    console.log("IPC: Received search-files request");
    const progressCallback = (data: ProgressData) => {
      if (mainWindow) mainWindow.webContents.send("search-progress", data);
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
        output: errorMsg, filesFound: 0, filesProcessed: 0,
        errorsEncountered: 1, pathErrors: [errorMsg], fileReadErrors: [],
      };
    }
  },
);

// Save File Dialog Handler (Uses main process i18n)
ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => {
    if (!validateSender(event.senderFrame)) return undefined;
    console.log("IPC: Received save-file-dialog request");
    if (!mainWindow) return undefined;
    try {
      // Use i18nMain.t() for dialog options
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: i18nMain.t('dialogs:saveDialogTitle'),
        buttonLabel: i18nMain.t('dialogs:saveDialogButtonLabel'),
        defaultPath: `file-content-aggregator-results.txt`,
        filters: [
            { name: i18nMain.t('dialogs:saveDialogFilterText'), extensions: ["txt"] },
            { name: i18nMain.t('dialogs:saveDialogFilterAll'), extensions: ["*"] }
        ],
      });
      return canceled || !filePath ? undefined : filePath;
    } catch (error: any) {
      console.error("IPC: Error showing save file dialog:", error);
      return undefined;
    }
  },
);

// Write File Handler
ipcMain.handle(
  "write-file",
  async (event, filePath: string, content: string): Promise<boolean> => {
    if (!validateSender(event.senderFrame)) return false;
    console.log(`IPC: Received write-file request`);
    if (!filePath) return false;
    try {
      await fs.writeFile(filePath, content, "utf8");
      console.log(`IPC: Successfully wrote content`);
      return true;
    } catch (error: any) {
      console.error(`IPC: Error writing file '${filePath}':`, error);
      return false;
    }
  },
);

// Copy to Clipboard Handler
ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => {
    if (!validateSender(event.senderFrame)) return false;
    console.log("IPC: Received copy-to-clipboard request");
    try {
      clipboard.writeText(content);
      return true;
    } catch (error: any) {
      console.error("IPC: Error copying to clipboard:", error);
      return false;
    }
  },
);

// --- i18n IPC Handlers ---

// Get Initial Language Handler
ipcMain.handle("get-initial-language", async (event): Promise<string> => {
  // No sender validation needed for this initial info request
  try {
    const storedLang = store.get("userLanguage") as string | undefined;
    if (storedLang && supportedLngsMain.includes(storedLang)) {
      console.log(`IPC: Returning stored language: ${storedLang}`);
      return storedLang;
    }
    const osLocale = app.getLocale() || app.getSystemLocale();
    const baseLang = osLocale.split('-')[0];
    if (supportedLngsMain.includes(baseLang)) {
      console.log(`IPC: Detected OS language: ${baseLang} (from ${osLocale})`);
      return baseLang;
    }
    console.log(`IPC: OS language ${osLocale} not supported, returning fallback: ${fallbackLngMain}`);
    return fallbackLngMain;
  } catch (error) {
    console.error("IPC: Error getting initial language:", error);
    return fallbackLngMain;
  }
});

// Set Language Preference Handler
ipcMain.handle("set-language-preference", async (event, lng: string): Promise<void> => {
  if (!validateSender(event.senderFrame)) {
    console.error("IPC: Invalid sender for set-language-preference");
    return; // Or throw error
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
});

// Listener for Renderer Language Change
ipcMain.on("language-changed", (event, lng: string) => {
    // Optional: Add sender validation if needed
    console.log(`IPC: Received language-changed notification: ${lng}`);
    if (supportedLngsMain.includes(lng)) {
        // Change language for the main process instance
        i18nMain.changeLanguage(lng).then(() => {
            console.log(`Main i18n language changed to: ${i18nMain.language}`);
            // If you have native application menus, update them here
            // e.g., Menu.setApplicationMenu(createTranslatedMenu(i18nMain));
        }).catch(err => {
            console.error("Main i18n: Error changing language:", err);
        });
    } else {
        console.warn(`Main i18n: Received unsupported language change request: ${lng}`);
    }
});
