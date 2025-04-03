// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises";
import fg from "fast-glob";
import picomatch from "picomatch"; // Ensure picomatch is imported

// --- Interfaces ---
// Define allowed folder exclusion modes
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Updated SearchParams interface
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[]; // Contains Regex/Glob patterns
  excludeFolders: string[]; // Contains Glob patterns
  folderExclusionMode?: FolderExclusionMode; // New: Mode for folder exclusion
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

// Other interfaces (ProgressData, FileReadError, SearchResult) remain the same
export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
}
export interface FileReadError {
  filePath: string;
  reason: string;
  detail?: string;
}
export interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
}
export type ProgressCallback = (data: ProgressData) => void;

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
    // Default folderExclusionMode to 'contains' if not provided
    folderExclusionMode = 'contains',
    contentSearchTerm,
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes,
    maxSizeBytes,
  } = params;

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];

  // --- 1. Initial File Discovery (fast-glob) ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
              const errorMsg = `Search path is not a directory: ${searchPath}`;
              console.warn(errorMsg); pathErrors.push(errorMsg);
              progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
              continue;
          }
      } catch (statError: any) {
          let errorMsg = `Error accessing search path: ${searchPath}`; let reason = "Access Error";
          if (statError.code === 'ENOENT') { reason = "Path Not Found"; errorMsg = `Search path not found: ${searchPath}`; }
          else if (statError.code === 'EACCES' || statError.code === 'EPERM') { reason = "Permission Denied"; errorMsg = `Permission denied for search path: ${searchPath}`; }
          else { errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`; }
          console.warn(`Path Error (${reason}): ${errorMsg}`, statError); pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
          continue;
      }
      const found = await fg(includePatterns, {
        cwd: normalizedPath,
        // ignore: is handled manually later
        absolute: true,
        onlyFiles: true,
        dot: true, // Important for matching hidden files/folders if needed by patterns
        stats: false,
        suppressErrors: true,
      });
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }
    initialFileCount = allFoundFiles.size;
    progressCallback({ processed: 0, total: initialFileCount, message: `Found ${initialFileCount} potential files. Filtering...` });
  } catch (error: any) {
    console.error("Error during file discovery loop:", error);
    const errorMsg = `Unexpected error during file search: ${error.message}`; pathErrors.push(errorMsg);
    progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message });
    return { output: "", filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
  }

  const initialFiles = Array.from(allFoundFiles);
  let filesToProcess: string[] = initialFiles;
  let currentTotal = initialFileCount;

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

    // Pre-compile matchers based on the selected mode
    const folderMatchers = excludeFolders.map(pattern => {
        const picoOptions = { dot: true, nocase: true }; // Case-insensitive matching for paths
        let matchPattern = pattern;

        // Adjust pattern based on mode for picomatch usage
        switch (folderExclusionMode) {
            case 'startsWith':
                matchPattern = pattern + '*'; // Append wildcard for startsWith
                break;
            case 'endsWith':
                matchPattern = '*' + pattern; // Prepend wildcard for endsWith
                break;
            case 'contains':
                // Add wildcards only if pattern doesn't already contain them
                // This prevents '**pattern**' if user enters '*pattern*'
                if (!pattern.includes('*') && !pattern.includes('?')) {
                   matchPattern = '*' + pattern + '*';
                }
                break;
            case 'exact':
            default:
                // Use the pattern as is for exact matching
                break;
        }
        // Return the compiled matcher function
        return picomatch(matchPattern, picoOptions);
    });


    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath);
      // Split path into segments, handling both Windows and Unix separators
      const segments = dirPath.split(/[\\/]/).filter(Boolean);

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
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;

  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by size/date...` });
    const statFilteredFiles: string[] = [];
    let processedForStatFilter = 0;

    for (const filePath of filesToProcess) {
      try {
        const stats = await fs.stat(filePath);
        const fileSize = stats.size;
        const mtime = stats.mtime;

        // Perform Size Check
        const passSizeCheck =
          (!hasSizeFilter) ||
          (
            (minSizeBytes === undefined || fileSize >= minSizeBytes) &&
            (maxSizeBytes === undefined || fileSize <= maxSizeBytes)
          );

        // Perform Date Check
        const passDateCheck =
          (!hasDateFilter) ||
          (
            (!afterDate || mtime.getTime() >= afterDate.getTime()) &&
            (!beforeDate || mtime.getTime() <= beforeDate.getTime())
          );

        // Keep the file only if it passes both checks (if applicable)
        if (passSizeCheck && passDateCheck) {
          statFilteredFiles.push(filePath);
        }
      } catch (statError: any) {
        console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError);
        // Optionally add to a specific error list if needed
      }
      processedForStatFilter++;
      // Optional: More granular progress for stat filtering
    }
    filesToProcess = statFilteredFiles;
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after size/date check.` });
  }

  // --- 5. Read Content, Filter by Content, and Format Output ---
  const outputLines: string[] = [];
  let filesProcessed = 0;
  const totalFilesToProcess = filesToProcess.length;
  const searchTermLower = contentSearchTerm && !caseSensitive ? contentSearchTerm.toLowerCase() : undefined;

  if (totalFilesToProcess > 0) {
    progressCallback({ processed: 0, total: totalFilesToProcess, message: `Processing ${totalFilesToProcess} files...` });
  } else if (pathErrors.length === 0) {
    progressCallback({ processed: 0, total: 0, message: `No files to process after filtering.` });
  }

  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    const displayFilePath = file.replace(/\\/g, "/");
    progressCallback({ processed: filesProcessed, total: totalFilesToProcess, currentFile: currentFileName, message: `Reading: ${currentFileName}` });
    try {
      const content = await fs.readFile(file, { encoding: "utf8" });
      let contentMatches = true;
      if (contentSearchTerm) {
        if (caseSensitive) { contentMatches = content.includes(contentSearchTerm); }
        else { contentMatches = content.toLowerCase().includes(searchTermLower!); }
      }
      if (contentMatches) {
        outputLines.push(`${displayFilePath}\n\n${content}\n`);
      }
    } catch (error: any) {
      console.error(`Error reading file '${file}':`, error);
      let reasonKey = "readError";
      if (error.code === 'EPERM' || error.code === 'EACCES') { reasonKey = "readPermissionDenied"; }
      else if (error.code === 'ENOENT') { reasonKey = "fileNotFoundDuringRead"; }
      else if (error.code === 'EISDIR') { reasonKey = "pathIsDir"; }
      fileReadErrors.push({ filePath: displayFilePath, reason: reasonKey, detail: error.message || String(error) });
      progressCallback({ processed: filesProcessed + 1, total: totalFilesToProcess, currentFile: currentFileName, message: `Error reading: ${currentFileName}`, error: reasonKey });
    } finally {
      filesProcessed++;
    }
  }

  progressCallback({ processed: filesProcessed, total: totalFilesToProcess, message: `Finished processing ${filesProcessed} files.` });
  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    filesFound: initialFileCount, // Total files found before *any* filtering
    filesProcessed: filesProcessed, // Files actually attempted to read (after all filters)
    errorsEncountered: fileReadErrors.length,
    pathErrors: pathErrors,
    fileReadErrors: fileReadErrors,
  };
}
