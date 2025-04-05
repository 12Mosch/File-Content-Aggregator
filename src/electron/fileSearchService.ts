// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises";
// Remove the direct import of fast-glob
// import fg from "fast-glob";
import picomatch from "picomatch";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load fast-glob ---
// Add a type assertion to inform TypeScript about the module's shape
const fg = require("fast-glob") as typeof import("fast-glob");

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

// --- Helper Functions ---

/**
 * Parses a "YYYY-MM-DD" string into a Date object representing the START of that day (00:00:00).
 * Returns null if the input is empty or invalid.
 */
function parseDateStartOfDay(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  try {
    // Basic format check
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        console.warn(`Invalid date format for parsing: ${dateString}. Expected YYYY-MM-DD.`);
        return null;
    }
    const date = new Date(dateString);
    // Check if the resulting Date object is valid
    if (isNaN(date.getTime())) {
        console.warn(`Invalid date value resulted from parsing: ${dateString}`);
        return null;
    }
    // Set time to the beginning of the day in the local timezone
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
  const date = parseDateStartOfDay(dateString); // Reuse start of day logic
  if (date) {
    // Set time to the end of the day in the local timezone
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

/**
 * Parses a string that might be a RegExp literal (/pattern/flags)
 * into a RegExp object. Returns null if not a valid RegExp literal.
 */
function parseRegexLiteral(pattern: string): RegExp | null {
  // Match pattern like /content/flags
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      // Create RegExp from matched parts
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e) {
      // Log error if RegExp creation fails (e.g., invalid pattern/flags)
      console.warn(`Invalid RegExp pattern: ${pattern}`, e);
      return null;
    }
  }
  // Return null if the string doesn't match the /pattern/flags format
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
    folderExclusionMode = 'contains', // Default folder exclusion mode
    contentSearchTerm,
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes,
    maxSizeBytes,
    maxDepth, // Max search depth
  } = params;

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];
  const structuredItems: StructuredItem[] = []; // Initialize structured items array
  const outputLines: string[] = []; // Initialize text output array

  // --- 1. Initial File Discovery (fast-glob) ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  // Determine the depth for fast-glob based on user input
  const globDepth = (maxDepth && maxDepth > 0) ? maxDepth : Infinity;
  console.log(`Using glob depth: ${globDepth}`);

  try {
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      // Validate search path accessibility and type (must be a directory)
      try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
              const errorMsg = `Search path is not a directory: ${searchPath}`;
              console.warn(errorMsg); pathErrors.push(errorMsg);
              progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
              continue; // Skip this path
          }
      } catch (statError: any) {
          // Handle errors accessing the path (permissions, not found)
          let errorMsg = `Error accessing search path: ${searchPath}`; let reason = "Access Error";
          if (statError.code === 'ENOENT') { reason = "Path Not Found"; errorMsg = `Search path not found: ${searchPath}`; }
          else if (statError.code === 'EACCES' || statError.code === 'EPERM') { reason = "Permission Denied"; errorMsg = `Permission denied for search path: ${searchPath}`; }
          else { errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`; }
          console.warn(`Path Error (${reason}): ${errorMsg}`, statError); pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
          continue; // Skip this path
      }

      // Perform the glob search with the calculated depth
      // Use the required 'fg' variable here
      const found = await fg(includePatterns, {
        cwd: normalizedPath,
        // ignore: handled manually later using picomatch/regex
        absolute: true,
        onlyFiles: true,
        dot: true, // Include hidden files for potential matching by exclusion patterns
        stats: false, // We get stats later if needed for filtering
        suppressErrors: true, // Suppress OS errors during globbing (e.g., permission denied on subfolders)
        deep: globDepth, // Apply the depth limit
      });
      // Add found files to the Set, normalizing slashes
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }
    initialFileCount = allFoundFiles.size;
    progressCallback({ processed: 0, total: initialFileCount, message: `Found ${initialFileCount} potential files (depth limit: ${globDepth === Infinity ? 'none' : globDepth}). Filtering...` });
  } catch (error: any) {
    // Catch unexpected errors during the discovery loop
    console.error("Error during file discovery loop:", error);
    const errorMsg = `Unexpected error during file search: ${error.message}`; pathErrors.push(errorMsg);
    progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message });
    // Return empty results on major failure
    return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
  }

  // Convert Set to Array for filtering
  const initialFiles = Array.from(allFoundFiles);
  let filesToProcess: string[] = initialFiles;
  let currentTotal = initialFileCount; // Track count after each filter step

  // --- 2. File Exclusion Filter (Regex/Glob on Basename) ---
  if (excludeFiles && excludeFiles.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded file patterns...` });
    filesToProcess = filesToProcess.filter((filePath) => {
      const filename = path.basename(filePath);
      // Check if the filename matches ANY of the exclusion patterns
      const isExcluded = excludeFiles.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) {
          // Regex Match
          return regex.test(filename);
        } else {
          // Glob Match (using picomatch)
          // { dot: true } allows matching hidden files like .DS_Store if pattern allows
          return picomatch.isMatch(filename, pattern, { dot: true });
        }
      });
      return !isExcluded; // Keep the file if it's NOT excluded
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after file exclusion.` });
  }

  // --- 3. Folder Exclusion Filter (Precise Mode Matching with Picomatch) ---
  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded folder patterns (${folderExclusionMode})...` });

    // Pre-compile matchers based on the selected mode for efficiency
    const folderMatchers = excludeFolders.map(pattern => {
        const picoOptions = { dot: true, nocase: true }; // Case-insensitive matching for paths
        let matchPattern = pattern;

        // Adjust pattern based on mode for picomatch usage
        switch (folderExclusionMode) {
            case 'startsWith':
                matchPattern = pattern + '*'; // Append wildcard
                break;
            case 'endsWith':
                matchPattern = '*' + pattern; // Prepend wildcard
                break;
            case 'contains':
                // Add wildcards only if pattern doesn't already contain glob chars
                if (!pattern.includes('*') && !pattern.includes('?')) {
                   matchPattern = '*' + pattern + '*';
                }
                break;
            case 'exact':
            default:
                // Use the pattern as is
                break;
        }
        // Return the compiled matcher function from picomatch
        return picomatch(matchPattern, picoOptions);
    });

    // Filter the files based on directory segments matching the compiled matchers
    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath);
      // Split path into segments, handling both Windows and Unix separators
      const segments = dirPath.split(/[\\/]/).filter(Boolean); // Filter out empty strings

      // Check if ANY directory segment matches ANY of the compiled exclusion matchers
      const isExcluded = folderMatchers.some(isMatch =>
        segments.some(segment => isMatch(segment))
      );

      return !isExcluded; // Keep the file if no segment matched any pattern
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after folder exclusion.` });
  }


  // --- 4. Stat-Based Filtering (Size and Date) ---
  // Parse date strings only once
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  // Check if any stat-based filter is active
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;

  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by size/date...` });
    const statFilteredFiles: string[] = [];
    let processedForStatFilter = 0; // Counter for progress reporting within this loop

    for (const filePath of filesToProcess) {
      try {
        // Get file stats (size, modification time)
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const mtime = stats.mtime;

        // Perform Size Check (only if size filter is active)
        const passSizeCheck =
          (!hasSizeFilter) || // Always pass if no size filter
          (
            (minSizeBytes === undefined || fileSize >= minSizeBytes) &&
            (maxSizeBytes === undefined || fileSize <= maxSizeBytes)
          );

        // Perform Date Check (only if date filter is active)
        const passDateCheck =
          (!hasDateFilter) || // Always pass if no date filter
          (
            (!afterDate || mtime.getTime() >= afterDate.getTime()) &&
            (!beforeDate || mtime.getTime() <= beforeDate.getTime())
          );

        // Keep the file only if it passes both active checks
        if (passSizeCheck && passDateCheck) {
          statFilteredFiles.push(filePath);
        }
      } catch (statError: any) {
        // Handle errors during fs.stat (e.g., file deleted between steps)
        console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError);
        // Optionally add to a specific error list if needed for detailed reporting
      }
      processedForStatFilter++;
      // Optional: Update progress more frequently during this potentially long step
      // if (processedForStatFilter % 100 === 0) {
      //   progressCallback({ processed: processedForStatFilter, total: currentTotal, message: `Filtering by size/date: ${processedForStatFilter}/${currentTotal}` });
      // }
    }
    // Update the list of files to process with the filtered results
    filesToProcess = statFilteredFiles;
    currentTotal = filesToProcess.length; // Update total count
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after size/date check.` });
  }

  // --- 5. Read Content, Filter by Content, and Format Output ---
  let filesProcessed = 0; // Counter for files where content read is attempted
  const totalFilesToProcess = filesToProcess.length; // Final count of files to process
  // Pre-calculate lowercase search term if needed
  const searchTermLower = contentSearchTerm && !caseSensitive ? contentSearchTerm.toLowerCase() : undefined;

  // Initial progress message before the final processing loop
  if (totalFilesToProcess > 0) {
    progressCallback({ processed: 0, total: totalFilesToProcess, message: `Processing ${totalFilesToProcess} files...` });
  } else if (pathErrors.length === 0) { // Only show if no path errors occurred earlier
    progressCallback({ processed: 0, total: 0, message: `No files to process after filtering.` });
  }

  // Loop through the final list of files
  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    const displayFilePath = file.replace(/\\/g, "/"); // Use forward slashes for consistency
    // Report progress before attempting to read
    progressCallback({ processed: filesProcessed, total: totalFilesToProcess, currentFile: currentFileName, message: `Reading: ${currentFileName}` });

    try {
      // Attempt to read the file content
      const content = await fs.readFile(file, { encoding: "utf8" });

      // Apply Content Filter (if term is provided)
      let contentMatches = true;
      if (contentSearchTerm) {
        if (caseSensitive) {
          contentMatches = content.includes(contentSearchTerm);
        } else {
          // Use pre-calculated lowercase term for efficiency
          contentMatches = content.toLowerCase().includes(searchTermLower!);
        }
      }

      // If content matches (or no filter applied), add to outputs
      if (contentMatches) {
        outputLines.push(`${displayFilePath}\n\n${content}\n`);
        structuredItems.push({ filePath: displayFilePath, content: content, readError: undefined });
      }
      // If content doesn't match, we still add it to structuredItems but without content
      // This ensures the tree view shows all files that passed filters, even if content didn't match
      else {
         structuredItems.push({ filePath: displayFilePath, content: null, readError: undefined }); // Indicate content didn't match or wasn't read for this purpose
      }

    } catch (error: any) {
      // Handle errors during file reading (permissions, etc.)
      console.error(`Error reading file '${file}':`, error);
      // Determine error reason key for translation
      let reasonKey = "readError"; // Default key
      if (error.code === 'EPERM' || error.code === 'EACCES') { reasonKey = "readPermissionDenied"; }
      else if (error.code === 'ENOENT') { reasonKey = "fileNotFoundDuringRead"; }
      else if (error.code === 'EISDIR') { reasonKey = "pathIsDir"; }
      // Add more specific error code checks here if needed

      // Add error entry to structured items
      structuredItems.push({ filePath: displayFilePath, content: null, readError: reasonKey });
      // Add detailed error to separate list for summary/reporting
      fileReadErrors.push({ filePath: displayFilePath, reason: reasonKey, detail: error.message || String(error) });

      // Report error progress
      progressCallback({
        processed: filesProcessed + 1, // Increment processed count even on error
        total: totalFilesToProcess,
        currentFile: currentFileName,
        message: `Error reading: ${currentFileName}`,
        error: reasonKey, // Send translation key
      });
    } finally {
      // Increment processed count regardless of success or failure in reading/matching
      filesProcessed++;
    }
  }

  // Final progress update after the loop finishes
  progressCallback({
    processed: filesProcessed,
    total: totalFilesToProcess,
    message: `Finished processing ${filesProcessed} files.`,
  });

  // Join all successfully read and content-matched file contents for the text block view
  const finalOutput = outputLines.join("\n");

  // Return the final result object including both output formats and summaries
  return {
    output: finalOutput,
    structuredItems: structuredItems,
    filesFound: initialFileCount, // Total files found before *any* filtering
    filesProcessed: filesProcessed, // Files actually attempted to read/process content
    errorsEncountered: fileReadErrors.length, // Count based on detailed read errors collected
    pathErrors: pathErrors, // Array of user-facing path access error messages
    fileReadErrors: fileReadErrors, // Array of structured file read errors
  };
}
