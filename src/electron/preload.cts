const { contextBridge, ipcRenderer } = require("electron");

const electronAPI = {
  // --- Existing Invoke Handlers ---
  invokeSearch: (params: any) => ipcRenderer.invoke("search-files", params),
  showSaveDialog: () => ipcRenderer.invoke("save-file-dialog"),
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("write-file", filePath, content),
  copyToClipboard: (content: string) =>
    ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Existing Event Listeners ---
  onSearchProgress: (callback: (data: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
    ipcRenderer.on("search-progress", listener);
    return () => ipcRenderer.removeListener("search-progress", listener);
  },

  // --- New i18n Methods ---
  /**
   * Gets the initial language (stored preference or OS locale).
   * @returns Promise<string> - The language code (e.g., 'en', 'de').
   */
  getInitialLanguage: () => ipcRenderer.invoke("get-initial-language"),

  /**
   * Saves the user's preferred language.
   * @param lng - The language code to save (e.g., 'fr').
   * @returns Promise<void>
   */
  setLanguagePreference: (lng: string) => ipcRenderer.invoke("set-language-preference", lng),

  /**
   * Notifies the main process that the renderer's language has changed.
   * @param lng - The new language code.
   */
  notifyLanguageChanged: (lng: string) => ipcRenderer.send("language-changed", lng),

  // Optional listener if main needs to trigger renderer change:
  // onLanguageChangeRequest: (callback: (lng: string) => void) => {
  //   const listener = (_event: Electron.IpcRendererEvent, lng: string) => callback(lng);
  //   ipcRenderer.on('request-language-change', listener);
  //   return () => ipcRenderer.removeListener('request-language-change', listener);
  // }
};

try {
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
