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

interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
  status?: "searching" | "cancelling" | "cancelled" | "completed" | "error";
}

interface StructuredItem {
  filePath: string;
  content: string | null;
  readError?: string;
}

interface FileReadError {
  filePath: string;
  reason: string;
  detail?: string;
}

interface SearchResult {
  output: string;
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
  wasCancelled?: boolean;
}

type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";
export type ContentSearchMode = "term" | "regex" | "boolean";
export type ThemePreference = "light" | "dark" | "system";

interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string;
  contentSearchMode?: ContentSearchMode;
  structuredQuery?: InternalQueryStructure | null;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

export interface SearchHistoryEntry {
  id: string;
  timestamp: string;
  name?: string;
  isFavorite?: boolean;
  searchParams: SearchParams;
}

// --- Electron API Definition ---
export interface IElectronAPI {
  invokeSearch: (
    params: Omit<SearchParams, "structuredQuery">
  ) => Promise<SearchResult>;
  showSaveDialog: () => Promise<string | undefined>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  copyToClipboard: (content: string) => Promise<boolean>;
  onSearchProgress: (callback: (data: ProgressData) => void) => () => void;
  getInitialLanguage: () => Promise<string>;
  setLanguagePreference: (lng: string) => Promise<void>;
  notifyLanguageChanged: (lng: string) => void;

  // History API
  addSearchHistoryEntry: (entry: SearchHistoryEntry) => Promise<void>;
  getSearchHistory: () => Promise<SearchHistoryEntry[]>;
  deleteSearchHistoryEntry: (entryId: string) => Promise<void>;
  clearSearchHistory: () => Promise<boolean>;
  updateSearchHistoryEntry: (
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
  ) => Promise<boolean>;

  // Theme API
  getThemePreference: () => Promise<ThemePreference>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;
  // --- NEW: Theme Change Listener ---
  onThemePreferenceChanged: (
    callback: (theme: ThemePreference) => void
  ) => () => void;
  // -----------------------------

  // Cancellation API
  cancelSearch: () => void;
}

// --- Global Window Augmentation ---
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---
export type {
  ProgressData,
  SearchResult,
  FileReadError,
  SearchParams,
  FolderExclusionMode,
  StructuredItem,
};
