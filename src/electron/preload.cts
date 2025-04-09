const { contextBridge, ipcRenderer } = require("electron");
import type { IpcRendererEvent } from "electron";
import type {
  SearchParams,
  SearchResult,
  ProgressData,
  SearchHistoryEntry,
  ThemePreference,
  StructuredItem,
  ExportFormat,
} from "../ui/vite-env.d";

/**
 * Defines the API exposed from the preload script to the renderer process.
 * This acts as a secure bridge for invoking main process functionality and listening for events.
 */
const electronAPI = {
  // --- Invoke Handlers (Renderer -> Main -> Renderer) ---

  /**
   * Invokes the file search process in the main process.
   * @param params Search parameters excluding the structured query (which is converted to string).
   * @returns A promise resolving with the search results.
   */
  invokeSearch: (
    params: Omit<SearchParams, "structuredQuery">
  ): Promise<SearchResult> => ipcRenderer.invoke("search-files", params),

  /**
   * Invokes the copy-to-clipboard functionality in the main process.
   * @param content The string content to copy.
   * @returns A promise resolving with true if successful, false otherwise.
   */
  copyToClipboard: (content: string): Promise<boolean> =>
    ipcRenderer.invoke("copy-to-clipboard", content),

  // --- Event Listeners (Main -> Renderer) ---

  /**
   * Registers a callback to receive search progress updates from the main process.
   * @param callback The function to call with progress data.
   * @returns A function to unsubscribe the listener.
   */
  onSearchProgress: (callback: (data: ProgressData) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, data: ProgressData) =>
      callback(data);
    ipcRenderer.on("search-progress", listener);
    return () => ipcRenderer.removeListener("search-progress", listener);
  },

  // --- i18n Methods ---

  /**
   * Gets the initial language preference from the main process.
   * @returns A promise resolving with the language code (e.g., 'en', 'de').
   */
  getInitialLanguage: (): Promise<string> =>
    ipcRenderer.invoke("get-initial-language"),

  /**
   * Saves the user's language preference in the main process.
   * @param lng The language code to save.
   * @returns A promise resolving when the preference is saved.
   */
  setLanguagePreference: (lng: string): Promise<void> =>
    ipcRenderer.invoke("set-language-preference", lng),

  /**
   * Notifies the main process that the renderer's language has changed.
   * @param lng The new language code.
   */
  notifyLanguageChanged: (lng: string): void =>
    ipcRenderer.send("language-changed", lng),

  // --- Search History Methods ---

  /**
   * Adds an entry to the search history in the main process.
   * @param entry The search history entry to add.
   * @returns A promise resolving when the entry is added.
   */
  addSearchHistoryEntry: (entry: SearchHistoryEntry): Promise<void> =>
    ipcRenderer.invoke("add-search-history-entry", entry),

  /**
   * Retrieves the entire search history from the main process.
   * @returns A promise resolving with an array of search history entries.
   */
  getSearchHistory: (): Promise<SearchHistoryEntry[]> =>
    ipcRenderer.invoke("get-search-history"),

  /**
   * Deletes a specific entry from the search history in the main process.
   * @param entryId The ID of the entry to delete.
   * @returns A promise resolving when the entry is deleted.
   */
  deleteSearchHistoryEntry: (entryId: string): Promise<void> =>
    ipcRenderer.invoke("delete-search-history-entry", entryId),

  /**
   * Clears the entire search history in the main process.
   * @returns A promise resolving with true if successful, false otherwise.
   */
  clearSearchHistory: (): Promise<boolean> =>
    ipcRenderer.invoke("clear-search-history"),

  /**
   * Updates the name or favorite status of a specific history entry in the main process.
   * @param entryId The ID of the entry to update.
   * @param updates An object containing the fields to update ('name' and/or 'isFavorite').
   * @returns A promise resolving with true if successful, false otherwise.
   */
  updateSearchHistoryEntry: (
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
  ): Promise<boolean> =>
    ipcRenderer.invoke("update-search-history-entry", entryId, updates),

  // --- Theme Methods ---

  /**
   * Gets the current theme preference ('light', 'dark', or 'system') from the main process.
   * @returns A promise resolving with the theme preference.
   */
  getThemePreference: (): Promise<ThemePreference> =>
    ipcRenderer.invoke("get-theme-preference"),

  /**
   * Saves the user's theme preference in the main process.
   * @param theme The theme preference to save.
   * @returns A promise resolving when the preference is saved.
   */
  setThemePreference: (theme: ThemePreference): Promise<void> =>
    ipcRenderer.invoke("set-theme-preference", theme),

  /**
   * Registers a callback to receive theme preference changes initiated by the main process (e.g., from settings).
   * @param callback The function to call with the new theme preference.
   * @returns A function to unsubscribe the listener.
   */
  onThemePreferenceChanged: (
    callback: (theme: ThemePreference) => void
  ): (() => void) => {
    const listener = (_event: IpcRendererEvent, theme: ThemePreference) =>
      callback(theme);
    ipcRenderer.on("theme-preference-changed", listener);
    return () =>
      ipcRenderer.removeListener("theme-preference-changed", listener);
  },

  // --- Cancellation Method (Renderer -> Main) ---

  /**
   * Sends a request to the main process to cancel the ongoing search.
   */
  cancelSearch: (): void => ipcRenderer.send("cancel-search"),

  // --- Export Method (Renderer -> Main -> Renderer) ---

  /**
   * Invokes the export results functionality in the main process.
   * @param items The structured data items to export.
   * @param format The desired export format ('csv', 'json', 'md').
   * @returns A promise resolving with an object indicating success or failure (with an optional error message).
   */
  exportResults: (
    items: StructuredItem[],
    format: ExportFormat
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("export-results", items, format),
};

// --- Expose API to Renderer ---
try {
  // Use contextBridge to securely expose the API to the renderer process
  // under the window.electronAPI object.
  contextBridge.exposeInMainWorld("electronAPI", electronAPI);
  console.log("Preload script: electronAPI exposed successfully.");
} catch (error) {
  console.error("Preload script error exposing API:", error);
}
