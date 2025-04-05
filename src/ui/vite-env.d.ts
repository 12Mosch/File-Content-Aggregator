/// <reference types="vite/client" />

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

// --- NEW: Define Content Search Mode ---
export type ContentSearchMode = "term" | "regex" | "boolean";
// --------------------------------------

// Updated SearchParams interface
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string;
  // --- NEW: Add content search mode ---
  contentSearchMode?: ContentSearchMode;
  // ------------------------------------
  caseSensitive?: boolean; // Still used for 'term' mode and potentially 'regex' flags
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

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
}

// --- Global Window Augmentation ---

declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---

export type { ProgressData, SearchResult, FileReadError, SearchParams, FolderExclusionMode, StructuredItem };
