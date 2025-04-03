// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises"; // Use promises API for async operations
import fg from "fast-glob"; // Import fast-glob

// --- Interfaces ---

// Updated SearchParams interface to include size filtering options
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number; // Optional: Min size in bytes
  maxSizeBytes?: number; // Optional: Max size in bytes
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

// --- Helper Functions for Date Parsing ---
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

// --- Main Search Function ---

/**
 * Searches files based on criteria, including optional size, date, and content filters.
 *
 * @param params - The search parameters.
 * @param progressCallback - Function for reporting progress.
 * @returns A promise resolving to the search results.
 */
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
): Promise<SearchResult> {
  // Destructure all parameters
  const {
    searchPaths,
    extensions,
    excludeFiles,
    excludeFolders,
    contentSearchTerm,
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes, // New: Size parameter
    maxSizeBytes, // New: Size parameter
  } = params;

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];

  // --- 1. Initial File Discovery (fast-glob) ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const ignoreFilePatterns = excludeFiles.map((f) => `**/${f}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    // (Error handling and globbing logic remains the same as before)
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
        const found = await fg(includePatterns, { cwd: normalizedPath, ignore: ignoreFilePatterns, absolute: true, onlyFiles: true, dot: true, stats: false, suppressErrors: true });
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

  // --- 2. Folder Exclusion Filter ---
  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) {
    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath).replace(/\\/g, "/");
      const isExcluded = excludeFolders.some((exFolder) => {
        const normalizedExFolder = exFolder.replace(/\\/g, "/").toLowerCase();
        if (!normalizedExFolder) return false;
        const dirPathLower = dirPath.toLowerCase();
        return ( dirPathLower.includes(`/${normalizedExFolder}/`) || dirPathLower.endsWith(`/${normalizedExFolder}`) || dirPathLower.startsWith(`${normalizedExFolder}/`) );
      });
      return !isExcluded;
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after folder exclusion.` });
  }

  // --- 3. Stat-Based Filtering (Size and Date) ---
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
          (!hasSizeFilter) || // Skip check if no size filter applied
          (
            (minSizeBytes === undefined || fileSize >= minSizeBytes) &&
            (maxSizeBytes === undefined || fileSize <= maxSizeBytes)
          );

        // Perform Date Check
        const passDateCheck =
          (!hasDateFilter) || // Skip check if no date filter applied
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
        // Log specific stat errors if needed, maybe add to a separate error list?
        // fileReadErrors.push({ filePath, reason: 'statError', detail: statError.message });
      }
      processedForStatFilter++;
      // Optional: More granular progress for stat filtering
      // if (processedForStatFilter % 100 === 0) {
      //   progressCallback({ processed: processedForStatFilter, total: currentTotal, message: `Filtering by size/date: ${processedForStatFilter}/${currentTotal}` });
      // }
    }
    filesToProcess = statFilteredFiles; // Update the list with stat-filtered files
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after size/date check.` });
  }

  // --- 4. Read Content, Filter by Content, and Format Output ---
  const outputLines: string[] = [];
  let filesProcessed = 0;
  const totalFilesToProcess = filesToProcess.length; // Use the count *after* all filtering
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

      // Content Filtering Logic
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
