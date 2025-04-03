/// <reference types="vite/client" />

// --- Data Structures ---

interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
}

// New interface for structured result items (mirrored from backend)
interface StructuredItem {
  filePath: string;
  content: string | null; // Content if read successfully, null otherwise
  readError?: string; // Translation key for the error, if any
}

// Updated SearchResult interface (mirrored from backend)
interface SearchResult {
  output: string; // Combined text output
  structuredItems: StructuredItem[]; // New: Array of structured items
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
}

type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// SearchParams interface remains the same as the previous step
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

// --- Electron API Definition ---

export interface IElectronAPI {
  // invokeSearch now returns the updated SearchResult type
  invokeSearch: (params: SearchParams) => Promise<SearchResult>;

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

export type { ProgressData, SearchResult, FileReadError, SearchParams, FolderExclusionMode, StructuredItem }; // Export new type
