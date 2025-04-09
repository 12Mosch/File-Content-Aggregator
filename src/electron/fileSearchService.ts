import path from "path";
import fs from "fs/promises";
import picomatch from "picomatch";
import type { Options as FastGlobOptions } from "fast-glob";
import type PLimit from "p-limit";

// --- Import 'module' and create a require function ---
import module from "node:module";
const require = module.createRequire(import.meta.url);

// --- Use the created require function to load CJS modules ---
// Type the required function correctly
const fg: (
  patterns: string | readonly string[],
  options?: FastGlobOptions
) => Promise<string[]> = require("fast-glob");
const pLimitModule = require("p-limit") as {
  default?: typeof PLimit;
  __esModule?: boolean;
};
const pLimit: typeof PLimit =
  pLimitModule.default ?? (pLimitModule as typeof PLimit);

// --- Require jsep and import its types with a different alias ---
import type * as Jsep from "jsep";
const jsep = require("jsep") as typeof import("jsep");
// -------------------------------------------------------------

// --- Define ContentSearchMode directly in this file ---
type ContentSearchMode = "term" | "regex" | "boolean";
// -----------------------------------------------------

// --- Interfaces ---
type FolderExclusionMode = "contains" | "exact" | "startsWith" | "endsWith";

export interface SearchParams {
  searchPaths: string[];
  extensions: string[];
  excludeFiles: string[];
  excludeFolders: string[];
  folderExclusionMode?: FolderExclusionMode;
  contentSearchTerm?: string;
  contentSearchMode?: ContentSearchMode;
  caseSensitive?: boolean;
  modifiedAfter?: string;
  modifiedBefore?: string;
  minSizeBytes?: number;
  maxSizeBytes?: number;
  maxDepth?: number;
}

export interface ProgressData {
  processed: number;
  total: number;
  currentFile?: string;
  message?: string;
  error?: string;
  status?: "searching" | "cancelling" | "cancelled" | "completed" | "error";
}

export interface FileReadError {
  filePath: string;
  reason: string;
  detail?: string;
}

// Interface for path errors captured during globbing or initial checks
interface PathErrorDetail {
  searchPath: string; // The top-level path being searched when error occurred
  errorPath: string; // The specific path that caused the error (if available)
  message: string; // The error message
  code?: string; // Error code (e.g., 'EPERM', 'ENOENT')
}

// Modified: Removed 'content' property
export interface StructuredItem {
  filePath: string;
  matched: boolean; // Indicates if content matched (if query was present)
  readError?: string;
}

// Modified: Removed 'output' property
export interface SearchResult {
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[]; // User-facing, filtered error messages
  fileReadErrors: FileReadError[];
  wasCancelled?: boolean;
}

// Callback type for progress updates
export type ProgressCallback = (data: ProgressData) => void;
// Type for cancellation check function
export type CancellationChecker = () => boolean;

// --- Concurrency Limit ---
const FILE_OPERATION_CONCURRENCY_LIMIT = 20; // Consider lowering if OOM persists

// --- Helper Functions ---
function parseDateStartOfDay(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.warn(
        `Invalid date format for parsing: ${dateString}. Expected YYYY-MM-DD.`
      );
      return null;
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date value resulted from parsing: ${dateString}`);
      return null;
    }
    date.setHours(0, 0, 0, 0);
    return date;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`Error parsing date string "${dateString}":`, message);
    return null;
  }
}

function parseDateEndOfDay(dateString: string | undefined): Date | null {
  const date = parseDateStartOfDay(dateString);
  if (date) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

function parseRegexLiteral(pattern: string): RegExp | null {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`Invalid RegExp literal format: ${pattern}`, message);
      return null;
    }
  }
  return null;
}

function createSafeRegex(pattern: string, flags: string): RegExp | null {
  try {
    if (!pattern) {
      console.warn(`Attempted to create RegExp with empty pattern.`);
      return null;
    }
    return new RegExp(pattern, flags);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    console.warn(
      `Invalid RegExp pattern created: "${pattern}" with flags "${flags}"`,
      message
    );
    return null;
  }
}

// Type guards for JSEP nodes
function isJsepExpression(node: unknown): node is Jsep.Expression {
  return (
    node !== null &&
    typeof node === "object" &&
    "type" in node &&
    typeof node.type === "string"
  );
}
function isJsepIdentifier(node: unknown): node is Jsep.Identifier {
  return (
    isJsepExpression(node) &&
    node.type === "Identifier" &&
    "name" in node &&
    typeof node.name === "string"
  );
}
function isJsepLiteral(node: unknown): node is Jsep.Literal {
  return isJsepExpression(node) && node.type === "Literal" && "value" in node;
}
function isJsepCallExpression(node: unknown): node is Jsep.CallExpression {
  return (
    isJsepExpression(node) &&
    node.type === "CallExpression" &&
    "callee" in node &&
    "arguments" in node &&
    Array.isArray(node.arguments)
  );
}
function isJsepLogicalExpression(node: unknown): node is Jsep.Expression & {
  type: "LogicalExpression";
  operator: string;
  left: Jsep.Expression;
  right: Jsep.Expression;
} {
  return (
    isJsepExpression(node) &&
    node.type === "LogicalExpression" &&
    "left" in node &&
    "right" in node &&
    "operator" in node
  );
}
function isJsepUnaryExpression(node: unknown): node is Jsep.UnaryExpression {
  return (
    isJsepExpression(node) &&
    node.type === "UnaryExpression" &&
    "argument" in node &&
    "operator" in node
  );
}

/**
 * Finds all starting indices of a term (string or regex) within content.
 * @param content The string to search within.
 * @param term The string or RegExp to find.
 * @param caseSensitive Whether string search should be case-sensitive.
 * @param isRegex Whether the term is a RegExp object.
 * @returns An array of starting indices.
 */
function findTermIndices(
  content: string,
  term: string | RegExp,
  caseSensitive: boolean,
  isRegex: boolean
): number[] {
  const indices: number[] = [];
  if (!term) return indices;

  if (isRegex && term instanceof RegExp) {
    // Ensure the regex has the global flag for iterative searching
    const regex = new RegExp(
      term.source,
      term.flags.includes("g") ? term.flags : term.flags + "g"
    );
    let match;
    while ((match = regex.exec(content)) !== null) {
      indices.push(match.index);
      // Prevent infinite loops with zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  } else if (typeof term === "string") {
    const searchTerm = caseSensitive ? term : term.toLowerCase();
    const searchContent = caseSensitive ? content : content.toLowerCase();
    let i = -1;
    while ((i = searchContent.indexOf(searchTerm, i + 1)) !== -1) {
      indices.push(i);
    }
  }
  return indices;
}

// --- Word Boundary Cache and Helpers ---
interface WordBoundary {
  word: string;
  start: number;
  end: number;
}

/**
 * Extracts word boundaries (word, start index, end index) from content.
 * Uses a simple regex for word detection.
 * @param content The string to extract words from.
 * @returns An array of WordBoundary objects.
 */
function getWordBoundaries(content: string): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
  // Simple regex for alphanumeric words
  const wordRegex = /\b[a-zA-Z0-9]+\b/g;
  let match;
  while ((match = wordRegex.exec(content)) !== null) {
    boundaries.push({
      word: match[0],
      start: match.index,
      end: match.index + match[0].length - 1,
    });
  }
  return boundaries;
}

// Cache for word boundaries to avoid re-calculating for the same content
const wordBoundariesCache = new Map<string, WordBoundary[]>();

/**
 * Finds the word index corresponding to a character index in the content.
 * Uses the wordBoundariesCache for efficiency.
 * @param charIndex The character index to find the word index for.
 * @param content The string content.
 * @returns The word index (0-based) or -1 if not found within/near a word.
 */
function getWordIndexFromCharIndex(charIndex: number, content: string): number {
  let boundaries = wordBoundariesCache.get(content);
  if (!boundaries) {
    boundaries = getWordBoundaries(content);
    wordBoundariesCache.set(content, boundaries);
  }

  // Check if charIndex falls directly within a word boundary
  for (let i = 0; i < boundaries.length; i++) {
    if (charIndex >= boundaries[i].start && charIndex <= boundaries[i].end) {
      return i;
    }
  }

  // If not directly within, check if it's immediately after a word (separated by whitespace)
  // This helps associate indices in whitespace with the preceding word for distance calculation.
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (boundaries[i].end < charIndex) {
      // Check if the space between the word end and charIndex is only whitespace
      if (
        /^\s*$/.test(content.substring(boundaries[i].end + 1, charIndex + 1))
      ) {
        return i; // Associate with the preceding word
      }
      // If non-whitespace is found, stop searching backwards
      break;
    }
  }

  // If charIndex is before the first word or in non-whitespace before it
  return -1;
}

/**
 * Evaluates a JSEP Abstract Syntax Tree (AST) against file content.
 * Supports AND, OR, NOT logic, simple terms, regex literals, and NEAR proximity search.
 * @param node The AST node to evaluate.
 * @param content The file content string.
 * @param caseSensitive Global case sensitivity setting for simple terms (not regex).
 * @returns True if the AST node evaluates to true against the content, false otherwise.
 */
function evaluateBooleanAst(
  node: Jsep.Expression | unknown,
  content: string,
  caseSensitive: boolean
): boolean {
  if (!isJsepExpression(node)) {
    console.warn("evaluateBooleanAst called with non-Expression node:", node);
    return false;
  }

  try {
    switch (node.type) {
      case "LogicalExpression": {
        if (!isJsepLogicalExpression(node)) return false;
        if (!isJsepExpression(node.left) || !isJsepExpression(node.right)) {
          console.warn(
            "LogicalExpression node missing valid left or right child",
            node
          );
          return false;
        }
        // Evaluate left side first for potential short-circuiting
        const leftResult = evaluateBooleanAst(
          node.left,
          content,
          caseSensitive
        );
        // Short-circuit OR
        if (node.operator === "OR" && leftResult) return true;
        // Short-circuit AND
        if (node.operator === "AND" && !leftResult) return false;
        // Evaluate right side only if necessary
        const rightResult = evaluateBooleanAst(
          node.right,
          content,
          caseSensitive
        );
        return node.operator === "OR"
          ? leftResult || rightResult
          : leftResult && rightResult;
      }
      case "UnaryExpression": {
        if (!isJsepUnaryExpression(node)) return false;
        if (!isJsepExpression(node.argument)) {
          console.warn("UnaryExpression node missing valid argument", node);
          return false;
        }
        if (node.operator === "NOT") {
          return !evaluateBooleanAst(node.argument, content, caseSensitive);
        }
        console.warn(`Unsupported unary operator: ${String(node.operator)}`);
        return false;
      }
      case "Identifier": {
        // Treat identifiers as potential terms or regex literals
        if (!isJsepIdentifier(node)) return false;
        const termIdentifierStr = node.name;
        const regexFromIdentifier = parseRegexLiteral(termIdentifierStr);
        if (regexFromIdentifier) {
          return regexFromIdentifier.test(content);
        } else {
          // Simple term search
          return caseSensitive
            ? content.includes(termIdentifierStr)
            : content.toLowerCase().includes(termIdentifierStr.toLowerCase());
        }
      }
      case "Literal": {
        // Treat string literals as potential terms or regex literals
        if (!isJsepLiteral(node)) return false;
        if (typeof node.value === "string") {
          const termLiteralStr = node.value;
          const regexFromLiteral = parseRegexLiteral(termLiteralStr);
          if (regexFromLiteral) {
            return regexFromLiteral.test(content);
          } else {
            // Simple term search
            return caseSensitive
              ? content.includes(termLiteralStr)
              : content.toLowerCase().includes(termLiteralStr.toLowerCase());
          }
        }
        // Boolean literals can be part of the AST (though unlikely from user input)
        if (typeof node.value === "boolean") {
          return node.value;
        }
        // Numbers are only expected within NEAR
        if (typeof node.value === "number") {
          console.warn(
            `Numeric literal ${node.value} encountered outside NEAR function.`
          );
          return false;
        }
        console.warn(`Unsupported literal type: ${typeof node.value}`);
        return false;
      }
      case "CallExpression": {
        // Handle function calls, specifically NEAR
        if (!isJsepCallExpression(node)) {
          console.warn("Node is not a valid CallExpression:", node);
          return false;
        }
        if (!isJsepIdentifier(node.callee) || node.callee.name !== "NEAR") {
          console.warn(
            `Unsupported function call: ${isJsepIdentifier(node.callee) ? node.callee.name : "unknown"}`
          );
          return false;
        }
        if (node.arguments.length !== 3) {
          console.warn(
            `NEAR function requires exactly 3 arguments (term1, term2, distance), got ${node.arguments.length}`
          );
          return false;
        }

        const arg1Node = node.arguments[0];
        const arg2Node = node.arguments[1];
        const arg3Node = node.arguments[2];

        // Extract term1 (string or regex)
        let term1: string | RegExp | null = null;
        let term1IsRegex = false;
        if (isJsepLiteral(arg1Node) && typeof arg1Node.value === "string") {
          const valueStr = arg1Node.value;
          term1 = parseRegexLiteral(valueStr) || valueStr;
          term1IsRegex = term1 instanceof RegExp;
        } else if (isJsepIdentifier(arg1Node)) {
          // Allow identifiers as terms/regex too
          const nameStr = arg1Node.name;
          term1 = parseRegexLiteral(nameStr) || nameStr;
          term1IsRegex = term1 instanceof RegExp;
        }

        // Extract term2 (string or regex)
        let term2: string | RegExp | null = null;
        let term2IsRegex = false;
        if (isJsepLiteral(arg2Node) && typeof arg2Node.value === "string") {
          const valueStr = arg2Node.value;
          term2 = parseRegexLiteral(valueStr) || valueStr;
          term2IsRegex = term2 instanceof RegExp;
        } else if (isJsepIdentifier(arg2Node)) {
          const nameStr = arg2Node.name;
          term2 = parseRegexLiteral(nameStr) || nameStr;
          term2IsRegex = term2 instanceof RegExp;
        }

        // Extract distance (number)
        let distance: number | null = null;
        if (
          isJsepLiteral(arg3Node) &&
          typeof arg3Node.value === "number" &&
          arg3Node.value >= 0
        ) {
          distance = Math.floor(arg3Node.value); // Ensure integer distance
        }

        if (term1 === null || term2 === null || distance === null) {
          console.warn(
            `Invalid arguments for NEAR function. term1: ${String(term1)}, term2: ${String(term2)}, distance: ${String(distance)}`
          );
          return false;
        }

        // Find indices of both terms
        const indices1 = findTermIndices(
          content,
          term1,
          term1IsRegex ? false : caseSensitive, // Use global caseSensitive only for simple terms
          term1IsRegex
        );
        const indices2 = findTermIndices(
          content,
          term2,
          term2IsRegex ? false : caseSensitive,
          term2IsRegex
        );

        if (indices1.length === 0 || indices2.length === 0) {
          return false; // One of the terms not found
        }

        // Ensure word boundaries are cached/calculated
        if (!wordBoundariesCache.has(content)) {
          wordBoundariesCache.set(content, getWordBoundaries(content));
        }

        // Check word distance between all occurrences
        for (const index1 of indices1) {
          const wordIndex1 = getWordIndexFromCharIndex(index1, content);
          if (wordIndex1 === -1) continue; // Skip if index not associated with a word

          for (const index2 of indices2) {
            const wordIndex2 = getWordIndexFromCharIndex(index2, content);
            if (wordIndex2 === -1) continue;

            // Check if the absolute difference in word indices is within the distance
            if (Math.abs(wordIndex1 - wordIndex2) <= distance) {
              return true; // Found a pair within the specified distance
            }
          }
        }
        return false; // No pair found within the distance
      }
      default: {
        console.warn(`Unsupported AST node type: ${String(node.type)}`);
        return false;
      }
    }
  } catch (evalError: unknown) {
    const message =
      evalError instanceof Error ? evalError.message : String(evalError);
    console.error(
      "Error during boolean AST evaluation:",
      message,
      "Node:",
      node
    );
    // --- Added Cleanup ---
    // Ensure the cache entry for this content is removed if evaluation fails
    if (typeof content === "string") {
      wordBoundariesCache.delete(content);
    }
    // --- End Added Cleanup ---
    return false; // Return false on any evaluation error
  }
}

/**
 * Checks if a directory path matches any of the exclusion patterns.
 * @param dirPath The directory path to check.
 * @param excludeFolders Array of exclusion patterns.
 * @param folderExclusionMode The matching mode.
 * @returns True if the directory should be excluded, false otherwise.
 */
function isDirectoryExcluded(
  dirPath: string,
  excludeFolders: string[],
  folderExclusionMode: FolderExclusionMode
): boolean {
  if (!excludeFolders || excludeFolders.length === 0) {
    return false;
  }

  const picoOptions = { dot: true, nocase: true }; // Case-insensitive folder matching
  const folderMatchers = excludeFolders.map((pattern) => {
    let matchPattern = pattern;
    switch (folderExclusionMode) {
      case "startsWith":
        matchPattern = pattern + "*";
        break;
      case "endsWith":
        matchPattern = "*" + pattern;
        break;
      case "contains":
        if (!pattern.includes("*") && !pattern.includes("?"))
          matchPattern = "*" + pattern + "*";
        break;
      case "exact":
      default:
        break;
    }
    return picomatch(matchPattern, picoOptions);
  });

  // Split path into segments, handling both Windows and POSIX separators
  const segments = dirPath.replace(/\\/g, "/").split("/").filter(Boolean);

  // Check if any segment matches any exclusion pattern
  return folderMatchers.some((isMatch) =>
    segments.some((segment) => isMatch(segment))
  );
}

/**
 * Filters path errors to remove those related to directories that would have been excluded anyway.
 * @param allPathErrors Array of all captured path errors.
 * @param excludeFolders Array of folder exclusion patterns.
 * @param folderExclusionMode The matching mode for folder exclusions.
 * @returns Array of relevant path error messages for the user.
 */
function filterRelevantPathErrors(
  allPathErrors: PathErrorDetail[],
  excludeFolders: string[],
  folderExclusionMode: FolderExclusionMode
): string[] {
  return allPathErrors
    .filter((errorDetail) => {
      // Keep non-permission errors or errors without a specific path
      // Also keep errors related to the top-level search path itself (e.g., ENOENT)
      if (
        errorDetail.code !== "EPERM" ||
        !errorDetail.errorPath ||
        errorDetail.errorPath === errorDetail.searchPath
      ) {
        return true;
      }
      // Check if the directory causing the EPERM error should be excluded
      const shouldExclude = isDirectoryExcluded(
        errorDetail.errorPath,
        excludeFolders,
        folderExclusionMode
      );
      // Keep the error only if the directory should NOT be excluded
      return !shouldExclude;
    })
    .map((errorDetail) => errorDetail.message); // Return only the message string
}
// ----------------------------------------------------

// --- Main Search Function ---
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
  checkCancellation: CancellationChecker
): Promise<SearchResult> {
  const {
    searchPaths,
    extensions,
    excludeFiles,
    excludeFolders,
    folderExclusionMode = "contains",
    contentSearchTerm,
    contentSearchMode = "term",
    caseSensitive = false,
    modifiedAfter,
    modifiedBefore,
    minSizeBytes,
    maxSizeBytes,
    maxDepth,
  } = params;

  // Store detailed path errors including the path that caused them
  const detailedPathErrors: PathErrorDetail[] = [];
  const fileReadErrors: FileReadError[] = [];
  const structuredItems: StructuredItem[] = [];
  // const outputLines: string[] = [];
  let wasCancelled = false;

  // Ensure p-limit is loaded correctly
  if (typeof pLimit !== "function") {
    console.error(
      "pLimit was not loaded correctly. Type:",
      typeof pLimit,
      "Value:",
      pLimit
    );
    detailedPathErrors.push({
      searchPath: "Initialization",
      errorPath: "",
      message: "Internal error: Concurrency limiter failed to load.",
    });
    return {
      // output: "", // Removed
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: ["Internal error: Concurrency limiter failed to load."],
      fileReadErrors,
    };
  }
  const limit = pLimit(FILE_OPERATION_CONCURRENCY_LIMIT);

  progressCallback({
    processed: 0,
    total: 0,
    message: "Scanning directories...",
    status: "searching",
  });

  // Prepare file patterns for fast-glob
  const includePatterns = extensions.map(
    (ext) => `**/*.${ext.replace(/^\./, "")}`
  );
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;
  const globDepth = maxDepth && maxDepth > 0 ? maxDepth : Infinity;
  console.log(`Using glob depth: ${globDepth}`);

  // --- Phase 1: Initial File Discovery using fast-glob ---
  try {
    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled before file discovery.",
        status: "cancelled",
      });
      return {
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors: [],
        fileReadErrors,
        wasCancelled,
      };
    }

    // Process each search path concurrently
    await Promise.all(
      searchPaths.map(async (searchPath) => {
        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }
        const normalizedPath = searchPath.replace(/\\/g, "/");

        // Validate search path existence and type BEFORE globbing
        try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
            const errorMsg = `Search path is not a directory: ${searchPath}`;
            console.warn(errorMsg);
            detailedPathErrors.push({
              searchPath: searchPath,
              errorPath: searchPath,
              message: errorMsg,
              code: "ENOTDIR",
            });
            progressCallback({
              processed: 0,
              total: 0,
              message: `Skipping non-directory: ${searchPath}`,
              status: "searching",
            });
            return; // Skip this path
          }
        } catch (statError: unknown) {
          let message = "Unknown error";
          let reason = "Access Error";
          let errorMsg = `Error accessing search path: ${searchPath}`;
          let code: string | undefined;
          if (statError instanceof Error) {
            message = statError.message;
            code = (statError as NodeJS.ErrnoException).code;
            if (code === "ENOENT") {
              reason = "Path Not Found";
              errorMsg = `Search path not found: ${searchPath}`;
            } else if (code === "EACCES" || code === "EPERM") {
              reason = "Permission Denied";
              errorMsg = `Permission denied for search path: ${searchPath}`;
            } else {
              errorMsg = `Error accessing search path: ${searchPath} - ${message}`;
            }
          } else {
            message = String(statError);
            errorMsg = `Error accessing search path: ${searchPath} - ${message}`;
          }
          console.warn(`Path Error (${reason}): ${errorMsg}`, message);
          detailedPathErrors.push({
            searchPath: searchPath,
            errorPath: searchPath,
            message: errorMsg,
            code: code,
          });
          progressCallback({
            processed: 0,
            total: 0,
            message: `Cannot access path: ${searchPath}`,
            error: message,
            status: "error",
          });
          return; // Skip this path
        }

        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }

        try {
          // Run fast-glob, suppressing errors to continue scan
          const found = await fg(includePatterns, {
            cwd: normalizedPath,
            absolute: true,
            onlyFiles: true,
            dot: true,
            stats: false,
            suppressErrors: true, // Suppress errors to get accessible files
            deep: globDepth,
            // errorHandler removed as it's not typed and suppressErrors handles continuation
          });

          if (checkCancellation()) {
            wasCancelled = true;
            return;
          }

          // Add successfully found files to the set
          found.forEach((file: string) =>
            allFoundFiles.add(file.replace(/\\/g, "/"))
          );

          // Note: With suppressErrors: true, we won't get EPERM errors here.
          // We rely on later fs.stat/fs.readFile errors if needed.
        } catch (globError: unknown) {
          // Catch unexpected errors *other* than traversal issues suppressed above
          const message =
            globError instanceof Error ? globError.message : String(globError);
          console.error(
            `Unexpected error during fast-glob execution for path "${searchPath}":`,
            message
          );
          detailedPathErrors.push({
            searchPath: searchPath,
            errorPath: searchPath,
            message: `Unexpected error scanning "${searchPath}": ${message}`,
          });
        }
      })
    );

    if (wasCancelled) {
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled during file discovery.",
        status: "cancelled",
      });
      return {
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors: filterRelevantPathErrors(
          detailedPathErrors,
          excludeFolders,
          folderExclusionMode
        ),
        fileReadErrors,
        wasCancelled,
      };
    }

    initialFileCount = allFoundFiles.size;
    progressCallback({
      processed: 0,
      total: initialFileCount,
      message: `Found ${initialFileCount} potential files (depth limit: ${globDepth === Infinity ? "none" : globDepth}). Filtering...`,
      status: "searching",
    });
  } catch (error: unknown) {
    // This catch block handles errors outside the map loop (e.g., Promise.all rejection)
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error during file discovery phase:", message);
    const errorMsg = `Unexpected error during file search setup: ${message}`;
    detailedPathErrors.push({
      searchPath: "Setup",
      errorPath: "",
      message: errorMsg,
    });
    progressCallback({
      processed: 0,
      total: 0,
      message: errorMsg,
      error: message,
      status: "error",
    });
    return {
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: [errorMsg], // Return the raw error here
      fileReadErrors,
    };
  }

  // --- Phase 2: Filtering based on Exclusions (File/Folder) ---
  const initialFiles = Array.from(allFoundFiles);
  let filesToProcess: string[] = initialFiles;
  let currentTotal = initialFileCount;

  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: "Search cancelled before filtering.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: filterRelevantPathErrors(
        detailedPathErrors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  // Filter by excluded files (using picomatch and regex)
  if (excludeFiles && excludeFiles.length > 0 && filesToProcess.length > 0) {
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: `Filtering by excluded file patterns...`,
      status: "searching",
    });
    filesToProcess = filesToProcess.filter((filePath) => {
      const filename = path.basename(filePath);
      const isExcluded = excludeFiles.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        // Use picomatch for glob patterns
        return picomatch.isMatch(filename, pattern, { dot: true });
      });
      return !isExcluded;
    });
    currentTotal = filesToProcess.length;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: `Filtered ${currentTotal} files after file exclusion.`,
      status: "searching",
    });
  }

  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: "Search cancelled after file exclusion filter.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: filterRelevantPathErrors(
        detailedPathErrors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  // Filter by excluded folders (using picomatch based on mode)
  if (
    excludeFolders &&
    excludeFolders.length > 0 &&
    filesToProcess.length > 0
  ) {
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: `Filtering by excluded folder patterns (${folderExclusionMode})...`,
      status: "searching",
    });

    filesToProcess = filesToProcess.filter(
      (filePath) =>
        !isDirectoryExcluded(
          path.dirname(filePath),
          excludeFolders,
          folderExclusionMode
        )
    );

    currentTotal = filesToProcess.length;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: `Filtered ${currentTotal} files after folder exclusion.`,
      status: "searching",
    });
  }

  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: "Search cancelled after folder exclusion filter.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: filterRelevantPathErrors(
        detailedPathErrors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  // --- Phase 3: Filtering based on Metadata (Size/Date) ---
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter =
    minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;

  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    const initialCountForStatFilter = filesToProcess.length;
    progressCallback({
      processed: 0,
      total: initialCountForStatFilter,
      message: `Filtering ${initialCountForStatFilter} files by size/date (parallel)...`,
      status: "searching",
    });

    // Get file stats concurrently using p-limit
    const statCheckPromises = filesToProcess.map((filePath) =>
      limit(async () => {
        if (checkCancellation()) return null; // Check cancellation before stat call
        try {
          const stats = await fs.stat(filePath);
          const fileSize = stats.size;
          const mtime = stats.mtime;

          // Check size filter
          const passSizeCheck =
            !hasSizeFilter ||
            ((minSizeBytes === undefined || fileSize >= minSizeBytes) &&
              (maxSizeBytes === undefined || fileSize <= maxSizeBytes));

          // Check date filter
          const passDateCheck =
            !hasDateFilter ||
            ((!afterDate || mtime.getTime() >= afterDate.getTime()) &&
              (!beforeDate || mtime.getTime() <= beforeDate.getTime()));

          // Return filePath only if both checks pass
          return passSizeCheck && passDateCheck ? filePath : null;
        } catch (statError: unknown) {
          // Log stat errors but don't stop the search, just exclude the file
          const message =
            statError instanceof Error ? statError.message : String(statError);
          console.warn(
            `Could not get stats for file during size/date filter: ${filePath}`,
            message
          );
          return null; // Exclude file if stats fail
        }
      })
    );

    const statResults = await Promise.all(statCheckPromises);

    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: initialCountForStatFilter, // Assume all were attempted
        total: initialCountForStatFilter,
        message: "Search cancelled during size/date filter.",
        status: "cancelled",
      });
      return {
        structuredItems: [],
        filesFound: initialFileCount,
        filesProcessed: 0, // No files fully processed yet
        errorsEncountered: 0,
        pathErrors: filterRelevantPathErrors(
          detailedPathErrors,
          excludeFolders,
          folderExclusionMode
        ),
        fileReadErrors,
        wasCancelled,
      };
    }

    // Filter out the null results (files that failed stat or didn't match)
    filesToProcess = statResults.filter(
      (result): result is string => result !== null
    );
    currentTotal = filesToProcess.length;
    progressCallback({
      processed: initialCountForStatFilter, // Show progress based on attempted stats
      total: initialCountForStatFilter,
      message: `Filtered ${currentTotal} files after size/date check.`,
      status: "searching",
    });
  }

  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0, // Reset processed count as we didn't start content processing
      total: currentTotal,
      message: "Search cancelled after size/date filter.",
      status: "cancelled",
    });
    return {
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors: filterRelevantPathErrors(
        detailedPathErrors,
        excludeFolders,
        folderExclusionMode
      ),
      fileReadErrors,
      wasCancelled,
    };
  }

  // --- Phase 4: Content Matching (if applicable) ---
  let filesProcessedCounter = 0;
  const totalFilesToProcess = filesToProcess.length;
  let contentMatcher: ((content: string) => boolean) | null = null;
  let parseOrRegexError = false;

  // Prepare content matcher based on mode and term
  if (contentSearchTerm) {
    switch (contentSearchMode) {
      case "regex": {
        const flags = caseSensitive ? "" : "i";
        const regex = createSafeRegex(contentSearchTerm, flags);
        if (regex) {
          contentMatcher = (content) => regex.test(content);
        } else {
          // Handle invalid regex pattern
          parseOrRegexError = true;
          const errorMsg = `Invalid regular expression pattern: ${contentSearchTerm}`;
          detailedPathErrors.push({
            searchPath: "Query Parsing",
            errorPath: "",
            message: errorMsg,
          });
          progressCallback({
            processed: 0,
            total: 0,
            message: errorMsg,
            error: "Invalid Regex",
            status: "error",
          });
          return {
            structuredItems: [],
            filesFound: initialFileCount,
            filesProcessed: 0,
            errorsEncountered: 0,
            pathErrors: [errorMsg], // Return raw error
            fileReadErrors,
          };
        }
        break;
      }
      case "boolean": {
        try {
          // Configure jsep for AND/OR/NOT/NEAR
          if (jsep.binary_ops["||"]) jsep.removeBinaryOp("||");
          if (jsep.binary_ops["&&"]) jsep.removeBinaryOp("&&");
          if (jsep.unary_ops["!"]) jsep.removeUnaryOp("!");
          if (!jsep.binary_ops["AND"]) jsep.addBinaryOp("AND", 1); // Higher precedence than OR
          if (!jsep.binary_ops["OR"]) jsep.addBinaryOp("OR", 0);
          if (!jsep.unary_ops["NOT"]) jsep.addUnaryOp("NOT");
          // Note: NEAR is handled as a CallExpression within evaluateBooleanAst

          const parsedAst = jsep(contentSearchTerm);
          console.log(
            "Parsed Boolean AST:",
            JSON.stringify(parsedAst, null, 2)
          );
          // Create matcher function that evaluates the AST
          contentMatcher = (content) => {
            // Clear cache for this specific content before evaluation
            wordBoundariesCache.delete(content);
            const result = evaluateBooleanAst(
              parsedAst,
              content,
              caseSensitive
            );
            // No need to clear cache here, evaluateBooleanAst handles cleanup on error
            return result;
          };
        } catch (parseError: unknown) {
          // Handle boolean query parsing errors
          parseOrRegexError = true;
          let errorDetail = "Unknown parsing error";
          let errorIndex = -1;
          if (parseError instanceof Error) {
            errorDetail = parseError.message;
          } else {
            errorDetail = String(parseError);
          }
          // Try to extract error index from jsep error
          if (
            typeof parseError === "object" &&
            parseError !== null &&
            "index" in parseError &&
            typeof parseError.index === "number"
          ) {
            errorIndex = parseError.index;
          }
          if (errorIndex >= 0) {
            errorDetail += ` near character ${errorIndex + 1}`;
          }
          const errorMsg = `Invalid boolean query syntax: ${errorDetail}`;
          detailedPathErrors.push({
            searchPath: "Query Parsing",
            errorPath: "",
            message: errorMsg,
          });
          progressCallback({
            processed: 0,
            total: 0,
            message: errorMsg,
            error: "Invalid Boolean Query",
            status: "error",
          });
          return {
            structuredItems: [],
            filesFound: initialFileCount,
            filesProcessed: 0,
            errorsEncountered: 0,
            pathErrors: [errorMsg], // Return raw error
            fileReadErrors,
            wasCancelled: false, // Not cancelled, but errored
          };
        }
        break;
      }
      case "term":
      default: {
        // Simple term matching
        if (caseSensitive) {
          contentMatcher = (content) => content.includes(contentSearchTerm);
        } else {
          const searchTermLower = contentSearchTerm.toLowerCase();
          contentMatcher = (content) =>
            content.toLowerCase().includes(searchTermLower);
        }
        break;
      }
    }
  }

  // Update progress before starting file processing loop
  if (totalFilesToProcess > 0 && !parseOrRegexError) {
    progressCallback({
      processed: 0,
      total: totalFilesToProcess,
      message: `Processing ${totalFilesToProcess} files (parallel)...`,
      status: "searching",
    });
  } else if (detailedPathErrors.length === 0 && !parseOrRegexError) {
    // No files left to process after filtering, and no errors occurred
    progressCallback({
      processed: 0,
      total: 0,
      message: `No files to process after filtering.`,
      status: "completed",
    });
  }

  // Process files only if no parsing/regex errors occurred
  if (!parseOrRegexError) {
    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: 0,
        total: totalFilesToProcess,
        message: "Search cancelled before processing files.",
        status: "cancelled",
      });
      return {
        structuredItems: [],
        filesFound: initialFileCount,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors: filterRelevantPathErrors(
          detailedPathErrors,
          excludeFolders,
          folderExclusionMode
        ),
        fileReadErrors,
        wasCancelled,
      };
    }

    // Process remaining files concurrently using p-limit
    const processingPromises = filesToProcess.map((file) =>
      limit(async () => {
        if (checkCancellation()) {
          return null; // Skip processing if cancelled
        }

        const currentFileName = path.basename(file);
        const displayFilePath = file.replace(/\\/g, "/"); // Normalize path for display
        let fileContent: string | null = null;
        let structuredItemResult: StructuredItem | null = null;
        // let outputLineResult: string | null = null;
        let fileReadErrorResult: FileReadError | null = null;
        let errorKeyForProgress: string | undefined = undefined;
        let incrementCounter = true; // Flag to control progress increment
        let contentMatches = !contentMatcher; // Default to true if no content query

        try {
          if (checkCancellation()) {
            incrementCounter = false; // Don't increment if cancelled before read
            return null;
          }

          // Only read content if there's a content matcher
          if (contentMatcher) {
            fileContent = await fs.readFile(file, { encoding: "utf8" });
            contentMatches = contentMatcher(fileContent);
          }

          // Always add a structured item, indicating match status
          structuredItemResult = {
            filePath: displayFilePath,
            matched: contentMatches, // Store match status
            readError: undefined,
          };

        } catch (error: unknown) {
          // Handle file read errors
          const message =
            error instanceof Error ? error.message : String(error);
          console.error(`Error reading file '${file}':`, message);
          let reasonKey = "readError"; // Default error reason
          const code = (error as { code?: string })?.code;
          // Map common error codes to reason keys for i18n
          if (code === "EPERM" || code === "EACCES") {
            reasonKey = "readPermissionDenied";
          } else if (code === "ENOENT") {
            reasonKey = "fileNotFoundDuringRead";
          } else if (code === "EISDIR") {
            reasonKey = "pathIsDir";
          }
          // Add structured item indicating the read error
          structuredItemResult = {
            filePath: displayFilePath,
            matched: false, // Cannot match if read failed
            readError: reasonKey,
          };
          // Add detailed error info for the final result summary
          fileReadErrorResult = {
            filePath: displayFilePath,
            reason: reasonKey,
            detail: message,
          };
          errorKeyForProgress = reasonKey; // For progress update message
        } finally {
          // --- Cache Cleanup ---
          if (fileContent !== null) {
            wordBoundariesCache.delete(fileContent);
          }
          // --- End Cache Cleanup ---

          // Update progress after each file attempt (if not cancelled mid-operation)
          if (incrementCounter) {
            filesProcessedCounter++;
            const cancelled = checkCancellation(); // Check cancellation status for progress message
            progressCallback({
              processed: filesProcessedCounter,
              total: totalFilesToProcess,
              currentFile: currentFileName,
              message: errorKeyForProgress
                ? `Error: ${currentFileName}` // Show error in message
                : cancelled
                  ? "Cancelling..." // Indicate cancellation in progress
                  : `Processed: ${currentFileName}`, // Normal processing message
              error: errorKeyForProgress, // Pass error key for potential UI highlighting
              status: cancelled ? "cancelling" : "searching", // Update status
            });
          }
        }
        // Return results for this file (or null if cancelled)
        return checkCancellation()
          ? null
          : { structuredItemResult, fileReadErrorResult };
      })
    );

    // Wait for all file processing promises to settle
    const resultsFromPromises = await Promise.all(processingPromises);
    wasCancelled = checkCancellation(); // Final cancellation check

    // Aggregate results from all promises
    resultsFromPromises.forEach((result) => {
      if (result) {
        // Add valid results to the respective arrays
        if (result.structuredItemResult) {
          structuredItems.push(result.structuredItemResult);
        }
        if (result.fileReadErrorResult) {
          fileReadErrors.push(result.fileReadErrorResult);
        }
      }
    });
  }

  // --- Final Progress Update and Return ---
  const finalStatus = wasCancelled ? "cancelled" : "completed";
  progressCallback({
    processed: filesProcessedCounter,
    total: totalFilesToProcess,
    message: wasCancelled
      ? `Search cancelled after processing ${filesProcessedCounter} files.`
      : `Finished processing ${filesProcessedCounter} files.`,
    status: finalStatus,
  });

  // Filter path errors for relevance before returning
  const relevantPathErrors = filterRelevantPathErrors(
    detailedPathErrors,
    excludeFolders,
    folderExclusionMode
  );

  // Return the final search result object (without output)
  return {
    structuredItems: structuredItems,
    filesFound: initialFileCount,
    filesProcessed: filesProcessedCounter,
    errorsEncountered: fileReadErrors.length,
    pathErrors: relevantPathErrors, // Return filtered errors
    fileReadErrors: fileReadErrors,
    wasCancelled: wasCancelled,
  };
}
