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

/** Represents a single file's result in the structured view */
interface StructuredItem {
  filePath: string;
  content: string | null; // Content if matched, null otherwise
  readError?: string; // Key indicating the type of read error, if any
}

/** Detailed information about a file read error */
interface FileReadError {
  filePath: string;
  reason: string; // Key indicating the type of read error
  detail?: string; // Specific error message from the system
}

/** The overall result object returned by the search process */
interface SearchResult {
  output: string; // Concatenated content for text block view
  structuredItems: StructuredItem[]; // Data for tree view
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
export type ExportFormat = "csv" | "json" | "md";

/** Parameters defining a search operation */
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string; // The raw string query (term, regex, or boolean expression)
  contentSearchMode?: ContentSearchMode; // How to interpret contentSearchTerm
  structuredQuery?: InternalQueryStructure | null; // Parsed query structure (used internally by UI)
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
  searchParams: SearchParams; // The parameters used for this search
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

  // Export API
  /** Exports the structured search results to a file. */
  exportResults: (
    items: StructuredItem[],
    format: ExportFormat
  ) => Promise<{ success: boolean; error?: string }>;
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
