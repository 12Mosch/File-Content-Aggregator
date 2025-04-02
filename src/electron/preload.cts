// Import necessary Electron modules.
const { contextBridge, ipcRenderer } = require("electron");

// Define the API structure that will be exposed to the renderer process.
// This should match the IElectronAPI interface defined in src/ui/vite-env.d.ts
const electronAPI = {
  // --- Invoke Handlers (Renderer -> Main) ---

  /**
   * Invokes the 'search-files' handler in the main process.
   * @param params - The search parameters.
   * @returns A Promise resolving to the SearchResult object.
   */
  invokeSearch: (params: {
    searchPaths: string[];
    extensions: string[];
    excludeFiles: string[];
    excludeFolders: string[];
  }) => ipcRenderer.invoke("search-files", params),

  /**
   * Invokes the 'save-file-dialog' handler in the main process.
   * @returns A Promise resolving to the selected file path (string) or undefined if cancelled.
   */
  showSaveDialog: () => ipcRenderer.invoke("save-file-dialog"),

  /**
   * Invokes the 'write-file' handler in the main process.
   * @param filePath - The absolute path to the file to write.
   * @param content - The string content to write to the file.
   * @returns A Promise resolving to true if successful, false otherwise.
   */
  writeFile: (filePath: string, content: string) =>
    ipcRenderer.invoke("write-file", filePath, content),

  /**
   * Invokes the 'copy-to-clipboard' handler in the main process.
   * @param content - The string content to copy.
   * @returns A Promise resolving to true if successful, false otherwise.
   * Note: ipcRenderer.invoke returns a Promise, even if the handler is synchronous.
   * The main process handler for copy-to-clipboard is synchronous, but we use invoke
   * for consistency and potential future async operations.
   */
  copyToClipboard: (content: string) =>
    ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Event Listeners (Main -> Renderer) ---

  /**
   * Subscribes to 'search-progress' events sent from the main process.
   * @param callback - The function to execute when a progress update is received.
   *                   It receives the ProgressData object as an argument.
   * @returns A function that can be called to unsubscribe from the events.
   */
  onSearchProgress: (callback: (data: any) => void) => {
    // Define the listener function that wraps the callback
    const listener = (_event: Electron.IpcRendererEvent, data: any) =>
      callback(data);

    // Register the listener for the 'search-progress' channel
    ipcRenderer.on("search-progress", listener);

    // Return an unsubscribe function to clean up the listener
    return () => {
      ipcRenderer.removeListener("search-progress", listener);
    };
  },

  // --- Add other listeners here if needed in the future ---
  // Example:
  // onSomeOtherEvent: (callback: (data: any) => void) => {
  //   const listener = (_event: Electron.IpcRendererEvent, data: any) => callback(data);
  //   ipcRenderer.on('some-other-channel', listener);
  //   return () => ipcRenderer.removeListener('some-other-channel', listener);
  // }
};

// --- Expose the API to the Main World ---
try {
  // Securely expose the defined API to the renderer process under the 'electronAPI' key.
  // Only the functions defined in 'electronAPI' will be accessible via window.electronAPI.
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
