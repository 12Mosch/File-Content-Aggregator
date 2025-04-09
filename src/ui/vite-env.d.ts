/// <reference types="vite/client" />

// --- Query Builder Types ---
export type {
  QueryGroup as QueryStructure,
  Condition,
  TermCondition,
  RegexCondition,
  NearCondition,
} from "./queryBuilderTypes";
import type { QueryGroup as InternalQueryStructure } from "./queryBuilderTypes";

// --- Data Structures ---

/** Progress data sent from main to renderer during search */
interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
  status?: "searching" | "cancelling" | "cancelled" | "completed" | "error";
}

/** Represents a single file's result in the structured view (content fetched on demand) */
interface StructuredItem {
  filePath: string;
  // content: string | null; // Removed: Content is fetched on demand
  matched: boolean; // Indicates if content matched (if query was present)
  readError?: string; // Key indicating the type of read error, if any
}

/** Detailed information about a file read error */
interface FileReadError {
  filePath: string;
  reason: string; // Key indicating the type of read error
  detail?: string; // Specific error message from the system
}

/** The overall result object returned by the search process (no aggregated output) */
interface SearchResult {
  // output: string; // Removed: Aggregated output is no longer generated
  structuredItems: StructuredItem[]; // Data for tree view (without content)
  filesProcessed: number; // Count of files actually read/checked
  filesFound: number; // Count of files found initially matching path/extension
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[]; // Errors related to accessing search paths
  fileReadErrors: FileReadError[]; // Detailed file read errors
  wasCancelled?: boolean; // Flag indicating if the search was cancelled
}

/** Modes for matching excluded folder patterns */
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";
/** Modes for content searching */
export type ContentSearchMode = "term" | "regex" | "boolean";
/** Available theme preferences */
export type ThemePreference = "light" | "dark" | "system";
/** Available formats for exporting results */
export type ExportFormat = "txt" | "csv" | "json" | "md"; // Added 'txt'

/** Parameters defining a search operation */
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string; // The raw string query (term, regex, or boolean expression)
  contentSearchMode?: ContentSearchMode; // How to interpret contentSearchTerm
  // Use the specific type for UI interaction, but keep unknown for storage/IPC boundary
  structuredQuery?: InternalQueryStructure | null;
  caseSensitive?: boolean; // Case sensitivity for simple terms in boolean query
  modifiedAfter?: string; // Date string (YYYY-MM-DD)
  modifiedBefore?: string; // Date string (YYYY-MM-DD)
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

/** Structure for storing a single search history entry */
export interface SearchHistoryEntry {
  id: string;
  timestamp: string; // ISO date string
  name?: string; // User-defined name
  isFavorite?: boolean;
  // Keep structuredQuery as unknown here, as it comes from storage (JSON)
  // We will use a type guard when loading it back into the UI state.
  searchParams: Omit<SearchParams, "structuredQuery"> & {
    structuredQuery?: unknown | null;
  };
}

// --- Electron API Definition (Exposed via Preload) ---
export interface IElectronAPI {
  /** Invokes the file search process. */
  invokeSearch: (
    params: Omit<SearchParams, "structuredQuery">
  ) => Promise<SearchResult>;
  /** Copies the provided text to the system clipboard. */
  copyToClipboard: (content: string) => Promise<boolean>;
  /** Registers a callback for search progress updates. Returns an unsubscribe function. */
  onSearchProgress: (callback: (data: ProgressData) => void) => () => void;
  /** Gets the initial language preference. */
  getInitialLanguage: () => Promise<string>;
  /** Saves the language preference. */
  setLanguagePreference: (lng: string) => Promise<void>;
  /** Notifies the main process of a language change in the renderer. */
  notifyLanguageChanged: (lng: string) => void;

  // History API
  /** Adds an entry to the search history. */
  addSearchHistoryEntry: (entry: SearchHistoryEntry) => Promise<void>;
  /** Retrieves the search history. */
  getSearchHistory: () => Promise<SearchHistoryEntry[]>;
  /** Deletes a specific history entry. */
  deleteSearchHistoryEntry: (entryId: string) => Promise<void>;
  /** Clears the entire search history. */
  clearSearchHistory: () => Promise<boolean>;
  /** Updates the name or favorite status of a history entry. */
  updateSearchHistoryEntry: (
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
  ) => Promise<boolean>;

  // Theme API
  /** Gets the current theme preference. */
  getThemePreference: () => Promise<ThemePreference>;
  /** Saves the theme preference. */
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  /** Registers a callback for theme preference changes. Returns an unsubscribe function. */
  onThemePreferenceChanged: (
    callback: (theme: ThemePreference) => void
  ) => () => void;

  // Cancellation API
  /** Sends a request to cancel the ongoing search. */
  cancelSearch: () => void;

  // Export/Copy API
  /** Exports the structured search results to a file. */
  exportResults: (
    items: StructuredItem[],
    format: ExportFormat
  ) => Promise<{ success: boolean; error?: string }>;
  /** Generates the export content string for the given format (for copy). */
  invokeGenerateExportContent: (
    items: StructuredItem[],
    format: ExportFormat
  ) => Promise<{ content: string | null; error?: string }>;
  /** Reads and returns the content of a specific file. */
  invokeGetFileContent: (
    filePath: string
  ) => Promise<{ content: string | null; error?: string }>;

  // Settings API
  /** Gets the default export format preference. */
  getDefaultExportFormat: () => Promise<ExportFormat>;
  /** Sets the default export format preference. */
  setDefaultExportFormat: (format: ExportFormat) => Promise<void>;
}

// --- Global Window Augmentation ---
// Makes window.electronAPI available globally in the renderer's TypeScript environment.
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---
// Re-export types for easier import in UI components
export type {
  ProgressData,
  SearchResult,
  FileReadError,
  SearchParams,
  FolderExclusionMode,
  StructuredItem,
};
