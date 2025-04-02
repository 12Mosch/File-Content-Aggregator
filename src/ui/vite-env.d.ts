/// <reference types="vite/client" />

// Import types from the backend if they are shared or define them here
// Assuming ProgressData and SearchResult might be useful in the frontend too
// If not already exported from fileSearchService.ts, ensure they are.
// For simplicity, we might redefine simplified versions or import them if structure allows.

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
  }
  
  // Define the interface for the API exposed on the window object
  export interface IElectronAPI {
    invokeSearch: (params: {
      searchPaths: string[];
      extensions: string[];
      excludeFiles: string[];
      excludeFolders: string[];
    }) => Promise<SearchResult>; // Use the defined SearchResult type
  
    showSaveDialog: () => Promise<string | undefined>;
  
    writeFile: (filePath: string, content: string) => Promise<boolean>;
  
    copyToClipboard: (content: string) => Promise<boolean>;
  
    // Define the listener function signature
    onSearchProgress: (
      callback: (data: ProgressData) => void, // Use the defined ProgressData type
    ) => () => void; // The listener returns an unsubscribe function
  }
  
  // Extend the Window interface
  declare global {
    interface Window {
      electronAPI: IElectronAPI;
    }
  }
  