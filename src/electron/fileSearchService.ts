// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises";
import picomatch from "picomatch";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load CJS modules ---
const fg = require("fast-glob") as typeof import("fast-glob");

// --- Import p-limit for concurrency control ---
// Adjust how p-limit is required. Often, the function is the 'default' export.
const pLimitModule = require("p-limit");
// Access the 'default' property if it exists, otherwise assume the module itself is the function
const pLimit: typeof import("p-limit").default = pLimitModule.default || pLimitModule;


// --- Interfaces ---
// Define allowed folder exclusion modes
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// SearchParams interface including all options
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[]; // Contains Regex/Glob patterns
  excludeFolders: string[]; // Contains Glob patterns
  folderExclusionMode?: FolderExclusionMode; // Mode for folder exclusion
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string; // Date string "YYYY-MM-DD"
  modifiedBefore?: string; // Date string "YYYY-MM-DD"
  minSizeBytes?: number; // Optional: Min size in bytes
  maxSizeBytes?: number; // Optional: Max size in bytes
  maxDepth?: number; // Optional: Max search depth
}

// Progress data structure
export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string; // Translation key for errors during progress
}

// Specific file read error structure
export interface FileReadError {
  filePath: string;
  reason: string; // Translation key
  detail?: string; // Original error message
}

// Structured result item for the tree view
export interface StructuredItem {
  filePath: string;
  content: string | null; // Content if read successfully, null otherwise
  readError?: string; // Translation key for the error, if any
}

// Final search result structure including both output formats
export interface SearchResult {
  output: string; // Combined text output
  structuredItems: StructuredItem[]; // Array of structured items
  filesProcessed: number; // Count of files attempted to read/process content
  filesFound: number; // Count of files found initially by glob
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[]; // User-facing path access errors
  fileReadErrors: FileReadError[]; // Detailed file read errors
}

// Callback type for progress updates
export type ProgressCallback = (data: ProgressData) => void;

// --- Concurrency Limit ---
// Set a reasonable limit for concurrent file operations (stat, read)
// Adjust based on testing and typical system resources
const FILE_OPERATION_CONCURRENCY_LIMIT = 20;

// --- Helper Functions ---

/**
 * Parses a "YYYY-MM-DD" string into a Date object representing the START of that day (00:00:00).
 * Returns null if the input is empty or invalid.
 */
function parseDateStartOfDay(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.warn(`Invalid date format for parsing: ${dateString}. Expected YYYY-MM-DD.`);
        return null;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        console.warn(`Invalid date value resulted from parsing: ${dateString}`);
        return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  } catch (e) {
    console.error(`Error parsing date string "${dateString}":`, e);
    return null;
  }
}

/**
 * Parses a "YYYY-MM-DD" string into a Date object representing the END of that day (23:59:59.999).
 * Returns null if the input is empty or invalid.
 */
function parseDateEndOfDay(dateString: string | undefined): Date | null {
  const date = parseDateStartOfDay(dateString);
  if (date) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/**
 * Parses a string that might be a RegExp literal (/pattern/flags)
 * into a RegExp object. Returns null if not a valid RegExp literal.
 */
function parseRegexLiteral(pattern: string): RegExp | null {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e) {
      console.warn(`Invalid RegExp pattern: ${pattern}`, e);
      return null;
    }
  }
  return null;
}

// --- Main Search Function ---

export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
): Promise<SearchResult> {
  const {
    searchPaths,
    extensions,
    excludeFiles,
    excludeFolders,
    folderExclusionMode = 'contains',
    contentSearchTerm,
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes,
    maxSizeBytes,
    maxDepth,
  } = params;

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];
  const structuredItems: StructuredItem[] = [];
  const outputLines: string[] = [];

  // --- Initialize p-limit for controlling concurrency ---
  // Ensure pLimit is correctly assigned before use
  if (typeof pLimit !== 'function') {
      console.error("pLimit was not loaded correctly. Type:", typeof pLimit, "Value:", pLimit);
      // Handle the error appropriately, maybe return an error result
      pathErrors.push("Internal error: Concurrency limiter failed to load.");
      return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
  }
  const limit = pLimit(FILE_OPERATION_CONCURRENCY_LIMIT);

  // --- 1. Initial File Discovery (fast-glob) ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;
  const globDepth = (maxDepth && maxDepth > 0) ? maxDepth : Infinity;
  console.log(`Using glob depth: ${globDepth}`);

  try {
    // Use Promise.all to run glob searches for multiple paths concurrently
    await Promise.all(searchPaths.map(async (searchPath) => {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
              const errorMsg = `Search path is not a directory: ${searchPath}`;
              console.warn(errorMsg); pathErrors.push(errorMsg);
              progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
              return; // Skip this path
          }
      } catch (statError: any) {
          let errorMsg = `Error accessing search path: ${searchPath}`; let reason = "Access Error";
          if (statError.code === 'ENOENT') { reason = "Path Not Found"; errorMsg = `Search path not found: ${searchPath}`; }
          else if (statError.code === 'EACCES' || statError.code === 'EPERM') { reason = "Permission Denied"; errorMsg = `Permission denied for search path: ${searchPath}`; }
          else { errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`; }
          console.warn(`Path Error (${reason}): ${errorMsg}`, statError); pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
          return; // Skip this path
      }

      // Perform the glob search
      const found = await fg(includePatterns, {
        cwd: normalizedPath,
        absolute: true,
        onlyFiles: true,
        dot: true,
        stats: false,
        suppressErrors: true,
        deep: globDepth,
      });
      // Add found files to the Set (thread-safe addition)
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }));

    initialFileCount = allFoundFiles.size;
    progressCallback({ processed: 0, total: initialFileCount, message: `Found ${initialFileCount} potential files (depth limit: ${globDepth === Infinity ? 'none' : globDepth}). Filtering...` });
  } catch (error: any) {
    console.error("Error during file discovery:", error);
    const errorMsg = `Unexpected error during file search: ${error.message}`; pathErrors.push(errorMsg);
    progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message });
    return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
  }

  const initialFiles = Array.from(allFoundFiles);
  let filesToProcess: string[] = initialFiles;
  let currentTotal = initialFileCount;

  // --- 2. File Exclusion Filter (Regex/Glob on Basename) ---
  // This filter is synchronous and fast, no parallelization needed here.
  if (excludeFiles && excludeFiles.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded file patterns...` });
    filesToProcess = filesToProcess.filter((filePath) => {
      const filename = path.basename(filePath);
      const isExcluded = excludeFiles.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });
      return !isExcluded;
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after file exclusion.` });
  }

  // --- 3. Folder Exclusion Filter (Precise Mode Matching with Picomatch) ---
  // This filter is also synchronous and relatively fast.
  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded folder patterns (${folderExclusionMode})...` });
    const picoOptions = { dot: true, nocase: true };
    const folderMatchers = excludeFolders.map(pattern => {
        let matchPattern = pattern;
        switch (folderExclusionMode) {
            case 'startsWith': matchPattern = pattern + '*'; break;
            case 'endsWith': matchPattern = '*' + pattern; break;
            case 'contains': if (!pattern.includes('*') && !pattern.includes('?')) matchPattern = '*' + pattern + '*'; break;
            case 'exact': default: break;
        }
        return picomatch(matchPattern, picoOptions);
    });

    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath);
      const segments = dirPath.split(/[\\/]/).filter(Boolean);
      const isExcluded = folderMatchers.some(isMatch => segments.some(segment => isMatch(segment)));
      return !isExcluded;
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after folder exclusion.` });
  }

  // --- 4. Stat-Based Filtering (Size and Date) - PARALLELIZED ---
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;

  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    const initialCountForStatFilter = filesToProcess.length;
    progressCallback({ processed: 0, total: initialCountForStatFilter, message: `Filtering ${initialCountForStatFilter} files by size/date (parallel)...` });

    // Map each file path to a promise that performs the stat check
    const statCheckPromises = filesToProcess.map((filePath) =>
      limit(async () => { // Use p-limit to control concurrency
        try {
          const stats = await fs.stat(filePath);
          const fileSize = stats.size;
          const mtime = stats.mtime;

          const passSizeCheck = !hasSizeFilter || (
            (minSizeBytes === undefined || fileSize >= minSizeBytes) &&
            (maxSizeBytes === undefined || fileSize <= maxSizeBytes)
          );

          const passDateCheck = !hasDateFilter || (
            (!afterDate || mtime.getTime() >= afterDate.getTime()) &&
            (!beforeDate || mtime.getTime() <= beforeDate.getTime())
          );

          // Return the filePath if it passes, otherwise null
          return passSizeCheck && passDateCheck ? filePath : null;
        } catch (statError: any) {
          console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError);
          // Return null if stat fails, effectively filtering it out
          return null;
        }
      })
    );

    // Wait for all stat checks to complete
    const statResults = await Promise.all(statCheckPromises);

    // Filter out the null results (files that failed the check or errored)
    filesToProcess = statResults.filter((result): result is string => result !== null);

    currentTotal = filesToProcess.length; // Update total count after filtering
    progressCallback({ processed: initialCountForStatFilter, total: initialCountForStatFilter, message: `Filtered ${currentTotal} files after size/date check.` });
  }

  // --- 5. Read Content, Filter by Content, and Format Output - PARALLELIZED ---
  let filesProcessedCounter = 0; // Use a separate counter for progress reporting
  const totalFilesToProcess = filesToProcess.length;
  const searchTermLower = contentSearchTerm && !caseSensitive ? contentSearchTerm.toLowerCase() : undefined;

  if (totalFilesToProcess > 0) {
    progressCallback({ processed: 0, total: totalFilesToProcess, message: `Processing ${totalFilesToProcess} files (parallel)...` });
  } else if (pathErrors.length === 0) {
    progressCallback({ processed: 0, total: 0, message: `No files to process after filtering.` });
  }

  // Map each file path to a promise that reads, filters, and prepares results
  const processingPromises = filesToProcess.map((file) =>
    limit(async () => { // Use p-limit for concurrency
      const currentFileName = path.basename(file);
      const displayFilePath = file.replace(/\\/g, "/");
      let structuredItemResult: StructuredItem | null = null;
      let outputLineResult: string | null = null;
      let fileReadErrorResult: FileReadError | null = null;
      let errorKeyForProgress: string | undefined = undefined;

      try {
        const content = await fs.readFile(file, { encoding: "utf8" });
        let contentMatches = true;
        if (contentSearchTerm) {
          if (caseSensitive) {
            contentMatches = content.includes(contentSearchTerm);
          } else {
            contentMatches = content.toLowerCase().includes(searchTermLower!);
          }
        }

        if (contentMatches) {
          outputLineResult = `${displayFilePath}\n\n${content}\n`;
          structuredItemResult = { filePath: displayFilePath, content: content, readError: undefined };
        } else {
          structuredItemResult = { filePath: displayFilePath, content: null, readError: undefined };
        }
      } catch (error: any) {
        console.error(`Error reading file '${file}':`, error);
        let reasonKey = "readError";
        if (error.code === 'EPERM' || error.code === 'EACCES') { reasonKey = "readPermissionDenied"; }
        else if (error.code === 'ENOENT') { reasonKey = "fileNotFoundDuringRead"; }
        else if (error.code === 'EISDIR') { reasonKey = "pathIsDir"; }

        structuredItemResult = { filePath: displayFilePath, content: null, readError: reasonKey };
        fileReadErrorResult = { filePath: displayFilePath, reason: reasonKey, detail: error.message || String(error) };
        errorKeyForProgress = reasonKey; // Store error key for progress update
      } finally {
        // --- Progress Update within the loop ---
        // Increment counter safely
        filesProcessedCounter++;
        // Send progress update for each processed file
        progressCallback({
          processed: filesProcessedCounter,
          total: totalFilesToProcess,
          currentFile: currentFileName,
          message: errorKeyForProgress ? `Error: ${currentFileName}` : `Processed: ${currentFileName}`,
          error: errorKeyForProgress, // Send translation key if error occurred
        });
        // -----------------------------------------
      }
      // Return results for this file
      return { structuredItemResult, outputLineResult, fileReadErrorResult };
    })
  );

  // Wait for all file processing promises to settle
  const resultsFromPromises = await Promise.all(processingPromises);

  // --- Aggregate results after all promises are done ---
  resultsFromPromises.forEach(result => {
    if (result.structuredItemResult) {
      structuredItems.push(result.structuredItemResult);
    }
    if (result.outputLineResult) {
      outputLines.push(result.outputLineResult);
    }
    if (result.fileReadErrorResult) {
      fileReadErrors.push(result.fileReadErrorResult);
    }
  });
  // ----------------------------------------------------

  // Final progress update after the loop finishes
  progressCallback({
    processed: filesProcessedCounter, // Use the final counter value
    total: totalFilesToProcess,
    message: `Finished processing ${filesProcessedCounter} files.`,
  });

  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    structuredItems: structuredItems,
    filesFound: initialFileCount,
    // Use the counter which accurately reflects attempts within the parallel loop
    filesProcessed: filesProcessedCounter,
    errorsEncountered: fileReadErrors.length,
    pathErrors: pathErrors,
    fileReadErrors: fileReadErrors,
  };
}
