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
  import { isDev } from "./util.js";
  import { getPreloadPath } from "./pathResolver.js";
  import {
    searchFiles,
    SearchParams,
    ProgressData,
    SearchResult, // Ensure SearchResult is imported correctly
  } from "./fileSearchService.js";
  import mime from "mime";
  
  const APP_PROTOCOL = "app";
  let mainWindow: BrowserWindow | null = null;
  
  function registerAppProtocol() {
    protocol.handle(APP_PROTOCOL, async (request) => {
      try {
        let requestedPath = decodeURIComponent(
          request.url.substring(`${APP_PROTOCOL}://`.length),
        );
        if (!requestedPath || requestedPath === "/") {
          requestedPath = "index.html";
        }
        const appBasePath = path.join(app.getAppPath(), "dist-react");
        const absoluteFilePath = path.normalize(
          path.join(appBasePath, requestedPath),
        );
        if (!absoluteFilePath.startsWith(appBasePath)) {
          console.error(
            `Blocked potentially malicious path traversal: ${requestedPath}`,
          );
          return new Response("Not Found", { status: 404 });
        }
        const data = await fs.readFile(absoluteFilePath);
        const mimeType = mime.getType(absoluteFilePath) || "text/plain";
        return new Response(data, {
          status: 200,
          headers: { "Content-Type": mimeType },
        });
      } catch (error: any) {
        console.error(`Error handling ${APP_PROTOCOL} request: ${request.url}`, error);
        if (error.code === "ENOENT") {
          return new Response("Not Found", { status: 404 });
        } else {
          return new Response("Internal Server Error", { status: 500 });
        }
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
          `style-src ${appProtoSrc}`,
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
  
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
  
  app.whenReady().then(() => {
    setupCSP();
    registerAppProtocol();
    createWindow();
  
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });
  
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });
  
  app.on("web-contents-created", (event, contents) => {
    contents.on("will-navigate", (event, navigationUrl) => {
      console.warn(`Security: Blocked navigation attempt to ${navigationUrl}`);
      event.preventDefault();
    });
  
    contents.setWindowOpenHandler(({ url }) => {
      console.warn(`Security: Blocked attempt to open new window for ${url}`);
      return { action: "deny" };
    });
  });
  
  function validateSender(senderFrame: Electron.WebFrameMain | null): boolean {
    if (!mainWindow || !senderFrame) {
      return false;
    }
    if (senderFrame === mainWindow.webContents.mainFrame) {
      return true;
    }
    console.error("IPC Validation Failed: Sender is not the main frame.");
    return false;
  }
  
  ipcMain.handle(
    "search-files",
    async (event, params: SearchParams): Promise<SearchResult> => {
      if (!validateSender(event.senderFrame)) {
        // Ensure the returned object matches SearchResult structure
        return {
          output: "Error: Invalid IPC sender",
          filesFound: 0,
          filesProcessed: 0,
          errorsEncountered: 1, // Indicate an error occurred
          pathErrors: ["Invalid IPC sender"], // Include pathErrors array
        };
      }
  
      console.log("IPC: Received search-files request");
      const progressCallback = (data: ProgressData) => {
        if (mainWindow) {
          mainWindow.webContents.send("search-progress", data);
        }
      };
      try {
        // This 'results' object from searchFiles should already include pathErrors
        const results = await searchFiles(params, progressCallback);
        console.log(`IPC: search-files completed.`);
        return results; // This should be compliant now
      } catch (error: any) {
        console.error("IPC: Error during searchFiles execution:", error);
        const errorMsg = `Search failed: ${error.message || "Unknown error"}`;
        progressCallback({
          processed: 0, total: 0, message: errorMsg, error: error.message,
        });
        // Ensure the returned object matches SearchResult structure
        return { // <-- Fix applied here
          output: errorMsg,
          filesFound: 0,
          filesProcessed: 0,
          errorsEncountered: 1, // Indicate an error occurred
          pathErrors: [errorMsg], // Include the error message in pathErrors
        };
      }
    },
  );
  
  ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => {
      if (!validateSender(event.senderFrame)) {
        return undefined;
      }
      console.log("IPC: Received save-file-dialog request");
      if (!mainWindow) return undefined;
      try {
        const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
          title: "Save Search Results", buttonLabel: "Save", defaultPath: `file-content-aggregator-results.txt`,
          filters: [{ name: "Text Files", extensions: ["txt"] }, { name: "All Files", extensions: ["*"] }],
        });
        return canceled || !filePath ? undefined : filePath;
      } catch (error: any) {
        console.error("IPC: Error showing save file dialog:", error);
        return undefined;
      }
    },
  );
  
  ipcMain.handle(
    "write-file",
    async (event, filePath: string, content: string): Promise<boolean> => {
      if (!validateSender(event.senderFrame)) {
        return false;
      }
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
  
  ipcMain.handle("copy-to-clipboard", (event, content: string): boolean => {
      if (!validateSender(event.senderFrame)) {
        return false;
      }
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
  