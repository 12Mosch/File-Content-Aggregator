/**
 * Common types used across the application
 */

/**
 * Represents a structured item in the search results
 */
export interface StructuredItem {
  filePath: string;
  matched: boolean;
  content?: string;
  readError?: string;
  size?: number;
  mtime?: number;
  isDirectory?: boolean;
  children?: StructuredItem[];
}

/**
 * Represents a file read error
 */
export interface FileReadError {
  filePath: string;
  error: string;
  reason?: string;
  detail?: string;
}

/**
 * Represents the search result
 */
export interface SearchResult {
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
  wasCancelled?: boolean;
}

/**
 * Represents the search parameters
 */
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: "contains" | "exact" | "startsWith" | "endsWith";
  contentSearchTerm?: string;
  contentSearchMode?: "term" | "regex" | "boolean";
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
  wholeWordMatching?: boolean;
}

/**
 * Represents progress data during search
 */
export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
  status?: "searching" | "cancelling" | "cancelled" | "completed" | "error";
}

/**
 * Callback type for progress updates
 */
export type ProgressCallback = (data: ProgressData) => void;

/**
 * Type for cancellation check function
 */
export type CancellationChecker = () => boolean;
