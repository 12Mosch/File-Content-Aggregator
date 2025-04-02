import path from "path";
import fs from "fs/promises"; // Use promises API for async operations
import fg from "fast-glob"; // Import fast-glob

/**
 * Interface for search parameters received from the UI.
 */
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
}

/**
 * Interface for progress updates sent to the UI.
 */
export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string; // For file read errors or general search errors
}

/**
 * Interface for the result returned by the search service.
 */
export interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[]; // <-- New: Array to hold path access/validation errors
}

/**
 * Callback function type for reporting progress.
 */
export type ProgressCallback = (data: ProgressData) => void;

/**
 * Recursively searches for files based on specified criteria, reads their content,
 * and formats the output. Mimics the PowerShell script's logic.
 *
 * @param params - The search parameters.
 * @param progressCallback - Function to call for reporting progress updates.
 * @returns A promise resolving to an object containing the formatted output and summary.
 */
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
): Promise<SearchResult> {
  const { searchPaths, extensions, excludeFiles, excludeFolders } = params;
  const pathErrors: string[] = []; // <-- Initialize array for path errors

  // --- 1. Initial File Discovery using fast-glob ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });

  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const ignoreFilePatterns = excludeFiles.map((f) => `**/${f}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          const errorMsg = `Search path is not a directory: ${searchPath}`;
          console.warn(errorMsg);
          pathErrors.push(errorMsg); // <-- Collect error
          progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
          continue;
        }
      } catch (statError: any) {
        let errorMsg = `Error accessing search path: ${searchPath}`;
        if (statError.code === 'ENOENT') {
            errorMsg = `Search path not found: ${searchPath}`;
        } else if (statError.code === 'EACCES') {
            errorMsg = `Permission denied for search path: ${searchPath}`;
        } else {
            errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`;
        }
        console.warn(errorMsg, statError);
        pathErrors.push(errorMsg); // <-- Collect error
        progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
        continue;
      }

      const found = await fg(includePatterns, {
        cwd: normalizedPath, ignore: ignoreFilePatterns, absolute: true,
        onlyFiles: true, dot: true, stats: false, suppressErrors: true,
      });
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }

    initialFileCount = allFoundFiles.size;
    progressCallback({
      processed: 0, total: initialFileCount,
      message: `Found ${initialFileCount} potential files. Filtering...`,
    });

  } catch (error: any) {
    console.error("Error during fast-glob search loop:", error);
    const errorMsg = `Unexpected error during file search: ${error.message}`;
    pathErrors.push(errorMsg); // <-- Collect general search error
    progressCallback({
      processed: 0, total: 0, message: errorMsg, error: error.message,
    });
    // Return early on major search failure, including collected path errors
    return { output: "", filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors };
  }

  const initialFiles = Array.from(allFoundFiles);

  // --- 2. Folder Exclusion Filter ---
  let filesToProcess: string[] = initialFiles;
  if (excludeFolders && excludeFolders.length > 0 && initialFiles.length > 0) {
    filesToProcess = initialFiles.filter((filePath) => {
      const dirPath = path.dirname(filePath).replace(/\\/g, "/");
      const isExcluded = excludeFolders.some((exFolder) => {
        const normalizedExFolder = exFolder.replace(/\\/g, "/").toLowerCase();
        if (!normalizedExFolder) return false;
        const dirPathLower = dirPath.toLowerCase();
        return dirPathLower.includes(`/${normalizedExFolder}/`) ||
               dirPathLower.endsWith(`/${normalizedExFolder}`) ||
               dirPathLower.startsWith(`${normalizedExFolder}/`);
      });
      return !isExcluded;
    });
    progressCallback({
      processed: 0, total: filesToProcess.length,
      message: `Filtered down to ${filesToProcess.length} files after folder exclusion.`,
    });
  }

  // --- 3. Read Content and Format Output ---
  const outputLines: string[] = [];
  let filesProcessed = 0;
  let fileReadErrorsEncountered = 0; // Renamed for clarity
  const totalFilesToProcess = filesToProcess.length;

  if (totalFilesToProcess > 0) {
      progressCallback({
        processed: 0, total: totalFilesToProcess,
        message: `Processing ${totalFilesToProcess} files...`,
      });
  } else if (pathErrors.length === 0) { // Only show if no path errors occurred
       progressCallback({
        processed: 0, total: 0,
        message: `No files to process after filtering.`,
      });
  }

  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    progressCallback({
      processed: filesProcessed, total: totalFilesToProcess,
      currentFile: currentFileName, message: `Reading: ${currentFileName}`,
    });

    try {
      const content = await fs.readFile(file, { encoding: "utf8" });
      outputLines.push(`${file}\n\n${content}\n`);
    } catch (error: any) {
      console.error(`Error reading file '${file}':`, error);
      fileReadErrorsEncountered++;
      let readErrorMsg = `ERROR: Could not read file. ${error.message || error}`;
      if (error.code === 'EACCES') {
          readErrorMsg = `ERROR: Permission denied reading file.`;
      }
      outputLines.push(`${file}\n\n${readErrorMsg}\n`);
      progressCallback({
        processed: filesProcessed + 1, total: totalFilesToProcess,
        currentFile: currentFileName, message: `Error reading: ${currentFileName}`,
        error: `Failed to read ${currentFileName}: ${error.message || error}`,
      });
    } finally {
      filesProcessed++;
    }
  }

  progressCallback({
    processed: filesProcessed, total: totalFilesToProcess,
    message: `Finished processing ${filesProcessed} files.`,
  });

  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    filesFound: initialFileCount,
    filesProcessed: filesProcessed,
    errorsEncountered: fileReadErrorsEncountered, // Return count of read errors
    pathErrors: pathErrors, // <-- Return collected path errors
  };
}
