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
  options?: FastGlobOptions  ,
) => Promise<string[]> = require("fast-glob");
const pLimitModule = require("p-limit") as { default?: typeof PLimit; __esModule?: boolean; };
const pLimit: typeof PLimit = pLimitModule.default ?? (pLimitModule as typeof PLimit);

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

export interface StructuredItem {
  filePath: string;
  content: string | null;
  readError?: string;
}

export interface SearchResult {
  output: string;
  structuredItems: StructuredItem[];
  filesProcessed: number;
  filesFound: number;
  errorsEncountered: number;
  pathErrors: string[];
  fileReadErrors: FileReadError[];
  wasCancelled?: boolean;
}

// Callback type for progress updates
export type ProgressCallback = (data: ProgressData) => void;
// Type for cancellation check function
export type CancellationChecker = () => boolean;

// --- Concurrency Limit ---
const FILE_OPERATION_CONCURRENCY_LIMIT = 20;

// --- Helper Functions ---
function parseDateStartOfDay(dateString: string | undefined): Date | null {
  if (!dateString) return null;
  try {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
      console.warn(
        `Invalid date format for parsing: ${dateString}. Expected YYYY-MM-DD.`,
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
      message,
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
// --- Fix: Use Jsep namespace for type guard ---
function isJsepLogicalExpression(
  node: unknown,
): node is Jsep.Expression & { type: "LogicalExpression"; operator: string; left: Jsep.Expression; right: Jsep.Expression } {
  return (
    isJsepExpression(node) &&
    node.type === "LogicalExpression" &&
    "left" in node &&
    "right" in node &&
    "operator" in node
  );
}
// --- End Fix ---
function isJsepUnaryExpression(node: unknown): node is Jsep.UnaryExpression {
  return (
    isJsepExpression(node) &&
    node.type === "UnaryExpression" &&
    "argument" in node &&
    "operator" in node
  );
}

function findTermIndices(
  content: string,
  term: string | RegExp,
  caseSensitive: boolean,
  isRegex: boolean,
): number[] {
  const indices: number[] = [];
  if (!term) return indices;
  if (isRegex && term instanceof RegExp) {
    const regex = new RegExp(
      term.source,
      term.flags.includes("g") ? term.flags : term.flags + "g",
    );
    let match;
    while ((match = regex.exec(content)) !== null) {
      indices.push(match.index);
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

interface WordBoundary {
  word: string;
  start: number;
  end: number;
}
function getWordBoundaries(content: string): WordBoundary[] {
  const boundaries: WordBoundary[] = [];
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
const wordBoundariesCache = new Map<string, WordBoundary[]>();
function getWordIndexFromCharIndex(charIndex: number, content: string): number {
  let boundaries = wordBoundariesCache.get(content);
  if (!boundaries) {
    boundaries = getWordBoundaries(content);
    wordBoundariesCache.set(content, boundaries);
  }
  for (let i = 0; i < boundaries.length; i++) {
    if (charIndex >= boundaries[i].start && charIndex <= boundaries[i].end) {
      return i;
    }
  }
  for (let i = boundaries.length - 1; i >= 0; i--) {
    if (boundaries[i].end < charIndex) {
      if (/^\s*$/.test(content.substring(boundaries[i].end + 1, charIndex + 1))) {
        return i;
      }
      break;
    }
  }
  return -1;
}

function evaluateBooleanAst(
  node: Jsep.Expression | unknown,
  content: string,
  caseSensitive: boolean,
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
            node,
          );
          return false;
        }
        const leftResult = evaluateBooleanAst(node.left, content, caseSensitive);
        if (node.operator === "OR" && leftResult) return true;
        if (node.operator === "AND" && !leftResult) return false;
        const rightResult = evaluateBooleanAst(node.right, content, caseSensitive);
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
        if (!isJsepIdentifier(node)) return false;
        const termIdentifierStr = node.name;
        const regexFromIdentifier = parseRegexLiteral(termIdentifierStr);
        if (regexFromIdentifier) {
          return regexFromIdentifier.test(content);
        } else {
          return caseSensitive
            ? content.includes(termIdentifierStr)
            : content.toLowerCase().includes(termIdentifierStr.toLowerCase());
        }
      }
      case "Literal": {
        if (!isJsepLiteral(node)) return false;
        if (typeof node.value === "string") {
          const termLiteralStr = node.value;
          const regexFromLiteral = parseRegexLiteral(termLiteralStr);
          if (regexFromLiteral) {
            return regexFromLiteral.test(content);
          } else {
            return caseSensitive
              ? content.includes(termLiteralStr)
              : content.toLowerCase().includes(termLiteralStr.toLowerCase());
          }
        }
        if (typeof node.value === "boolean") {
          return node.value;
        }
        if (typeof node.value === "number") {
          console.warn(
            `Numeric literal ${node.value} encountered outside NEAR function.`,
          );
          return false;
        }
        console.warn(`Unsupported literal type: ${typeof node.value}`);
        return false;
      }
      case "CallExpression": {
        if (!isJsepCallExpression(node)) {
          console.warn("Node is not a valid CallExpression:", node);
          return false;
        }
        if (!isJsepIdentifier(node.callee) || node.callee.name !== "NEAR") {
          console.warn(
            `Unsupported function call: ${isJsepIdentifier(node.callee) ? node.callee.name : "unknown"}`,
          );
          return false;
        }
        if (node.arguments.length !== 3) {
          console.warn(
            `NEAR function requires exactly 3 arguments (term1, term2, distance), got ${node.arguments.length}`,
          );
          return false;
        }
        const arg1Node = node.arguments[0];
        const arg2Node = node.arguments[1];
        const arg3Node = node.arguments[2];
        let term1: string | RegExp | null = null;
        let term1IsRegex = false;
        if (isJsepLiteral(arg1Node) && typeof arg1Node.value === "string") {
          const valueStr = arg1Node.value;
          term1 = parseRegexLiteral(valueStr) || valueStr;
          term1IsRegex = term1 instanceof RegExp;
        } else if (isJsepIdentifier(arg1Node)) {
          const nameStr = arg1Node.name;
          term1 = parseRegexLiteral(nameStr) || nameStr;
          term1IsRegex = term1 instanceof RegExp;
        }
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
        let distance: number | null = null;
        if (
          isJsepLiteral(arg3Node) &&
          typeof arg3Node.value === "number" &&
          arg3Node.value >= 0
        ) {
          distance = Math.floor(arg3Node.value);
        }
        if (term1 === null || term2 === null || distance === null) {
          console.warn(
            `Invalid arguments for NEAR function. term1: ${String(term1)}, term2: ${String(term2)}, distance: ${String(distance)}`,
          );
          return false;
        }
        const indices1 = findTermIndices(
          content,
          term1,
          term1IsRegex ? false : caseSensitive,
          term1IsRegex,
        );
        const indices2 = findTermIndices(
          content,
          term2,
          term2IsRegex ? false : caseSensitive,
          term2IsRegex,
        );
        if (indices1.length === 0 || indices2.length === 0) {
          return false;
        }
        if (!wordBoundariesCache.has(content)) {
          wordBoundariesCache.set(content, getWordBoundaries(content));
        }
        for (const index1 of indices1) {
          const wordIndex1 = getWordIndexFromCharIndex(index1, content);
          if (wordIndex1 === -1) continue;
          for (const index2 of indices2) {
            const wordIndex2 = getWordIndexFromCharIndex(index2, content);
            if (wordIndex2 === -1) continue;
            if (Math.abs(wordIndex1 - wordIndex2) <= distance) {
              return true;
            }
          }
        }
        return false;
      }
      default: {
        console.warn(`Unsupported AST node type: ${String(node.type)}`);
        return false;
      }
    }
  } catch (evalError: unknown) {
    const message = evalError instanceof Error ? evalError.message : String(evalError);
    console.error("Error during boolean AST evaluation:", message, "Node:", node);
    if (typeof content === "string") {
      wordBoundariesCache.delete(content);
    }
    return false;
  }
}
// ----------------------------------------------------

// --- Main Search Function ---
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
  checkCancellation: CancellationChecker,
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

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];
  const structuredItems: StructuredItem[] = [];
  const outputLines: string[] = [];
  let wasCancelled = false;

  if (typeof pLimit !== "function") {
    console.error(
      "pLimit was not loaded correctly. Type:",
      typeof pLimit,
      "Value:",
      pLimit,
    );
    pathErrors.push("Internal error: Concurrency limiter failed to load.");
    return {
      output: "",
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
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
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;
  const globDepth = maxDepth && maxDepth > 0 ? maxDepth : Infinity;
  console.log(`Using glob depth: ${globDepth}`);

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
        output: "",
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors,
        fileReadErrors,
        wasCancelled,
      };
    }

    await Promise.all(
      searchPaths.map(async (searchPath) => {
        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }
        const normalizedPath = searchPath.replace(/\\/g, "/");
        try {
          const stats = await fs.stat(searchPath);
          if (!stats.isDirectory()) {
            const errorMsg = `Search path is not a directory: ${searchPath}`;
            console.warn(errorMsg);
            pathErrors.push(errorMsg);
            progressCallback({
              processed: 0,
              total: 0,
              message: `Skipping non-directory: ${searchPath}`,
              status: "searching",
            });
            return;
          }
        } catch (statError: unknown) {
          let message = "Unknown error";
          let reason = "Access Error";
          let errorMsg = `Error accessing search path: ${searchPath}`;
          if (statError instanceof Error) {
            message = statError.message;
            const code = (statError as { code?: string }).code;
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
          pathErrors.push(errorMsg);
          progressCallback({
            processed: 0,
            total: 0,
            message: `Cannot access path: ${searchPath}`,
            error: message,
            status: "error",
          });
          return;
        }

        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }
        // --- Fix: Use typed fg function ---
        const found = await fg(includePatterns, {
          cwd: normalizedPath,
          absolute: true,
          onlyFiles: true,
          dot: true,
          stats: false,
          suppressErrors: true,
          deep: globDepth,
        });
        // --- End Fix ---

        if (checkCancellation()) {
          wasCancelled = true;
          return;
        }
        // --- Fix: Add explicit type to 'file' ---
        found.forEach((file: string) => allFoundFiles.add(file.replace(/\\/g, "/")));
        // --- End Fix ---
      }),
    );

    if (wasCancelled) {
      progressCallback({
        processed: 0,
        total: 0,
        message: "Search cancelled during file discovery.",
        status: "cancelled",
      });
      return {
        output: "",
        structuredItems: [],
        filesFound: 0,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors,
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
    const message = error instanceof Error ? error.message : String(error);
    console.error("Error during file discovery:", message);
    const errorMsg = `Unexpected error during file search: ${message}`;
    pathErrors.push(errorMsg);
    progressCallback({
      processed: 0,
      total: 0,
      message: errorMsg,
      error: message,
      status: "error",
    });
    return {
      output: "",
      structuredItems: [],
      filesFound: 0,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
    };
  }

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
      output: "",
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
      wasCancelled,
    };
  }

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
      output: "",
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
      wasCancelled,
    };
  }

  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) {
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: `Filtering by excluded folder patterns (${folderExclusionMode})...`,
      status: "searching",
    });
    const picoOptions = { dot: true, nocase: true };
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
    filesToProcess = filesToProcess.filter((filePath) => {
      const dirPath = path.dirname(filePath);
      const segments = dirPath.split(/[\\/]/).filter(Boolean);
      const isExcluded = folderMatchers.some((isMatch) =>
        segments.some((segment) => isMatch(segment)),
      );
      return !isExcluded;
    });
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
      output: "",
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
      wasCancelled,
    };
  }

  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;
  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) {
    const initialCountForStatFilter = filesToProcess.length;
    progressCallback({
      processed: 0,
      total: initialCountForStatFilter,
      message: `Filtering ${initialCountForStatFilter} files by size/date (parallel)...`,
      status: "searching",
    });
    const statCheckPromises = filesToProcess.map((filePath) =>
      limit(async () => {
        if (checkCancellation()) return null;
        try {
          const stats = await fs.stat(filePath);
          const fileSize = stats.size;
          const mtime = stats.mtime;
          const passSizeCheck =
            !hasSizeFilter ||
            ((minSizeBytes === undefined || fileSize >= minSizeBytes) &&
              (maxSizeBytes === undefined || fileSize <= maxSizeBytes));
          const passDateCheck =
            !hasDateFilter ||
            ((!afterDate || mtime.getTime() >= afterDate.getTime()) &&
              (!beforeDate || mtime.getTime() <= beforeDate.getTime()));
          return passSizeCheck && passDateCheck ? filePath : null;
        } catch (statError: unknown) {
          const message = statError instanceof Error ? statError.message : String(statError);
          console.warn(
            `Could not get stats for file during size/date filter: ${filePath}`,
            message,
          );
          return null;
        }
      }),
    );
    const statResults = await Promise.all(statCheckPromises);
    if (checkCancellation()) {
      wasCancelled = true;
      progressCallback({
        processed: initialCountForStatFilter,
        total: initialCountForStatFilter,
        message: "Search cancelled during size/date filter.",
        status: "cancelled",
      });
      return {
        output: "",
        structuredItems: [],
        filesFound: initialFileCount,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors,
        fileReadErrors,
        wasCancelled,
      };
    }
    filesToProcess = statResults.filter((result): result is string => result !== null);
    currentTotal = filesToProcess.length;
    progressCallback({
      processed: initialCountForStatFilter,
      total: initialCountForStatFilter,
      message: `Filtered ${currentTotal} files after size/date check.`,
      status: "searching",
    });
  }
  if (checkCancellation()) {
    wasCancelled = true;
    progressCallback({
      processed: 0,
      total: currentTotal,
      message: "Search cancelled after size/date filter.",
      status: "cancelled",
    });
    return {
      output: "",
      structuredItems: [],
      filesFound: initialFileCount,
      filesProcessed: 0,
      errorsEncountered: 0,
      pathErrors,
      fileReadErrors,
      wasCancelled,
    };
  }

  let filesProcessedCounter = 0;
  const totalFilesToProcess = filesToProcess.length;
  let contentMatcher: ((content: string) => boolean) | null = null;
  let parseOrRegexError = false;

  if (contentSearchTerm) {
    switch (contentSearchMode) {
      case "regex": {
        const flags = caseSensitive ? "" : "i";
        const regex = createSafeRegex(contentSearchTerm, flags);
        if (regex) {
          contentMatcher = (content) => regex.test(content);
        } else {
          parseOrRegexError = true;
          const errorMsg = `Invalid regular expression pattern: ${contentSearchTerm}`;
          pathErrors.push(errorMsg);
          progressCallback({
            processed: 0,
            total: 0,
            message: errorMsg,
            error: "Invalid Regex",
            status: "error",
          });
          return {
            output: "",
            structuredItems: [],
            filesFound: initialFileCount,
            filesProcessed: 0,
            errorsEncountered: 0,
            pathErrors,
            fileReadErrors,
          };
        }
        break;
      }
      case "boolean": {
        try {
          if (jsep.binary_ops["||"]) jsep.removeBinaryOp("||");
          if (jsep.binary_ops["&&"]) jsep.removeBinaryOp("&&");
          if (jsep.unary_ops["!"]) jsep.removeUnaryOp("!");
          if (!jsep.binary_ops["AND"]) jsep.addBinaryOp("AND", 1);
          if (!jsep.binary_ops["OR"]) jsep.addBinaryOp("OR", 0);
          if (!jsep.unary_ops["NOT"]) jsep.addUnaryOp("NOT");
          const parsedAst = jsep(contentSearchTerm);
          console.log("Parsed Boolean AST:", JSON.stringify(parsedAst, null, 2));
          contentMatcher = (content) => {
            wordBoundariesCache.delete(content);
            const result = evaluateBooleanAst(parsedAst, content, caseSensitive);
            return result;
          };
        } catch (parseError: unknown) {
          parseOrRegexError = true;
          let errorDetail = "Unknown parsing error";
          let errorIndex = -1;
          if (parseError instanceof Error) {
            errorDetail = parseError.message;
          } else {
            errorDetail = String(parseError);
          }
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
          pathErrors.push(errorMsg);
          progressCallback({
            processed: 0,
            total: 0,
            message: errorMsg,
            error: "Invalid Boolean Query",
            status: "error",
          });
          return {
            output: "",
            structuredItems: [],
            filesFound: initialFileCount,
            filesProcessed: 0,
            errorsEncountered: 0,
            pathErrors,
            fileReadErrors,
            wasCancelled: false,
          };
        }
        break;
      }
      case "term":
      default: {
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

  if (totalFilesToProcess > 0 && !parseOrRegexError) {
    progressCallback({
      processed: 0,
      total: totalFilesToProcess,
      message: `Processing ${totalFilesToProcess} files (parallel)...`,
      status: "searching",
    });
  } else if (pathErrors.length === 0 && !parseOrRegexError) {
    progressCallback({
      processed: 0,
      total: 0,
      message: `No files to process after filtering.`,
      status: "completed",
    });
  }

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
        output: "",
        structuredItems: [],
        filesFound: initialFileCount,
        filesProcessed: 0,
        errorsEncountered: 0,
        pathErrors,
        fileReadErrors,
        wasCancelled,
      };
    }

    const processingPromises = filesToProcess.map((file) =>
      limit(async () => {
        if (checkCancellation()) {
          return null;
        }

        const currentFileName = path.basename(file);
        const displayFilePath = file.replace(/\\/g, "/");
        let fileContent: string | null = null;
        let structuredItemResult: StructuredItem | null = null;
        let outputLineResult: string | null = null;
        let fileReadErrorResult: FileReadError | null = null;
        let errorKeyForProgress: string | undefined = undefined;
        let incrementCounter = true;

        try {
          if (checkCancellation()) {
            incrementCounter = false;
            return null;
          }
          fileContent = await fs.readFile(file, { encoding: "utf8" });
          const contentMatches = !contentMatcher || contentMatcher(fileContent);
          if (contentMatches) {
            outputLineResult = `${displayFilePath}\n\n${fileContent}\n`;
            structuredItemResult = {
              filePath: displayFilePath,
              content: fileContent,
              readError: undefined,
            };
          } else {
            structuredItemResult = {
              filePath: displayFilePath,
              content: null,
              readError: undefined,
            };
          }
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          console.error(`Error reading file '${file}':`, message);
          let reasonKey = "readError";
          const code = (error as { code?: string })?.code;
          if (code === "EPERM" || code === "EACCES") {
            reasonKey = "readPermissionDenied";
          } else if (code === "ENOENT") {
            reasonKey = "fileNotFoundDuringRead";
          } else if (code === "EISDIR") {
            reasonKey = "pathIsDir";
          }
          structuredItemResult = {
            filePath: displayFilePath,
            content: null,
            readError: reasonKey,
          };
          fileReadErrorResult = {
            filePath: displayFilePath,
            reason: reasonKey,
            detail: message,
          };
          errorKeyForProgress = reasonKey;
        } finally {
          if (fileContent !== null) {
            wordBoundariesCache.delete(fileContent);
          }
          if (incrementCounter) {
            filesProcessedCounter++;
            const cancelled = checkCancellation();
            progressCallback({
              processed: filesProcessedCounter,
              total: totalFilesToProcess,
              currentFile: currentFileName,
              message: errorKeyForProgress
                ? `Error: ${currentFileName}`
                : cancelled
                  ? "Cancelling..."
                  : `Processed: ${currentFileName}`,
              error: errorKeyForProgress,
              status: cancelled ? "cancelling" : "searching",
            });
          }
        }
        return checkCancellation()
          ? null
          : { structuredItemResult, outputLineResult, fileReadErrorResult };
      }),
    );

    const resultsFromPromises = await Promise.all(processingPromises);
    wasCancelled = checkCancellation();

    resultsFromPromises.forEach((result) => {
      if (result) {
        if (result.structuredItemResult) {
          structuredItems.push(result.structuredItemResult);
        }
        if (result.outputLineResult) {
          outputLines.push(result.outputLineResult);
        }
        if (result.fileReadErrorResult) {
          fileReadErrors.push(result.fileReadErrorResult);
        }
      }
    });
  }

  const finalStatus = wasCancelled ? "cancelled" : "completed";
  progressCallback({
    processed: filesProcessedCounter,
    total: totalFilesToProcess,
    message: wasCancelled
      ? `Search cancelled after processing ${filesProcessedCounter} files.`
      : `Finished processing ${filesProcessedCounter} files.`,
    status: finalStatus,
  });

  const finalOutput = outputLines.join("\n");

  return {
    output: finalOutput,
    structuredItems: structuredItems,
    filesFound: initialFileCount,
    filesProcessed: filesProcessedCounter,
    errorsEncountered: fileReadErrors.length,
    pathErrors: pathErrors,
    fileReadErrors: fileReadErrors,
    wasCancelled: wasCancelled,
  };
}
