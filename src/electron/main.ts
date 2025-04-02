import { app, BrowserWindow, ipcMain, dialog, clipboard } from "electron"; // Added dialog, clipboard
import path from "path";
import fs from "fs/promises"; // Needed for write-file handler
import { isDev } from "./util.js";
import { getPreloadPath } from "./pathResolver.js";
// Import the new service and types
import {
  searchFiles,
  SearchParams,
  ProgressData,
  SearchResult,
} from "./fileSearchService.js";

// Keep a reference to the main window so it's not garbage collected.
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000, // Increased default size
    height: 800,
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true, // Enable context isolation for security
      nodeIntegration: false, // Disable Node.js integration in renderer
    },
  });

  if (isDev()) {
    mainWindow.loadURL("http://localhost:5123");
    mainWindow.webContents.openDevTools(); // Open DevTools automatically in dev
  } else {
    mainWindow.loadFile(
      path.join(app.getAppPath(), "/dist-react/index.html"),
    );
  }

  mainWindow.on("closed", () => {
    mainWindow = null; // Dereference the window object
  });
}

app.on("ready", createWindow);

// --- IPC Handlers ---

// Handle the file search request from the renderer
ipcMain.handle(
  "search-files",
  async (event, params: SearchParams): Promise<SearchResult> => {
    console.log("IPC: Received search-files request with params:", params);

    // Define the progress callback function
    const progressCallback = (data: ProgressData) => {
      console.log("IPC: Sending search-progress update:", data);
      // Ensure mainWindow still exists before sending
      if (mainWindow) {
        mainWindow.webContents.send("search-progress", data);
      } else {
        console.warn("IPC: mainWindow not available to send progress update.");
        // Optionally, could throw an error here to cancel the search if the window is gone.
      }
    };

    try {
      // Call the search service function with parameters and the callback
      const results = await searchFiles(params, progressCallback);
      console.log(
        `IPC: search-files completed. Processed: ${results.filesProcessed}, Errors: ${results.errorsEncountered}`,
      );
      return results;
    } catch (error: any) {
      console.error("IPC: Error during searchFiles execution:", error);
      // Send a final progress update indicating failure
      progressCallback({
        processed: 0,
        total: 0,
        message: `Search failed: ${error.message}`,
        error: error.message,
      });
      // Re-throw or return an error structure to the renderer
      // For simplicity, returning an empty result with error count
      return {
        output: `Search failed: ${error.message}`,
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 1,
      };
    }
  },
);

// Handle request to show the 'Save File' dialog
ipcMain.handle("save-file-dialog", async (): Promise<string | undefined> => {
  console.log("IPC: Received save-file-dialog request");
  if (!mainWindow) {
    console.error("IPC: Cannot show save dialog, mainWindow is null.");
    return undefined;
  }
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: "Save Search Results",
      buttonLabel: "Save",
      filters: [
        { name: "Text Files", extensions: ["txt"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });
    if (canceled || !filePath) {
      console.log("IPC: Save file dialog cancelled.");
      return undefined;
    }
    console.log(`IPC: Save file dialog returned path: ${filePath}`);
    return filePath;
  } catch (error: any) {
    console.error("IPC: Error showing save file dialog:", error);
    return undefined;
  }
});

// Handle request to write content to a file
ipcMain.handle(
  "write-file",
  async (event, filePath: string, content: string): Promise<boolean> => {
    console.log(`IPC: Received write-file request for path: ${filePath}`);
    if (!filePath) {
      console.error("IPC: write-file request received null/empty file path.");
      return false;
    }
    try {
      await fs.writeFile(filePath, content, "utf8");
      console.log(`IPC: Successfully wrote content to ${filePath}`);
      return true;
    } catch (error: any) {
      console.error(`IPC: Error writing file '${filePath}':`, error);
      return false;
    }
  },
);

// Handle request to copy text to the clipboard
ipcMain.handle(
  "copy-to-clipboard",
  (event, content: string): boolean => {
    console.log("IPC: Received copy-to-clipboard request");
    try {
      clipboard.writeText(content);
      console.log("IPC: Content copied to clipboard.");
      return true;
    } catch (error: any) {
      console.error("IPC: Error copying to clipboard:", error);
      return false;
    }
  },
);

// --- Standard App Lifecycle Handlers ---

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
