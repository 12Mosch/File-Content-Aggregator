// D:/Code/Electron/src/electron/preload.cts
const { contextBridge, ipcRenderer } = require("electron");
// Import Electron types for use in annotations
import type { IpcRendererEvent } from "electron";

// Define the API structure to be exposed to the renderer process
// We use 'any' for complex types passed across the bridge,
// relying on the typed main/renderer processes for stricter checks.
const electronAPI = {
  // --- Invoke Handlers (Renderer -> Main -> Renderer) ---

  /**
   * Invokes the file search process in the main process.
   * @param params - An object containing search parameters (structure matches SearchParams).
   * @returns A Promise resolving to the search results (structure matches SearchResult).
   */
  invokeSearch: (params: any): Promise<any> => // Use 'any' for params and return type
    ipcRenderer.invoke("search-files", params),

  /**
   * Shows the native "Save File" dialog.
   * @returns A Promise resolving to the selected file path or undefined if cancelled.
   */
  showSaveDialog: (): Promise<string | undefined> =>
    ipcRenderer.invoke("save-file-dialog"),

  /**
   * Writes content to a specified file path.
   * @param filePath - The absolute path to the file.
   * @param content - The string content to write.
   * @returns A Promise resolving to true on success, false on failure.
   */
  writeFile: (filePath: string, content: string): Promise<boolean> =>
    ipcRenderer.invoke("write-file", filePath, content),

  /**
   * Copies the given text content to the system clipboard.
   * @param content - The string content to copy.
   * @returns A Promise resolving to true on success, false on failure.
   */
  copyToClipboard: (content: string): Promise<boolean> =>
    ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Event Listeners (Main -> Renderer) ---

  /**
   * Registers a callback function to receive search progress updates from the main process.
   * @param callback - The function to call with progress data (structure matches ProgressData).
   * @returns A function to unsubscribe the listener.
   */
  onSearchProgress: (callback: (data: any) => void): (() => void) => { // Use 'any' for data
    // Define the listener with explicit types
    const listener = (_event: IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("search-progress", listener);
    // Return an unsubscribe function
    return () => ipcRenderer.removeListener("search-progress", listener);
  },

  // --- i18n Methods ---

  /**
   * Gets the initial language (stored preference or OS locale) from the main process.
   * @returns Promise<string> - The language code (e.g., 'en', 'de').
   */
  getInitialLanguage: (): Promise<string> =>
    ipcRenderer.invoke("get-initial-language"),

  /**
   * Saves the user's preferred language via the main process.
   * @param lng - The language code to save (e.g., 'fr').
   * @returns Promise<void>
   */
  setLanguagePreference: (lng: string): Promise<void> =>
    ipcRenderer.invoke("set-language-preference", lng),

  /**
   * Notifies the main process that the renderer's language has changed.
   * @param lng - The new language code.
   * @returns {void}
   */
  notifyLanguageChanged: (lng: string): void =>
    ipcRenderer.send("language-changed", lng),

};

// --- Expose API ---
try {
  // Securely expose the defined API to the renderer process under the 'electronAPI' key
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
