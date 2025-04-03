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

// Define allowed folder exclusion modes
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Updated SearchParams to include folder exclusion mode
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode; // New: Mode for folder exclusion
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

// --- Electron API Definition ---

export interface IElectronAPI {
  // Updated to accept the new SearchParams interface
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

export type { ProgressData, SearchResult, FileReadError, SearchParams, FolderExclusionMode };
