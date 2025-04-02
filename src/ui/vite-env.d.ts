/// <reference types="vite/client" />

// Define structure for ProgressData expected from backend
interface ProgressData {
    processed: number;
    total: number;
    currentFile?: string;
    message?: string;
    error?: string;
  }
  
  // Define structure for SearchResult expected from backend
  interface SearchResult {
    output: string;
    filesProcessed: number;
    filesFound: number;
    errorsEncountered: number;
    pathErrors: string[]; // <-- Add pathErrors array
  }
  
  // Define the interface for the API exposed on the window object
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
  
  // Extend the Window interface
  declare global {
    interface Window {
      electronAPI: IElectronAPI;
    }
  }
  
  // Export interfaces if needed elsewhere (optional)
  export type { ProgressData, SearchResult };
  