// D:/Code/Electron/src/electron/fileSearchService.ts
import path from "path";
import fs from "fs/promises";
import picomatch from "picomatch";

// --- Import 'module' and create a require function ---
import module from 'node:module';
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load CJS modules ---
const fg = require("fast-glob") as typeof import("fast-glob");
const pLimitModule = require("p-limit");
const pLimit: typeof import("p-limit").default = pLimitModule.default || pLimitModule;

// --- Require jsep and import its types with a different alias ---
import type * as Jsep from 'jsep'; // Use alias 'Jsep' for types
const jsep = require('jsep') as typeof import('jsep');
// -------------------------------------------------------------

// --- Define ContentSearchMode directly in this file ---
// This avoids the cross-directory type resolution issue during main process compilation
type ContentSearchMode = "term" | "regex" | "boolean";
// -----------------------------------------------------

// --- Interfaces ---
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

// Updated SearchParams interface (uses the locally defined ContentSearchMode)
export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[]; // Contains Regex/Glob patterns
  excludeFolders: string[]; // Contains Glob patterns
  folderExclusionMode?: FolderExclusionMode; // Mode for folder exclusion
  contentSearchTerm?: string;
  contentSearchMode?: ContentSearchMode; // Uses local type
  caseSensitive?: boolean; // Used for 'term' mode and non-regex terms in 'boolean' mode
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

// Final search result structure
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
  // Match pattern like /content/flags
  // Ensure it starts and ends with / and has valid flags
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      // Create RegExp from matched parts
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e) {
      // Log error if RegExp creation fails (e.g., invalid pattern/flags)
      console.warn(`Invalid RegExp literal format: ${pattern}`, e);
      return null;
    }
  }
  // Return null if the string doesn't match the /pattern/flags format
  return null;
}

/**
 * Safely creates a RegExp object from a pattern string and flags.
 * Returns null if the pattern is invalid.
 */
function createSafeRegex(pattern: string, flags: string): RegExp | null {
    try {
        // Basic check for empty pattern which is invalid
        if (!pattern) {
            console.warn(`Attempted to create RegExp with empty pattern.`);
            return null;
        }
        return new RegExp(pattern, flags);
    } catch (e) {
        console.warn(`Invalid RegExp pattern created: "${pattern}" with flags "${flags}"`, e);
        return null; // Indicate regex creation failed
    }
}

// --- Type Guard for Jsep Expression ---
/**
 * Checks if a node is a valid Jsep Expression object.
 * @param node The node to check.
 * @returns True if the node is a valid Jsep Expression, false otherwise.
 */
function isJsepExpression(node: any): node is Jsep.Expression {
    return node !== null && typeof node === 'object' && typeof node.type === 'string';
}
// ------------------------------------

// --- Boolean AST Evaluation Function with Regex Support ---
/**
 * Recursively evaluates a boolean expression AST against file content.
 * Expected Syntax:
 *   - Operators: AND, OR, NOT (case-insensitive during parsing)
 *   - Grouping: Parentheses ()
 *   - Terms:
 *     - Unquoted words (Identifiers): Treated as simple strings (e.g., error) OR regex literals (e.g., /error\d+/i).
 *     - Quoted strings (Literals): Treated as simple strings (e.g., "read error") OR regex literals (e.g., "/timeout \d+ms/").
 *   - Case Sensitivity: Controlled by the `caseSensitive` parameter for *simple string* term matching.
 *     Regex terms rely on their own flags (e.g., /pattern/i).
 *
 * @param node The current AST node from jsep (or unknown).
 * @param content The file content string.
 * @param caseSensitive Whether *simple string* comparisons should be case-sensitive.
 * @returns True if the expression evaluates to true for the content, false otherwise.
 */
function evaluateBooleanAst(node: Jsep.Expression | unknown, content: string, caseSensitive: boolean): boolean {
    if (!isJsepExpression(node)) {
        console.warn("evaluateBooleanAst called with non-Expression node:", node);
        return false;
    }

    try {
        switch (node.type) {
            case 'LogicalExpression':
                if (!isJsepExpression(node.left) || !isJsepExpression(node.right)) {
                    console.warn("LogicalExpression node missing valid left or right child", node);
                    return false;
                }
                const leftResult = evaluateBooleanAst(node.left, content, caseSensitive);
                if (node.operator === 'OR' && leftResult) return true;
                if (node.operator === 'AND' && !leftResult) return false;
                const rightResult = evaluateBooleanAst(node.right, content, caseSensitive);
                return node.operator === 'OR' ? (leftResult || rightResult) : (leftResult && rightResult);

            case 'UnaryExpression':
                if (!isJsepExpression(node.argument)) {
                     console.warn("UnaryExpression node missing valid argument", node);
                     return false;
                }
                if (node.operator === 'NOT') {
                    return !evaluateBooleanAst(node.argument, content, caseSensitive);
                }
                console.warn(`Unsupported unary operator: ${node.operator}`);
                return false;

            case 'Identifier': // Unquoted terms (could be simple string or regex literal)
                const termIdentifier = node.name;
                if (typeof termIdentifier !== 'string') {
                    console.warn("Identifier node name is not a string", node);
                    return false;
                }
                // --- Check if it's a regex literal ---
                const regexFromIdentifier = parseRegexLiteral(termIdentifier);
                if (regexFromIdentifier) {
                    // Use regex test
                    return regexFromIdentifier.test(content);
                } else {
                    // Treat as simple string, apply case sensitivity
                    return caseSensitive
                        ? content.includes(termIdentifier)
                        : content.toLowerCase().includes(termIdentifier.toLowerCase());
                }
                // ------------------------------------

            case 'Literal': // Quoted terms (could be simple string or regex literal)
                if (typeof node.value === 'string') {
                    const termLiteral = node.value;
                    // --- Check if it's a regex literal ---
                    const regexFromLiteral = parseRegexLiteral(termLiteral);
                    if (regexFromLiteral) {
                        // Use regex test
                        return regexFromLiteral.test(content);
                    } else {
                        // Treat as simple string, apply case sensitivity
                        return caseSensitive
                            ? content.includes(termLiteral)
                            : content.toLowerCase().includes(termLiteral.toLowerCase());
                    }
                    // ------------------------------------
                }
                if (typeof node.value === 'boolean') {
                    return node.value;
                }
                console.warn(`Unsupported literal type: ${typeof node.value}`);
                return false;

            default:
                console.warn(`Unsupported AST node type: ${node.type}`);
                return false;
        }
    } catch (evalError) {
        console.error("Error during boolean AST evaluation:", evalError, "Node:", node);
        return false; // Return false on evaluation error
    }
}
// ----------------------------------------------------


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
    contentSearchMode = 'term', // Uses local type default
    caseSensitive = false, // Applies to 'term' mode and non-regex terms in 'boolean' mode
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
  if (typeof pLimit !== 'function') {
      console.error("pLimit was not loaded correctly. Type:", typeof pLimit, "Value:", pLimit);
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
    await Promise.all(searchPaths.map(async (searchPath) => {
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
              const errorMsg = `Search path is not a directory: ${searchPath}`;
              console.warn(errorMsg); pathErrors.push(errorMsg);
              progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}` });
              return;
          }
      } catch (statError: any) {
          let errorMsg = `Error accessing search path: ${searchPath}`; let reason = "Access Error";
          if (statError.code === 'ENOENT') { reason = "Path Not Found"; errorMsg = `Search path not found: ${searchPath}`; }
          else if (statError.code === 'EACCES' || statError.code === 'EPERM') { reason = "Permission Denied"; errorMsg = `Permission denied for search path: ${searchPath}`; }
          else { errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`; }
          console.warn(`Path Error (${reason}): ${errorMsg}`, statError); pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message });
          return;
      }
      const found = await fg(includePatterns, {
        cwd: normalizedPath, absolute: true, onlyFiles: true, dot: true,
        stats: false, suppressErrors: true, deep: globDepth,
      });
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
  // ---------------------------------------------

  // --- 2. File Exclusion Filter ---
  if (excludeFiles && excludeFiles.length > 0 && filesToProcess.length > 0) {
    progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded file patterns...` });
    filesToProcess = filesToProcess.filter((filePath) => {
      const filename = path.basename(filePath);
      const isExcluded = excludeFiles.some((pattern) => {
        const regex = parseRegexLiteral(pattern); // Use the same regex literal parser here
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });
      return !isExcluded;
    });
    currentTotal = filesToProcess.length;
    progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after file exclusion.` });
  }
  // -----------------------------

  // --- 3. Folder Exclusion Filter ---
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
  // -------------------------------

  // --- 4. Stat-Based Filtering (Parallelized) ---
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;

  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    const initialCountForStatFilter = filesToProcess.length;
    progressCallback({ processed: 0, total: initialCountForStatFilter, message: `Filtering ${initialCountForStatFilter} files by size/date (parallel)...` });
    const statCheckPromises = filesToProcess.map((filePath) =>
      limit(async () => {
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
          return passSizeCheck && passDateCheck ? filePath : null;
        } catch (statError: any) {
          console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError);
          return null;
        }
      })
    );
    const statResults = await Promise.all(statCheckPromises);
    filesToProcess = statResults.filter((result): result is string => result !== null);
    currentTotal = filesToProcess.length;
    progressCallback({ processed: initialCountForStatFilter, total: initialCountForStatFilter, message: `Filtered ${currentTotal} files after size/date check.` });
  }
  // ---------------------------------------------

  // --- 5. Read Content, Filter by Content, and Format Output (Parallelized) ---
  let filesProcessedCounter = 0;
  const totalFilesToProcess = filesToProcess.length;

  // --- Prepare search function based on mode ---
  let contentMatcher: ((content: string) => boolean) | null = null;
  let parseOrRegexError = false; // Flag for regex or boolean parse errors

  if (contentSearchTerm) {
    switch (contentSearchMode) { // Uses local type
      case 'regex':
        // Determine flags based on case sensitivity.
        const flags = caseSensitive ? '' : 'i';
        const regex = createSafeRegex(contentSearchTerm, flags);
        if (regex) {
          contentMatcher = (content) => regex.test(content);
        } else {
          // Handle invalid regex input from user
          parseOrRegexError = true;
          const errorMsg = `Invalid regular expression pattern: ${contentSearchTerm}`;
          pathErrors.push(errorMsg); // Add to general errors shown to user
          progressCallback({ processed: 0, total: 0, message: errorMsg, error: "Invalid Regex" });
          // Return early as search cannot proceed correctly
          return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
        }
        break;

      case 'boolean':
        try {
          // --- Configure jsep custom operators (do this once if possible, but here is safe) ---
          if (jsep.binary_ops['||']) jsep.removeBinaryOp('||');
          if (jsep.binary_ops['&&']) jsep.removeBinaryOp('&&');
          if (jsep.unary_ops['!']) jsep.removeUnaryOp('!');
          if (!jsep.binary_ops['AND']) jsep.addBinaryOp('AND', 1);
          if (!jsep.binary_ops['OR']) jsep.addBinaryOp('OR', 0);
          if (!jsep.unary_ops['NOT']) jsep.addUnaryOp('NOT');
          // ------------------------------------------------------------------------------------

          // --- Parse the boolean query ---
          const parsedAst = jsep(contentSearchTerm); // jsep should return Expression or throw
          console.log("Parsed Boolean AST:", JSON.stringify(parsedAst, null, 2));
          // -----------------------------

          // Create the matcher function that uses the evaluator
          // Pass the AST and the caseSensitive flag (for non-regex terms)
          contentMatcher = (content) => evaluateBooleanAst(parsedAst, content, caseSensitive);

        } catch (parseError: any) {
          parseOrRegexError = true;
          // --- Improved Error Message ---
          let errorDetail = parseError.message || 'Unknown parsing error';
          if (typeof parseError.index === 'number') {
              errorDetail += ` near character ${parseError.index + 1}`;
          }
          const errorMsg = `Invalid boolean query syntax: ${errorDetail}`;
          // ------------------------------
          pathErrors.push(errorMsg);
          progressCallback({ processed: 0, total: 0, message: errorMsg, error: "Invalid Boolean Query" });
          // Return early as search cannot proceed correctly
          return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors };
        }
        break;

      case 'term':
      default: // Default to simple term search
        if (caseSensitive) {
          contentMatcher = (content) => content.includes(contentSearchTerm);
        } else {
          const searchTermLower = contentSearchTerm.toLowerCase();
          contentMatcher = (content) => content.toLowerCase().includes(searchTermLower);
        }
        break;
    }
  }
  // -------------------------------------------

  if (totalFilesToProcess > 0 && !parseOrRegexError) { // Check flag
    progressCallback({ processed: 0, total: totalFilesToProcess, message: `Processing ${totalFilesToProcess} files (parallel)...` });
  } else if (pathErrors.length === 0 && !parseOrRegexError) {
    progressCallback({ processed: 0, total: 0, message: `No files to process after filtering.` });
  }

  // --- Parallel Processing Loop ---
  // Only proceed if regex/boolean parsing didn't fail (or if no content search is active)
  if (!parseOrRegexError) {
      const processingPromises = filesToProcess.map((file) =>
        limit(async () => {
          const currentFileName = path.basename(file);
          const displayFilePath = file.replace(/\\/g, "/");
          let structuredItemResult: StructuredItem | null = null;
          let outputLineResult: string | null = null;
          let fileReadErrorResult: FileReadError | null = null;
          let errorKeyForProgress: string | undefined = undefined;

          try {
            const content = await fs.readFile(file, { encoding: "utf8" });

            // --- Use the prepared contentMatcher function ---
            // If contentMatcher is null (no search term), contentMatches is true
            let contentMatches = !contentMatcher || contentMatcher(content);
            // ---------------------------------------------

            if (contentMatches) {
              outputLineResult = `${displayFilePath}\n\n${content}\n`;
              structuredItemResult = { filePath: displayFilePath, content: content, readError: undefined };
            } else {
              // Still include in structured results if content didn't match, but without content
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
            errorKeyForProgress = reasonKey;
          } finally {
            filesProcessedCounter++;
            progressCallback({
              processed: filesProcessedCounter,
              total: totalFilesToProcess,
              currentFile: currentFileName,
              message: errorKeyForProgress ? `Error: ${currentFileName}` : `Processed: ${currentFileName}`,
              error: errorKeyForProgress,
            });
          }
          return { structuredItemResult, outputLineResult, fileReadErrorResult };
        })
      );

      const resultsFromPromises = await Promise.all(processingPromises);
      // --- Aggregate results ---
      resultsFromPromises.forEach(result => {
        if (result.structuredItemResult) { structuredItems.push(result.structuredItemResult); }
        if (result.outputLineResult) { outputLines.push(result.outputLineResult); }
        if (result.fileReadErrorResult) { fileReadErrors.push(result.fileReadErrorResult); }
      });
      // -----------------------
  } // End if (!parseOrRegexError)
  // -----------------------------

  progressCallback({
    processed: filesProcessedCounter,
    total: totalFilesToProcess,
    message: `Finished processing ${filesProcessedCounter} files.`,
  });

  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    structuredItems: structuredItems,
    filesFound: initialFileCount,
    filesProcessed: filesProcessedCounter,
    errorsEncountered: fileReadErrors.length,
    pathErrors: pathErrors, // Include potential parse/regex error message
    fileReadErrors: fileReadErrors,
  };
}
