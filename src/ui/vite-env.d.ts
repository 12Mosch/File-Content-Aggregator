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

// Define structure for specific file read errors
interface FileReadError {
  filePath: string;
  reason: string; // Translation key
  detail?: string; // Original error message
}

// Define the structure of the search result object returned by the backend
interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[]; // User-facing path access errors
  fileReadErrors: FileReadError[]; // Structured file read errors
}

// Define the structure of the parameters passed TO the backend search function
interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string; // New: Optional content search term
  caseSensitive?: boolean; // New: Optional case sensitivity flag
}

// --- Electron API Definition ---

// Define the interface for the API exposed on the window object via contextBridge
export interface IElectronAPI {
  // --- Search Function ---
  // Updated to accept the new SearchParams interface
  invokeSearch: (params: SearchParams) => Promise<SearchResult>;

  // --- File Operations ---
  showSaveDialog: () => Promise<string | undefined>;
  writeFile: (filePath: string, content: string) => Promise<boolean>;
  copyToClipboard: (content: string) => Promise<boolean>;

  // --- Event Listeners ---
  onSearchProgress: (callback: (data: ProgressData) => void) => () => void; // Returns unsubscribe function

  // --- i18n Methods ---
  getInitialLanguage: () => Promise<string>; // Returns detected/stored language code (e.g., 'en')
  setLanguagePreference: (lng: string) => Promise<void>; // Saves user choice
  notifyLanguageChanged: (lng: string) => void; // Informs main process of change (fire-and-forget)
  // Optional: onLanguageChangeRequest: (callback: (lng: string) => void) => () => void;
}

// --- Global Window Augmentation ---

// Make the electronAPI available globally on the Window object for TypeScript
declare global {
  interface Window {
    electronAPI: IElectronAPI;
  }
}

// --- Exports ---

// Export types used by both UI and potentially preload/main if needed elsewhere
export type { ProgressData, SearchResult, FileReadError, SearchParams };
