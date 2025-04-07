const { contextBridge, ipcRenderer } = require("electron");
import type { IpcRendererEvent } from "electron";

const electronAPI = {
  // --- Invoke Handlers ---
  invokeSearch: (params: any): Promise<any> => ipcRenderer.invoke("search-files", params),
  showSaveDialog: (): Promise<string | undefined> => ipcRenderer.invoke("save-file-dialog"),
  writeFile: (filePath: string, content: string): Promise<boolean> => ipcRenderer.invoke("write-file", filePath, content),
  copyToClipboard: (content: string): Promise<boolean> => ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Event Listeners ---
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
  clearSearchHistory: (): Promise<boolean> => ipcRenderer.invoke("clear-search-history"),
  updateSearchHistoryEntry: (entryId: string, updates: any): Promise<boolean> => ipcRenderer.invoke("update-search-history-entry", entryId, updates),

  // --- Theme Methods ---
  getThemePreference: (): Promise<string> => ipcRenderer.invoke("get-theme-preference"),
  setThemePreference: (theme: string): Promise<void> => ipcRenderer.invoke("set-theme-preference", theme),

  // --- Cancellation Method ---
  cancelSearch: (): void => ipcRenderer.send("cancel-search"),

};

// --- Expose API ---
try {
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
