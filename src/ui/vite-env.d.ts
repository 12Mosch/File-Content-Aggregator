/// <reference types="vite/client" />

// --- Query Builder Types ---
// Re-exporting from the dedicated types file
export type { QueryGroup as QueryStructure, Condition, TermCondition, RegexCondition, NearCondition } from './queryBuilderTypes';
import type { QueryGroup as InternalQueryStructure } from './queryBuilderTypes'; // Use internal alias

// --- Data Structures ---

interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
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
}

type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// --- Define Content Search Mode ---
export type ContentSearchMode = "term" | "regex" | "boolean";
// --------------------------------------

// Updated SearchParams interface (used for submitting search)
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string; // Generated string query
  contentSearchMode?: ContentSearchMode; // Likely 'boolean' if term exists
  caseSensitive?: boolean; // Still used for backend simple term matching
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

// --- NEW: Search History Entry Structure ---
export interface SearchHistoryEntry {
    id: string;
    timestamp: string; // ISO string
    searchParams: {
        searchPaths: string[];
        extensions: string[];
        excludeFiles: string[];
        excludeFolders: string[];
        folderExclusionMode?: FolderExclusionMode;
        contentSearchTerm?: string; // The generated string query that was sent
        contentSearchMode?: ContentSearchMode;
        structuredQuery?: InternalQueryStructure | null; // The builder state
        caseSensitive?: boolean;
        modifiedAfter?: string;
        modifiedBefore?: string;
        minSizeBytes?: number;
        maxSizeBytes?: number;
        maxDepth?: number;
    };
}
// -----------------------------------------

// --- Electron API Definition ---

export interface IElectronAPI {
  invokeSearch: (params: SearchParams) => Promise<SearchResult>; // Params type updated
  showSaveDialog: () => Promise<string | undefined>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  copyToClipboard: (content: string) => Promise<boolean>;
  onSearchProgress: (callback: (data: ProgressData) => void) => () => void;
  getInitialLanguage: () => Promise<string>;
  setLanguagePreference: (lng: string) => Promise<void>;
  notifyLanguageChanged: (lng: string) => void;

  // --- NEW: History API ---
  addSearchHistoryEntry: (entry: SearchHistoryEntry) => Promise<void>;
  getSearchHistory: () => Promise<SearchHistoryEntry[]>;
  deleteSearchHistoryEntry: (entryId: string) => Promise<void>;
  clearSearchHistory: () => Promise<void>;
  // ------------------------
}

// --- Global Window Augmentation ---

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---
// Keep existing exports and add the new history entry type
export type { ProgressData, SearchResult, FileReadError, SearchParams, FolderExclusionMode, StructuredItem };
