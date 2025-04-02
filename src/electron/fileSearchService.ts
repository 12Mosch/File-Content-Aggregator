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
  currentFile?: string; // Optional: name of the file currently being processed
  message?: string; // General status message
  error?: string; // Error message for a specific file
}

/**
 * Interface for the result returned by the search service.
 */
export interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number; // Total files initially found before folder exclusion
  errorsEncountered: number;
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

  // --- 1. Initial File Discovery using fast-glob ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories..." });

  // Create glob patterns for included extensions (e.g., ['**/*.txt', '**/*.log'])
  // fast-glob requires forward slashes, even on Windows
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`); // Remove leading dot if present

  // Prepare ignore patterns for files (passed directly to fast-glob)
  // Ensure patterns match anywhere in the path by default with **
  const ignoreFilePatterns = excludeFiles.map((f) => `**/${f}`);

  // Use a Set to avoid duplicates if search paths overlap or contain each other
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0; // Keep track before converting Set to Array

  try {
    // Revised approach: Call fg for each search path.
    for (const searchPath of searchPaths) { // Corrected for...of loop syntax
      // Normalize path separators for consistency with fast-glob
      const normalizedPath = searchPath.replace(/\\/g, "/");
      // Check if the path exists and is a directory before searching
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          console.warn(`Search path is not a directory, skipping: ${searchPath}`);
          progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
          continue; // Skip to the next search path
        }
      } catch (statError: any) {
        // Handle errors like path not found
        console.warn(`Error accessing search path, skipping: ${searchPath} - ${statError.message}`);
        progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
        continue; // Skip to the next search path
      }


      const found = await fg(includePatterns, {
        cwd: normalizedPath, // Search within this directory
        ignore: ignoreFilePatterns, // Exclude specific file patterns
        absolute: true, // Get absolute paths relative to CWD, which should make them absolute system paths
        onlyFiles: true, // We only want files
        dot: true, // Include hidden files/folders if not excluded later
        stats: false, // Don't need file stats here
        suppressErrors: true, // Suppress EPERM errors etc. (we handle read errors later)
        // Removed invalid 'const' property
      });
      // Add found files to the Set
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/"))); // Normalize slashes on add
    }

    initialFileCount = allFoundFiles.size; // Get count from Set size

    progressCallback({
      processed: 0, // Corrected object syntax
      total: initialFileCount, // Corrected object syntax
      message: `Found ${initialFileCount} potential files. Filtering...`,
    });

  } catch (error: any) {
    // This catch block might be less likely to trigger now with suppressErrors: true
    // and individual path checks, but kept for safety.
    console.error("Error during fast-glob search loop:", error);
    progressCallback({
      processed: 0,
      total: 0,
      message: `Error during file search: ${error.message}`,
      error: error.message,
    });
    // Return an empty result on major search failure
    return { output: "", filesFound: 0, filesProcessed: 0, errorsEncountered: 1 };
  }

  // Convert Set to Array for filtering and processing
  const initialFiles = Array.from(allFoundFiles);

  // --- 2. Folder Exclusion Filter ---
  let filesToProcess: string[] = initialFiles;
  if (excludeFolders && excludeFolders.length > 0 && initialFiles.length > 0) {
    filesToProcess = initialFiles.filter((filePath) => {
      // Get the directory path containing the file. Ensure forward slashes.
      const dirPath = path.dirname(filePath).replace(/\\/g, "/");
      // Check if any part of the directory path contains an excluded folder name (case-insensitive)
      const isExcluded = excludeFolders.some((exFolder) => {
        // Normalize exclude folder string for comparison
        const normalizedExFolder = exFolder.replace(/\\/g, "/").toLowerCase();
        if (!normalizedExFolder) return false; // Skip empty exclusion strings
        // Simple substring check (case-insensitive) - mirrors PowerShell -like "*folder*"
        // Add slashes to avoid partial matches like 'log' matching 'catalog' more reliably.
        // Check if the normalized directory path includes the folder name surrounded by slashes,
        // or at the beginning/end of a segment.
        const dirPathLower = dirPath.toLowerCase();
        return dirPathLower.includes(`/${normalizedExFolder}/`) || // Match `/folder/`
               dirPathLower.endsWith(`/${normalizedExFolder}`) ||   // Match `/folder` at end
               dirPathLower.startsWith(`${normalizedExFolder}/`);  // Match `folder/` at start (less likely for full paths but safe)
      });
      return !isExcluded; // Keep the file if it's NOT excluded
    });
    progressCallback({
      processed: 0, // Reset processed count for the next stage
      total: filesToProcess.length,
      message: `Filtered down to ${filesToProcess.length} files after folder exclusion.`,
    });
  }

  // --- 3. Read Content and Format Output ---
  const outputLines: string[] = [];
  let filesProcessed = 0;
  let errorsEncountered = 0;
  const totalFilesToProcess = filesToProcess.length;

  // Initial progress before loop starts
  if (totalFilesToProcess > 0) {
      progressCallback({
        processed: 0,
        total: totalFilesToProcess,
        message: `Processing ${totalFilesToProcess} files...`,
      });
  } else {
       progressCallback({
        processed: 0,
        total: 0,
        message: `No files to process after filtering.`,
      });
  }


  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    // Report progress before attempting to read
    progressCallback({
      processed: filesProcessed, // Files processed so far
      total: totalFilesToProcess,
      currentFile: currentFileName, // Show which file is being processed
      message: `Reading: ${currentFileName}`,
    });

    try {
      // Read the entire file content as a single string (UTF-8 by default)
      const content = await fs.readFile(file, { encoding: "utf8" });
      // Format: Full Path, blank line, content, blank line (for separation)
      outputLines.push(`${file}\n\n${content}\n`);
    } catch (error: any) {
      console.error(`Error reading file '${file}':`, error);
      errorsEncountered++;
      // Add an error message to the output for this file
      outputLines.push(
        `${file}\n\nERROR: Could not read file. ${error.message || error}\n`,
      );
      // Send specific error progress update *after* incrementing processed count
      progressCallback({
        processed: filesProcessed + 1, // Increment processed count even on error
        total: totalFilesToProcess,
        currentFile: currentFileName,
        message: `Error reading: ${currentFileName}`,
        error: `Failed to read ${currentFileName}: ${error.message || error}`,
      });
    } finally {
      // Increment processed count *unless* an error occurred and we already reported it
      // This ensures the final count is accurate. Let's simplify: always increment here,
      // but report progress *before* the read attempt.
      filesProcessed++;
    }
  }

  // Final progress update after the loop finishes
  progressCallback({
    processed: filesProcessed,
    total: totalFilesToProcess,
    message: `Finished processing ${filesProcessed} files.`,
  });

  // Join all collected lines with an additional newline for separation between entries
  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    filesFound: initialFileCount, // Use the count from before filtering
    filesProcessed: filesProcessed, // Files actually attempted to read
    errorsEncountered: errorsEncountered,
  };
}
