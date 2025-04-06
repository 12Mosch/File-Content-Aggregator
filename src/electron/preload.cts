// D:/Code/Electron/src/electron/preload.cts
const { contextBridge, ipcRenderer } = require("electron");
// Import Electron types for use in annotations
import type { IpcRendererEvent } from "electron";

// Define the API structure to be exposed to the renderer process
// We use 'any' for complex types passed across the bridge,
// relying on the typed main/renderer processes for stricter checks.
const electronAPI = {
  // --- Invoke Handlers (Renderer -> Main -> Renderer) ---
  invokeSearch: (params: any): Promise<any> => ipcRenderer.invoke("search-files", params),
  showSaveDialog: (): Promise<string | undefined> => ipcRenderer.invoke("save-file-dialog"),
  writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke("write-file", filePath, content),
  copyToClipboard: (content: string): Promise<boolean> => ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Event Listeners (Main -> Renderer) ---
  onSearchProgress: (callback: (data: any) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("search-progress", listener);
    return () => ipcRenderer.removeListener("search-progress", listener);
  },

  // --- i18n Methods ---
  getInitialLanguage: (): Promise<string> => ipcRenderer.invoke("get-initial-language"),
  setLanguagePreference: (lng: string): Promise<void> => ipcRenderer.invoke("set-language-preference", lng),
  notifyLanguageChanged: (lng: string): void => ipcRenderer.send("language-changed", lng),

  // --- Search History Methods ---
  addSearchHistoryEntry: (entry: any): Promise<void> => ipcRenderer.invoke("add-search-history-entry", entry),
  getSearchHistory: (): Promise<any[]> => ipcRenderer.invoke("get-search-history"),
  deleteSearchHistoryEntry: (entryId: string): Promise<void> => ipcRenderer.invoke("delete-search-history-entry", entryId),
  clearSearchHistory: (): Promise<boolean> => ipcRenderer.invoke("clear-search-history"), // Returns boolean now
  // --- NEW: Update History Entry ---
  updateSearchHistoryEntry: (entryId: string, updates: any): Promise<boolean> =>
    ipcRenderer.invoke("update-search-history-entry", entryId, updates),
};

// --- Expose API ---
try {
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
