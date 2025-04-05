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
  SearchParams,
  ProgressData,
  SearchResult,
  FileReadError,
} from "./fileSearchService.js";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load mime ---
const mime = require("mime");
// --- Type assertion might be needed if TS still complains ---
// const mime = require("mime") as { getType: (path: string) => string | null };

// --- Constants & Language Configuration ---
const APP_PROTOCOL = "app";
const supportedLngsMain = ['en', 'es', 'de', 'ja', 'fr', 'pt', 'ru', 'it'];
const fallbackLngMain = 'en';

// --- Initialize Electron Store ---
const schema = { userLanguage: { type: 'string', enum: supportedLngsMain } };
const store = new Store({ schema });

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
        ? path.join(app.getAppPath(), 'public/locales/{{lng}}/{{ns}}.json')
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
    await i18nMain.init();
  }
  await i18nMain.changeLanguage(initialLang);
  console.log(`Main i18n initialized with language: ${i18nMain.language}`);
}

// --- Global Window Reference ---
let mainWindow: BrowserWindow | null = null;

// --- Custom Protocol Handler ---
function registerAppProtocol() {
  protocol.handle(APP_PROTOCOL, async (request) => {
    const originalUrl = request.url;
    console.log(`[Protocol Handler] Received request: ${originalUrl}`);

    try {
      // 1. Get path part after 'app://'
      let pathPart = decodeURIComponent(
        originalUrl.substring(`${APP_PROTOCOL}://`.length)
      );

      // 2. Handle potential incorrect base path resolution by browser
      if (pathPart.startsWith("index.html/")) {
        pathPart = pathPart.substring("index.html/".length);
      }

      // 3. Default to 'index.html' if the path is empty or root
      let requestedPath = !pathPart || pathPart === "/" ? "index.html" : pathPart;

      console.log(`[Protocol Handler] Resolved requestedPath: ${requestedPath}`);

      // 4. Construct absolute path relative to the 'dist-react' directory
      const appBasePath = path.join(app.getAppPath(), "dist-react");
      const absoluteFilePath = path.normalize(
        path.join(appBasePath, requestedPath)
      );

      console.log(
        `[Protocol Handler] Trying absoluteFilePath: ${absoluteFilePath}`
      );

      // 5. Security check: Ensure path stays within the app's directory
      if (!absoluteFilePath.startsWith(appBasePath)) {
        console.error(
          `[Protocol Handler] Blocked potentially malicious path traversal: ${requestedPath} resolved to ${absoluteFilePath}`
        );
        return new Response("Not Found", { status: 404 });
      }

      // 6. Read the file
      const data = await fs.readFile(absoluteFilePath);

      // 7. Determine MIME type (explicitly for critical types)
      let resolvedMimeType: string;
      const fileExtension = path.extname(absoluteFilePath).toLowerCase();

      if (requestedPath === "index.html" || fileExtension === ".html") {
        resolvedMimeType = "text/html";
      } else if (fileExtension === ".js") {
        resolvedMimeType = "application/javascript";
      } else if (fileExtension === ".css") {
        resolvedMimeType = "text/css";
      } else {
        // --- Use mime.getType from the required module ---
        resolvedMimeType =
          mime.getType(absoluteFilePath) || "application/octet-stream";
      }
      console.log(
        `[Protocol Handler] Serving ${absoluteFilePath} with MIME type: ${resolvedMimeType}`
      );

      // 8. Return the response
      return new Response(data, {
        status: 200,
        headers: { "Content-Type": resolvedMimeType },
      });
    } catch (error: any) {
      console.error(`[Protocol Handler] Error handling ${originalUrl}:`, error);
      if (error.code === "ENOENT") {
        console.error(`[Protocol Handler] File not found: ${error.path}`);
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
    const appProtoSrc = `${APP_PROTOCOL}:`;

    if (isDev()) {
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
      csp = [
        `default-src ${appProtoSrc}`,
        `script-src ${appProtoSrc}`,
        `style-src ${appProtoSrc} 'unsafe-inline'`,
        `connect-src ${appProtoSrc}`,
        `img-src ${appProtoSrc} data:`,
        `font-src ${appProtoSrc}`,
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
    if (!parsedUrl.protocol.startsWith(APP_PROTOCOL) && !isDev()) {
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
ipcMain.handle(
  "search-files",
  async (event, params: SearchParams): Promise<SearchResult> => {
    if (!validateSender(event.senderFrame)) {
      return {
        output: "Error: Invalid IPC sender",
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 1,
        pathErrors: ["Invalid IPC sender"],
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
      progressCallback({
        processed: 0,
        total: 0,
        message: errorMsg,
        error: error.message,
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
        {
          name: i18nMain.t("dialogs:saveDialogFilterText"),
          extensions: ["txt"],
        },
        {
          name: i18nMain.t("dialogs:saveDialogFilterAll"),
          extensions: ["*"],
        },
      ],
    });
    return canceled || !filePath ? undefined : filePath;
  } catch (error: any) {
    console.error("IPC: Error showing save file dialog:", error);
    return undefined;
  }
});

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
      return false;
    }
  }
);

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

ipcMain.handle("get-initial-language", async (event): Promise<string> => {
  try {
    const storedLang = store.get("userLanguage") as string | undefined;
    if (storedLang && supportedLngsMain.includes(storedLang)) return storedLang;
    const osLocale = app.getLocale() || app.getSystemLocale();
    const baseLang = osLocale.split("-")[0];
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
