/// <reference types="vite/client" />

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
    reason: string;
    detail?: string;
  }
  
  interface SearchResult {
    output: string;
    filesProcessed: number;
    filesFound: number;
    errorsEncountered: number; // Count of file read errors
    pathErrors: string[];
    fileReadErrors: FileReadError[]; // <-- Add structured file read errors
  }
  
  export interface IElectronAPI {
    invokeSearch: (params: {
      searchPaths: string[];
      extensions: string[];
      excludeFiles: string[];
      excludeFolders: string[];
    }) => Promise<SearchResult>; // Uses updated SearchResult type
  
    showSaveDialog: () => Promise<string | undefined>;
    writeFile: (filePath: string, content: string) => Promise<boolean>;
    copyToClipboard: (content: string) => Promise<boolean>;
    onSearchProgress: (
      callback: (data: ProgressData) => void,
    ) => () => void;
  }
  
  declare global {
    interface Window {
      electronAPI: IElectronAPI;
    }
  }
  
  export type { ProgressData, SearchResult, FileReadError }; // Export new type
  