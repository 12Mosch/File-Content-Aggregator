// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises";
import fg from "fast-glob";
import picomatch from "picomatch"; // Import picomatch

// --- Interfaces (SearchParams structure remains the same) ---
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[]; // Contains Regex/Glob patterns
  excludeFolders: string[]; // Contains Regex/Glob patterns
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
}

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
// Date parsing helpers (remain the same)
function parseDateStartOfDay(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { return null; }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) { return null; }
    date.setHours(0, 0, 0, 0);
    return date;
  } catch (e) { console.error(`Error parsing date string "${dateString}":`, e); return null; }
}
function parseDateEndOfDay(dateString: string | undefined): Date | null {
  const date = parseDateStartOfDay(dateString);
  if (date) { date.setHours(23, 59, 59, 999); }
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
    excludeFiles, // Array of patterns
    excludeFolders, // Array of patterns
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
  // NOTE: We REMOVE the 'ignore' option here, as we'll handle file exclusions manually later.
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try { /* Path validation logic... */ }
      catch (statError: any) { /* Path error handling... */ continue; }

      const found = await fg(includePatterns, {
        cwd: normalizedPath,
        // ignore: ignoreFilePatterns, // REMOVED - Handled later
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

  // --- 2. File Exclusion Filter (New: Regex/Glob on Basename) ---
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

  // --- 3. Folder Exclusion Filter (New: Regex/Glob on Segments) ---
  // NOTE: This replaces the previous substring-based folder exclusion.
  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded folder patterns...` });
    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath);
      // Split path into segments, handling both Windows and Unix separators
      const segments = dirPath.split(/[\\/]/).filter(Boolean); // Filter out empty strings from leading/trailing slashes

      // Check if ANY directory segment matches ANY exclusion pattern
      const isExcluded = excludeFolders.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        return segments.some((segment) => {
          if (regex) {
            // Regex Match on segment
            return regex.test(segment);
          } else {
            // Glob Match on segment
            return picomatch.isMatch(segment, pattern, { dot: true });
          }
        });
      });
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

        const passSizeCheck = (!hasSizeFilter) || ((minSizeBytes === undefined || fileSize >= minSizeBytes) && (maxSizeBytes === undefined || fileSize <= maxSizeBytes));
        const passDateCheck = (!hasDateFilter) || ((!afterDate || mtime.getTime() >= afterDate.getTime()) && (!beforeDate || mtime.getTime() <= beforeDate.getTime()));

        if (passSizeCheck && passDateCheck) {
          statFilteredFiles.push(filePath);
        }
      } catch (statError: any) {
        console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError);
      }
      processedForStatFilter++;
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
    filesFound: initialFileCount,
    filesProcessed: filesProcessed,
    errorsEncountered: fileReadErrors.length,
    pathErrors: pathErrors,
    fileReadErrors: fileReadErrors,
  };
}
