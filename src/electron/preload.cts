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
   * @returns A promise resolving with the search results (note: structuredItems will not contain full content).
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

  // --- Export/Copy Methods (Renderer -> Main -> Renderer) ---

  /**
   * Invokes the export results functionality in the main process (saves to file).
   * @param items The structured data items to export (should not contain full content).
   * @param format The desired export format ('txt', 'csv', 'json', 'md').
   * @returns A promise resolving with an object indicating success or failure (with an optional error message).
   */
  exportResults: (
    items: StructuredItem[],
    format: ExportFormat
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("export-results", items, format),

  /**
   * Invokes the main process to generate the export content string for the given format.
   * Used for the "Copy to Clipboard" functionality.
   * @param items The structured data items.
   * @param format The desired export format.
   * @returns A promise resolving with the generated content string or an error.
   */
  invokeGenerateExportContent: (
    items: StructuredItem[],
    format: ExportFormat
  ): Promise<{ content: string | null; error?: string }> =>
    ipcRenderer.invoke("generate-export-content", items, format),

  /**
   * Invokes the main process to read the content of a specific file.
   * @param filePath The absolute path to the file.
   * @returns A promise resolving with an object containing the file content or an error key.
   */
  invokeGetFileContent: (
    filePath: string
  ): Promise<{ content: string | null; error?: string }> =>
    ipcRenderer.invoke("get-file-content", filePath),

  // --- Settings Methods ---
  /** Gets the default export format preference. */
  getDefaultExportFormat: (): Promise<ExportFormat> =>
    ipcRenderer.invoke("get-default-export-format"),
  /** Sets the default export format preference. */
  setDefaultExportFormat: (format: ExportFormat): Promise<void> =>
    ipcRenderer.invoke("set-default-export-format", format),
  /** Gets the fuzzy search in Boolean queries enabled preference. */
  getFuzzySearchBooleanEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-fuzzy-search-boolean-enabled"),
  /** Sets the fuzzy search in Boolean queries enabled preference. */
  setFuzzySearchBooleanEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-fuzzy-search-boolean-enabled", enabled),
  /** Gets the fuzzy search in NEAR function enabled preference. */
  getFuzzySearchNearEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-fuzzy-search-near-enabled"),
  /** Sets the fuzzy search in NEAR function enabled preference. */
  setFuzzySearchNearEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-fuzzy-search-near-enabled", enabled),
  /** Gets the whole word matching enabled preference. */
  getWholeWordMatchingEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-whole-word-matching-enabled"),
  /** Sets the whole word matching enabled preference. */
  setWholeWordMatchingEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-whole-word-matching-enabled", enabled),

  // --- Performance Profiling Methods ---
  /** Gets the profiling enabled preference. */
  getProfilingEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-profiling-enabled"),
  /** Sets the profiling enabled preference. */
  setProfilingEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-profiling-enabled", enabled),
  /** Gets the detailed memory tracking enabled preference. */
  getDetailedMemoryTrackingEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke("get-detailed-memory-tracking-enabled"),
  /** Sets the detailed memory tracking enabled preference. */
  setDetailedMemoryTrackingEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke("set-detailed-memory-tracking-enabled", enabled),
  /** Gets the performance summary data. */
  getPerformanceSummary: (): Promise<any> =>
    ipcRenderer.invoke("get-performance-summary"),
  /** Gets the performance metrics history. */
  getPerformanceMetricsHistory: (): Promise<any[]> =>
    ipcRenderer.invoke("get-performance-metrics-history"),
  /** Saves the performance report to a file. */
  savePerformanceReport: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("save-performance-report"),
  /** Clears all performance data. */
  clearPerformanceData: (): Promise<boolean> =>
    ipcRenderer.invoke("clear-performance-data"),

  // --- File System Operations ---
  /**
   * Opens the specified file with the default system application.
   * @param filePath The absolute path to the file to open.
   * @returns A promise resolving with an object indicating success or failure (with an optional error message).
   */
  openFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("open-file", filePath),
  /**
   * Shows the specified file in its parent folder using the system's file explorer.
   * @param filePath The absolute path to the file to show.
   * @returns A promise resolving with an object indicating success or failure (with an optional error message).
   */
  openFileLocation: (
    filePath: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("open-file-location", filePath),
  /**
   * Shows a directory selection dialog that allows multiple selections.
   * @returns A promise resolving with an object containing the selected directory paths, a canceled flag, and an optional error message.
   */
  showDirectoryDialog: (): Promise<{
    filePaths: string[];
    canceled: boolean;
    error?: string;
  }> => ipcRenderer.invoke("show-directory-dialog"),
  /**
   * Copies the file paths of selected files to the clipboard.
   * @param filePaths Array of file paths to copy.
   * @returns A promise resolving with an object indicating success or failure (with an optional error message).
   */
  copyFilePaths: (
    filePaths: string[]
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke("copy-file-paths", filePaths),
  /**
   * Copies selected files to a destination folder.
   * @param filePaths Array of file paths to copy.
   * @returns A promise resolving with an object indicating success or failure (with an optional error message and destination folder).
   */
  copyFilesToFolder: (
    filePaths: string[]
  ): Promise<{
    success: boolean;
    error?: string;
    destinationFolder?: string;
  }> => ipcRenderer.invoke("copy-files-to-folder", filePaths),
  /**
   * Moves selected files to a destination folder.
   * @param filePaths Array of file paths to move.
   * @returns A promise resolving with an object indicating success or failure (with an optional error message and destination folder).
   */
  moveFilesToFolder: (
    filePaths: string[]
  ): Promise<{
    success: boolean;
    error?: string;
    destinationFolder?: string;
  }> => ipcRenderer.invoke("move-files-to-folder", filePaths),
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
