import path from "path";
import fs from "fs/promises";
import fg from "fast-glob";

// --- Interfaces ---
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
}

export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
}

// New interface for structured file read errors
export interface FileReadError {
  filePath: string;
  reason: string; // Consistent reason string (e.g., "Permission Denied")
  detail?: string; // Optional: Original error message for logging/debugging
}

export interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[];
  fileReadErrors: FileReadError[]; // <-- New: Array for structured read errors
}

export type ProgressCallback = (data: ProgressData) => void;

// --- searchFiles Function ---
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
): Promise<SearchResult> {
  const { searchPaths, extensions, excludeFiles, excludeFolders } = params;
  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = []; // <-- Initialize read errors array

  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });

  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const ignoreFilePatterns = excludeFiles.map((f) => `**/${f}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    // --- Path Validation Loop --- (Handles path not found, not directory, permissions)
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          const errorMsg = `Search path is not a directory: ${searchPath}`;
          console.warn(errorMsg);
          pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
          continue;
        }
      } catch (statError: any) {
        let errorMsg = `Error accessing search path: ${searchPath}`;
        let reason = "Access Error";
        if (statError.code === 'ENOENT') {
            reason = "Path Not Found";
            errorMsg = `Search path not found: ${searchPath}`;
        } else if (statError.code === 'EACCES' || statError.code === 'EPERM') {
            reason = "Permission Denied";
            errorMsg = `Permission denied for search path: ${searchPath}`;
        } else {
            errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`;
        }
        console.warn(errorMsg, statError);
        pathErrors.push(errorMsg); // Keep original message for path errors list
        progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
        continue;
      }

      // --- Fast-Glob Search ---
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
    pathErrors.push(errorMsg);
    progressCallback({
      processed: 0, total: 0, message: errorMsg, error: error.message,
    });
    return { output: "", filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors }; // Include empty fileReadErrors
  }

  const initialFiles = Array.from(allFoundFiles);

  // --- Folder Exclusion Filter ---
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

  // --- Read Content and Format Output ---
  const outputLines: string[] = [];
  let filesProcessed = 0;
  // errorsEncountered count is now derived from fileReadErrors.length
  const totalFilesToProcess = filesToProcess.length;

  if (totalFilesToProcess > 0) {
      progressCallback({
        processed: 0, total: totalFilesToProcess,
        message: `Processing ${totalFilesToProcess} files...`,
      });
  } else if (pathErrors.length === 0) {
       progressCallback({
        processed: 0, total: 0,
        message: `No files to process after filtering.`,
      });
  }

  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    const displayFilePath = file.replace(/\\/g, "/"); // Use forward slashes for display

    progressCallback({
      processed: filesProcessed, total: totalFilesToProcess,
      currentFile: currentFileName, message: `Reading: ${currentFileName}`,
    });

    try {
      const content = await fs.readFile(file, { encoding: "utf8" });
      outputLines.push(`${displayFilePath}\n\n${content}\n`); // Add content if successful
    } catch (error: any) {
      console.error(`Error reading file '${file}':`, error);
      let reason = "Read Error"; // Default reason
      if (error.code === 'EPERM' || error.code === 'EACCES') {
          reason = "Permission Denied";
      } else if (error.code === 'ENOENT') {
          reason = "File Not Found During Read"; // Should be rare if fast-glob worked
      } else if (error.code === 'EISDIR') {
          reason = "Path is Directory"; // Also rare
      }
      // Add structured error to the list
      fileReadErrors.push({
          filePath: displayFilePath,
          reason: reason,
          detail: error.message || String(error) // Store original message if needed
      });
      // Optionally, add a placeholder to the main output, or nothing
      // outputLines.push(`${displayFilePath}\n\nERROR: ${reason} (See details below)\n`);
      progressCallback({
        processed: filesProcessed + 1, total: totalFilesToProcess,
        currentFile: currentFileName, message: `Error reading: ${currentFileName}`,
        error: `Failed to read ${currentFileName}: ${reason}`, // Use simplified reason here
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
    errorsEncountered: fileReadErrors.length, // Count based on structured errors
    pathErrors: pathErrors,
    fileReadErrors: fileReadErrors, // Return structured errors
  };
}
