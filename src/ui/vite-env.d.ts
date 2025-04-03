// D:/Code/Electron/src/ui/vite-env.d.ts

/// <reference types="vite/client" />

// --- Data Structures ---

interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
}

interface FileReadError {
  filePath: string;
  reason: string; // Translation key
  detail?: string; // Original error message
}

interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
}

// Updated SearchParams to include optional size numbers (in bytes)
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number; // New: Optional min size in bytes
  maxSizeBytes?: number; // New: Optional max size in bytes
}

// --- Electron API Definition ---

export interface IElectronAPI {
  // Updated to accept the new SearchParams interface with size fields
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

export type { ProgressData, SearchResult, FileReadError, SearchParams };
