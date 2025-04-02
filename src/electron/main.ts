import {
    app,
    BrowserWindow,
    ipcMain,
    dialog,
    clipboard,
    session,
    protocol, // Added protocol module
    shell, // Added shell module
  } from "electron";
  import path from "path";
  import fs from "fs/promises";
  import { isDev } from "./util.js";
  import { getPreloadPath } from "./pathResolver.js";
  import {
    searchFiles,
    SearchParams,
    ProgressData,
    SearchResult,
  } from "./fileSearchService.js";
  import mime from "mime"; // Added mime library
  
  // --- Constants ---
  const APP_PROTOCOL = "app"; // Define custom protocol scheme
  
  // --- Global Window Reference ---
  let mainWindow: BrowserWindow | null = null;
  
  // --- Custom Protocol Handler ---
  function registerAppProtocol() {
    protocol.handle(APP_PROTOCOL, async (request) => {
      try {
        let requestedPath = decodeURIComponent(
          request.url.substring(`${APP_PROTOCOL}://`.length),
        );
  
        // Default to index.html if no path specified (e.g., app://)
        if (!requestedPath || requestedPath === "/") {
          requestedPath = "index.html";
        }
  
        // Construct the absolute path to the file within dist-react
        const appBasePath = path.join(app.getAppPath(), "dist-react");
        const absoluteFilePath = path.normalize(
          path.join(appBasePath, requestedPath),
        );
  
        // Security: Prevent directory traversal. Ensure the path is still within dist-react.
        if (!absoluteFilePath.startsWith(appBasePath)) {
          console.error(
            `Blocked potentially malicious path traversal: ${requestedPath}`,
          );
          return new Response("Not Found", { status: 404 });
        }
  
        // Read the file content
        const data = await fs.readFile(absoluteFilePath);
  
        // Determine MIME type
        const mimeType = mime.getType(absoluteFilePath) || "text/plain"; // Default MIME type
  
        // Return the response
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
  
  // --- Content Security Policy (CSP) ---
  function setupCSP() {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      let csp = "";
      const selfSrc = `'self'`; // Base 'self' directive
      const appProtoSrc = `${APP_PROTOCOL}:`; // Custom protocol source
  
      if (isDev()) {
        // Development CSP (allows Vite HMR)
        const viteServer = "http://localhost:5123";
        const viteWs = "ws://localhost:5123";
        csp = [
          `default-src ${selfSrc}`,
          `script-src ${selfSrc} 'unsafe-inline' 'unsafe-eval' ${viteServer}`, // Allow Vite server, inline, eval
          `style-src ${selfSrc} 'unsafe-inline'`, // Allow inline styles
          `connect-src ${selfSrc} ${viteWs}`, // Allow Vite WebSocket
          `img-src ${selfSrc} data:`,
          `font-src ${selfSrc}`,
          `object-src 'none'`,
        ].join("; ");
      } else {
        // Production CSP (uses custom protocol)
        csp = [
          `default-src ${appProtoSrc}`, // Default to custom protocol
          `script-src ${appProtoSrc}`, // Only scripts from custom protocol
          `style-src ${appProtoSrc}`, // Only styles from custom protocol (Ensure no inline styles in prod build)
          `connect-src ${appProtoSrc}`, // Only connections from custom protocol
          `img-src ${appProtoSrc} data:`, // Allow images from custom protocol and data URIs
          `font-src ${appProtoSrc}`, // Allow fonts from custom protocol
          `object-src 'none'`, // Disallow plugins
          `frame-ancestors 'none'`, // Prevent framing/clickjacking
        ].join("; ");
      }
  
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          "Content-Security-Policy": [csp],
          // Add other security headers (optional but recommended)
          "X-Content-Type-Options": ["nosniff"],
          "X-Frame-Options": ["DENY"], // Already covered by frame-ancestors 'none' in CSP
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
        sandbox: true, // <-- 4. Enable Sandboxing
        // Security considerations for sandboxing:
        // - Preload scripts run in a sandboxed environment.
        // - They have limited access to Node.js APIs (only those not requiring OS-level access).
        // - If preload needs more (e.g., direct fs access), move that logic to main process via IPC.
        // - `clipboard`, `ipcRenderer`, `contextBridge` generally work.
      },
    });
  
    if (isDev()) {
      // Development: Load from Vite dev server
      mainWindow.loadURL("http://localhost:5123");
      mainWindow.webContents.openDevTools();
    } else {
      // Production: Load from custom protocol
      mainWindow.loadURL(`${APP_PROTOCOL}://index.html`); // <-- 18. Use Custom Protocol
    }
  
    mainWindow.on("closed", () => {
      mainWindow = null;
    });
  }
  
  // --- App Lifecycle & Security Setup ---
  
  // 18. Register custom protocol before app is ready
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_PROTOCOL, privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
  ]);
  
  app.whenReady().then(() => {
    setupCSP(); // Set up CSP
    registerAppProtocol(); // Register custom protocol handler
    createWindow(); // Create the main window
  
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
  
  // --- Security: Limit Navigation & Window Creation ---
  app.on("web-contents-created", (event, contents) => {
    // 13. Disable or limit navigation
    contents.on("will-navigate", (event, navigationUrl) => {
      console.warn(`Security: Blocked navigation attempt to ${navigationUrl}`);
      event.preventDefault(); // Prevent all navigation
    });
  
    // 14. Disable or limit creation of new windows
    contents.setWindowOpenHandler(({ url }) => {
      console.warn(`Security: Blocked attempt to open new window for ${url}`);
      // If you *need* to open external links, validate URL carefully here
      // try {
      //   const parsedUrl = new URL(url);
      //   if (['https:', 'mailto:'].includes(parsedUrl.protocol)) {
      //     // Add more validation if needed (e.g., check origin against allowlist)
      //     setImmediate(() => { // Use setImmediate to avoid potential issues
      //        shell.openExternal(url);
      //     });
      //     return { action: 'deny' }; // Still deny creating an Electron window
      //   }
      // } catch (e) {
      //   console.error('Error parsing or opening URL:', e);
      // }
      return { action: "deny" }; // Deny creating a new Electron window
    });
  });
  
  // --- IPC Handlers with Sender Validation ---
  
  // Helper for IPC validation
  function validateSender(senderFrame: Electron.WebFrameMain | null): boolean {
    if (!mainWindow || !senderFrame) {
      return false;
    }
    // Basic check: Ensure the sender is the main frame of our main window
    if (senderFrame === mainWindow.webContents.mainFrame) {
      return true;
    }
    console.error("IPC Validation Failed: Sender is not the main frame.");
    return false;
  }
  
  ipcMain.handle(
    "search-files",
    async (event, params: SearchParams): Promise<SearchResult> => {
      // 17. Validate IPC Sender
      if (!validateSender(event.senderFrame)) {
        return {
          output: "Error: Invalid IPC sender",
          filesFound: 0,
          filesProcessed: 0,
          errorsEncountered: 1,
        };
      }
  
      console.log("IPC: Received search-files request"); // Params logging removed for brevity
      const progressCallback = (data: ProgressData) => {
        if (mainWindow) {
          mainWindow.webContents.send("search-progress", data);
        }
      };
      try {
        const results = await searchFiles(params, progressCallback);
        console.log(`IPC: search-files completed.`); // Summary logging removed for brevity
        return results;
      } catch (error: any) {
        console.error("IPC: Error during searchFiles execution:", error);
        progressCallback({
          processed: 0, total: 0, message: `Search failed: ${error.message}`, error: error.message,
        });
        return {
          output: `Search failed: ${error.message}`, filesFound: 0, filesProcessed: 0, errorsEncountered: 1,
        };
      }
    },
  );
  
  ipcMain.handle("save-file-dialog", async (event): Promise<string | undefined> => {
      // 17. Validate IPC Sender
      if (!validateSender(event.senderFrame)) {
        return undefined; // Or throw an error
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
      // 17. Validate IPC Sender
      if (!validateSender(event.senderFrame)) {
        return false;
      }
  
      console.log(`IPC: Received write-file request`); // Path logging removed for brevity
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
      // 17. Validate IPC Sender
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
  