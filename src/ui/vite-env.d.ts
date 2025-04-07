/// <reference types="vite/client" />

// --- Query Builder Types ---
export type { QueryGroup as QueryStructure, Condition, TermCondition, RegexCondition, NearCondition } from './queryBuilderTypes';
import type { QueryGroup as InternalQueryStructure } from './queryBuilderTypes';

// --- Data Structures ---

interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
  status?: 'searching' | 'cancelling' | 'cancelled' | 'completed' | 'error';
}

interface StructuredItem {
  filePath: string;
  content: string | null;
  readError?: string;
}

// Mirrored from backend
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
  wasCancelled?: boolean; // Flag to indicate cancellation
}

type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// --- Define Content Search Mode ---
export type ContentSearchMode = "term" | "regex" | "boolean";
// --------------------------------------

// --- Theme Preference Type ---
export type ThemePreference = "light" | "dark" | "system";
// ---------------------------

// Updated SearchParams interface (used for submitting search AND storing in history)
// This is the structure that will be saved in history entries.
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string; // Generated string query
  contentSearchMode?: ContentSearchMode; // Likely 'boolean' if term exists
  structuredQuery?: InternalQueryStructure | null; // Include the raw structure for history saving
  caseSensitive?: boolean; // Still used for backend simple term matching
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

// --- Search History Entry Structure ---
// Added name and isFavorite
export interface SearchHistoryEntry {
    id: string;
    timestamp: string; // ISO string
    name?: string; // Optional user-defined name
    isFavorite?: boolean; // Optional favorite flag
    // Use the SearchParams interface directly for the parameters
    searchParams: SearchParams;
}
// -----------------------------------------

// --- Electron API Definition ---
export interface IElectronAPI {
  invokeSearch: (params: Omit<SearchParams, 'structuredQuery'>) => Promise<SearchResult>;
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
  updateSearchHistoryEntry: (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => Promise<boolean>;

  // Theme API
  getThemePreference: () => Promise<ThemePreference>;
  setThemePreference: (theme: ThemePreference) => Promise<void>;

  // --- NEW: Cancellation API ---
  cancelSearch: () => void; // Send-only, no return value expected
  // -----------------------------
}

// --- Global Window Augmentation ---
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---
export type { ProgressData, SearchResult, FileReadError, SearchParams, FolderExclusionMode, StructuredItem };
