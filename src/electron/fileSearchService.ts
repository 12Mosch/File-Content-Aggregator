// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises"; // Use promises API for async operations
import fg from "fast-glob"; // Import fast-glob

// --- Interfaces ---

// Updated SearchParams interface to include content search options
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  contentSearchTerm?: string; // Optional: Term to search for within file content
  caseSensitive?: boolean; // Optional: Whether content search is case-sensitive (defaults to false)
}

export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string; // For file read errors or general search errors
}

// Interface for structured file read errors
export interface FileReadError {
  filePath: string;
  reason: string; // This will now hold the translation KEY (e.g., "readPermissionDenied")
  detail?: string; // Optional: Original error message for logging/debugging
}

// Interface for the result returned by the search service
export interface SearchResult {
  output: string;
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number; // Count of file read errors
  pathErrors: string[]; // Array to hold path access/validation errors
  fileReadErrors: FileReadError[]; // Array for structured read errors
}

// Callback function type for reporting progress
export type ProgressCallback = (data: ProgressData) => void;

/**
 * Recursively searches for files based on specified criteria, reads their content,
 * optionally filters by content, and formats the output.
 *
 * @param params - The search parameters, including optional content search terms.
 * @param progressCallback - Function to call for reporting progress updates.
 * @returns A promise resolving to an object containing the formatted output and summary.
 */
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
): Promise<SearchResult> {
  // Destructure all parameters, including the new ones
  const {
    searchPaths,
    extensions,
    excludeFiles,
    excludeFolders,
    contentSearchTerm, // New: Get the content search term
    caseSensitive = false, // New: Get case sensitivity, default to false
  } = params;

  const pathErrors: string[] = []; // Initialize array for path errors
  const fileReadErrors: FileReadError[] = []; // Initialize array for structured read errors

  // --- 1. Initial File Discovery using fast-glob ---
  progressCallback({
    processed: 0,
    total: 0,
    message: "Scanning directories...",
  });

  // Create glob patterns for included extensions
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  // Prepare ignore patterns for files
  const ignoreFilePatterns = excludeFiles.map((f) => `**/${f}`);
  // Use a Set to avoid duplicates if search paths overlap
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;

  try {
    // Loop through each provided search path
    for (const searchPath of searchPaths) {
      const normalizedPath = searchPath.replace(/\\/g, "/"); // Normalize slashes

      // Validate the search path before using fast-glob
      try {
        const stats = await fs.stat(searchPath);
        if (!stats.isDirectory()) {
          // Handle case where path is a file, not a directory
          const errorMsg = `Search path is not a directory: ${searchPath}`;
          console.warn(errorMsg);
          pathErrors.push(errorMsg); // Collect user-facing error message
          progressCallback({
            processed: 0,
            total: 0,
            message: `Skipping non-directory: ${searchPath}`,
          });
          continue; // Skip to the next search path
        }
      } catch (statError: any) {
        // Handle errors accessing the path (not found, permissions)
        let errorMsg = `Error accessing search path: ${searchPath}`;
        let reason = "Access Error"; // Keep track of reason for logging/internal use if needed
        if (statError.code === "ENOENT") {
          reason = "Path Not Found";
          errorMsg = `Search path not found: ${searchPath}`; // User-facing message
        } else if (statError.code === "EACCES" || statError.code === "EPERM") {
          reason = "Permission Denied";
          errorMsg = `Permission denied for search path: ${searchPath}`; // User-facing message
        } else {
          errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`;
        }
        console.warn(`Path Error (${reason}): ${errorMsg}`, statError); // Log technical details
        pathErrors.push(errorMsg); // Collect user-facing error message
        progressCallback({
          processed: 0,
          total: 0,
          message: `Cannot access path: ${searchPath}`,
          error: statError.message,
        });
        continue; // Skip to the next search path
      }

      // Perform the glob search within the validated directory
      const found = await fg(includePatterns, {
        cwd: normalizedPath, // Search within this directory
        ignore: ignoreFilePatterns, // Exclude specific file patterns
        absolute: true, // Get absolute paths
        onlyFiles: true, // We only want files
        dot: true, // Include hidden files/folders if not excluded later
        stats: false, // Don't need file stats here
        suppressErrors: true, // Suppress OS errors like EPERM during globbing
      });
      // Add found files to the Set, normalizing slashes
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }

    initialFileCount = allFoundFiles.size; // Get count from Set size
    progressCallback({
      processed: 0,
      total: initialFileCount,
      message: `Found ${initialFileCount} potential files. Filtering...`,
    });
  } catch (error: any) {
    // Catch unexpected errors during the search loop itself
    console.error("Error during file discovery loop:", error);
    const errorMsg = `Unexpected error during file search: ${error.message}`;
    pathErrors.push(errorMsg); // Add to path errors for user visibility
    progressCallback({
      processed: 0,
      total: 0,
      message: errorMsg,
      error: error.message,
    });
    // Return early on major search failure, including collected errors
    return {
      output: "",
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
    };
  }

  // Convert Set to Array for filtering and processing
  const initialFiles = Array.from(allFoundFiles);

  // --- 2. Folder Exclusion Filter ---
  let filesToProcess: string[] = initialFiles;
  if (excludeFolders && excludeFolders.length > 0 && initialFiles.length > 0) {
    filesToProcess = initialFiles.filter((filePath) => {
      const dirPath = path.dirname(filePath).replace(/\\/g, "/"); // Ensure forward slashes
      // Check if any part of the directory path contains an excluded folder name (case-insensitive substring match)
      const isExcluded = excludeFolders.some((exFolder) => {
        const normalizedExFolder = exFolder.replace(/\\/g, "/").toLowerCase();
        if (!normalizedExFolder) return false; // Skip empty exclusion strings
        const dirPathLower = dirPath.toLowerCase();
        // Check for matches surrounded by slashes or at start/end
        return (
          dirPathLower.includes(`/${normalizedExFolder}/`) ||
          dirPathLower.endsWith(`/${normalizedExFolder}`) ||
          dirPathLower.startsWith(`${normalizedExFolder}/`)
        );
      });
      return !isExcluded; // Keep the file if it's NOT excluded
    });
    progressCallback({
      processed: 0, // Reset processed count for the next stage
      total: filesToProcess.length,
      message: `Filtered down to ${filesToProcess.length} files after folder exclusion.`,
    });
  }

  // --- 3. Read Content, Filter by Content (New), and Format Output ---
  const outputLines: string[] = []; // Holds the successfully read and filtered file content + paths
  let filesProcessed = 0;
  const totalFilesToProcess = filesToProcess.length;

  // Prepare content search term for efficient checking (lowercase if needed)
  const searchTermLower =
    contentSearchTerm && !caseSensitive
      ? contentSearchTerm.toLowerCase()
      : undefined;

  // Initial progress message before starting the read loop
  if (totalFilesToProcess > 0) {
    progressCallback({
      processed: 0,
      total: totalFilesToProcess,
      message: `Processing ${totalFilesToProcess} files...`,
    });
  } else if (pathErrors.length === 0) {
    // Only show if no path errors occurred
    progressCallback({
      processed: 0,
      total: 0,
      message: `No files to process after filtering.`,
    });
  }

  // Loop through files remaining after filtering
  for (const file of filesToProcess) {
    const currentFileName = path.basename(file);
    const displayFilePath = file.replace(/\\/g, "/"); // Use forward slashes for display/error reporting

    // Report progress before attempting to read
    progressCallback({
      processed: filesProcessed,
      total: totalFilesToProcess,
      currentFile: currentFileName,
      message: `Reading: ${currentFileName}`,
    });

    try {
      // Attempt to read the file content
      const content = await fs.readFile(file, { encoding: "utf8" });

      // --- New: Content Filtering Logic ---
      let contentMatches = true; // Assume match if no search term provided
      if (contentSearchTerm) {
        if (caseSensitive) {
          // Case-sensitive search
          contentMatches = content.includes(contentSearchTerm);
        } else {
          // Case-insensitive search (use pre-calculated lowercase term)
          contentMatches = content.toLowerCase().includes(searchTermLower!);
        }
      }
      // ------------------------------------

      // Add successfully read content to the output lines ONLY if content matches (or no search term)
      if (contentMatches) {
        outputLines.push(`${displayFilePath}\n\n${content}\n`);
      }
    } catch (error: any) {
      // Handle errors during file reading
      console.error(`Error reading file '${file}':`, error); // Log the technical error

      // --- Assign REASON KEY based on error code ---
      let reasonKey = "readError"; // Default translation key
      if (error.code === "EPERM" || error.code === "EACCES") {
        reasonKey = "readPermissionDenied";
      } else if (error.code === "ENOENT") {
        reasonKey = "fileNotFoundDuringRead";
      } else if (error.code === "EISDIR") {
        reasonKey = "pathIsDir";
      }
      // ---------------------------------------------

      // Add structured error to the list
      fileReadErrors.push({
        filePath: displayFilePath,
        reason: reasonKey,
        detail: error.message || String(error),
      });

      // Update progress bar, indicating an error occurred for this file
      progressCallback({
        processed: filesProcessed + 1, // Increment processed count even on error
        total: totalFilesToProcess,
        currentFile: currentFileName,
        message: `Error reading: ${currentFileName}`,
        error: reasonKey,
      });
    } finally {
      // Increment processed count regardless of success or failure
      filesProcessed++;
    }
  }

  // Final progress update after the loop finishes
  progressCallback({
    processed: filesProcessed,
    total: totalFilesToProcess,
    message: `Finished processing ${filesProcessed} files.`,
  });

  // Join all successfully read and filtered file contents
  const finalOutput = outputLines.join("\n");

  // Return the final result object
  return {
    output: finalOutput,
    filesFound: initialFileCount, // Total files found before folder exclusion
    filesProcessed: filesProcessed, // Files actually attempted to read
    errorsEncountered: fileReadErrors.length, // Count based on structured errors collected
    pathErrors: pathErrors, // Array of user-facing path access error messages
    fileReadErrors: fileReadErrors, // Array of structured file read errors (with reason keys)
  };
}
