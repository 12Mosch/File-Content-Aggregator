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
  status?: 'searching' | 'cancelling' | 'cancelled' | 'completed' | 'error'; // Add status
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
  wasCancelled?: boolean; // Flag to indicate cancellation
}

// Callback type for progress updates
export type ProgressCallback = (data: ProgressData) => void;
// Type for cancellation check function
export type CancellationChecker = () => boolean; // Returns true if cancelled

// --- Concurrency Limit ---
const FILE_OPERATION_CONCURRENCY_LIMIT = 20;

// --- Helper Functions (Unchanged) ---
function parseDateStartOfDay(dateString: string | undefined): Date | null { /* ... */ if (!dateString) return null; try { if (!/^\d{4}-\d{2}-\d{2}$/.test(dateString)) { console.warn(`Invalid date format for parsing: ${dateString}. Expected YYYY-MM-DD.`); return null; } const date = new Date(dateString); if (isNaN(date.getTime())) { console.warn(`Invalid date value resulted from parsing: ${dateString}`); return null; } date.setHours(0, 0, 0, 0); return date; } catch (e) { console.error(`Error parsing date string "${dateString}":`, e); return null; } }
function parseDateEndOfDay(dateString: string | undefined): Date | null { /* ... */ const date = parseDateStartOfDay(dateString); if (date) { date.setHours(23, 59, 59, 999); } return date; }
function parseRegexLiteral(pattern: string): RegExp | null { /* ... */ const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/); if (regexMatch) { try { return new RegExp(regexMatch[1], regexMatch[2]); } catch (e) { console.warn(`Invalid RegExp literal format: ${pattern}`, e); return null; } } return null; }
function createSafeRegex(pattern: string, flags: string): RegExp | null { /* ... */ try { if (!pattern) { console.warn(`Attempted to create RegExp with empty pattern.`); return null; } return new RegExp(pattern, flags); } catch (e) { console.warn(`Invalid RegExp pattern created: "${pattern}" with flags "${flags}"`, e); return null; } }
function isJsepExpression(node: any): node is Jsep.Expression { /* ... */ return node !== null && typeof node === 'object' && typeof node.type === 'string'; }
function isJsepIdentifier(node: any): node is Jsep.Identifier { /* ... */ return isJsepExpression(node) && node.type === 'Identifier' && typeof (node as Jsep.Identifier).name === 'string'; }
function isJsepLiteral(node: any): node is Jsep.Literal { /* ... */ return isJsepExpression(node) && node.type === 'Literal' && typeof (node as Jsep.Literal).value !== 'undefined'; }
function isJsepCallExpression(node: any): node is Jsep.CallExpression { /* ... */ return isJsepExpression(node) && node.type === 'CallExpression' && !!(node as Jsep.CallExpression).callee && Array.isArray((node as Jsep.CallExpression).arguments); }
function findTermIndices(content: string, term: string | RegExp, caseSensitive: boolean, isRegex: boolean): number[] { /* ... */ const indices: number[] = []; if (!term) return indices; if (isRegex && term instanceof RegExp) { const regex = new RegExp(term.source, term.flags.includes('g') ? term.flags : term.flags + 'g'); let match; while ((match = regex.exec(content)) !== null) { indices.push(match.index); if (match.index === regex.lastIndex) { regex.lastIndex++; } } } else if (typeof term === 'string') { const searchTerm = caseSensitive ? term : term.toLowerCase(); const searchContent = caseSensitive ? content : content.toLowerCase(); let i = -1; while ((i = searchContent.indexOf(searchTerm, i + 1)) !== -1) { indices.push(i); } } return indices; }
interface WordBoundary { word: string; start: number; end: number; }
function getWordBoundaries(content: string): WordBoundary[] { /* ... */ const boundaries: WordBoundary[] = []; const wordRegex = /\b[a-zA-Z0-9]+\b/g; let match; while ((match = wordRegex.exec(content)) !== null) { boundaries.push({ word: match[0], start: match.index, end: match.index + match[0].length -1 }); } return boundaries; }
const wordBoundariesCache = new Map<string, WordBoundary[]>();
function getWordIndexFromCharIndex(charIndex: number, content: string): number { /* ... */ let boundaries = wordBoundariesCache.get(content); if (!boundaries) { boundaries = getWordBoundaries(content); wordBoundariesCache.set(content, boundaries); } for (let i = 0; i < boundaries.length; i++) { if (charIndex >= boundaries[i].start && charIndex <= boundaries[i].end) { return i; } } for (let i = boundaries.length - 1; i >= 0; i--) { if (boundaries[i].end < charIndex) { if (/^\s*$/.test(content.substring(boundaries[i].end + 1, charIndex + 1))) { return i; } break; } } return -1; }
function evaluateBooleanAst(node: Jsep.Expression | unknown, content: string, caseSensitive: boolean): boolean { /* ... */ if (!isJsepExpression(node)) { console.warn("evaluateBooleanAst called with non-Expression node:", node); return false; } try { switch (node.type) { case 'LogicalExpression': if (!isJsepExpression(node.left) || !isJsepExpression(node.right)) { console.warn("LogicalExpression node missing valid left or right child", node); return false; } const leftResult = evaluateBooleanAst(node.left, content, caseSensitive); if (node.operator === 'OR' && leftResult) return true; if (node.operator === 'AND' && !leftResult) return false; const rightResult = evaluateBooleanAst(node.right, content, caseSensitive); return node.operator === 'OR' ? (leftResult || rightResult) : (leftResult && rightResult); case 'UnaryExpression': if (!isJsepExpression(node.argument)) { console.warn("UnaryExpression node missing valid argument", node); return false; } if (node.operator === 'NOT') { return !evaluateBooleanAst(node.argument, content, caseSensitive); } console.warn(`Unsupported unary operator: ${node.operator}`); return false; case 'Identifier': if (!isJsepIdentifier(node)) return false; const termIdentifierStr = node.name; const regexFromIdentifier = parseRegexLiteral(termIdentifierStr); if (regexFromIdentifier) { return regexFromIdentifier.test(content); } else { return caseSensitive ? content.includes(termIdentifierStr) : content.toLowerCase().includes(termIdentifierStr.toLowerCase()); } case 'Literal': if (!isJsepLiteral(node)) return false; if (typeof node.value === 'string') { const termLiteralStr = node.value; const regexFromLiteral = parseRegexLiteral(termLiteralStr); if (regexFromLiteral) { return regexFromLiteral.test(content); } else { return caseSensitive ? content.includes(termLiteralStr) : content.toLowerCase().includes(termLiteralStr.toLowerCase()); } } if (typeof node.value === 'boolean') { return node.value; } if (typeof node.value === 'number') { console.warn(`Numeric literal ${node.value} encountered outside NEAR function.`); return false; } console.warn(`Unsupported literal type: ${typeof node.value}`); return false; case 'CallExpression': if (!isJsepCallExpression(node)) { console.warn("Node is not a valid CallExpression:", node); return false; } if (!isJsepIdentifier(node.callee) || node.callee.name !== 'NEAR') { console.warn(`Unsupported function call: ${isJsepIdentifier(node.callee) ? node.callee.name : 'unknown'}`); return false; } if (node.arguments.length !== 3) { console.warn(`NEAR function requires exactly 3 arguments (term1, term2, distance), got ${node.arguments.length}`); return false; } const arg1Node = node.arguments[0]; const arg2Node = node.arguments[1]; const arg3Node = node.arguments[2]; let term1: string | RegExp | null = null; let term1IsRegex = false; if (isJsepLiteral(arg1Node) && typeof arg1Node.value === 'string') { const valueStr = arg1Node.value; term1 = parseRegexLiteral(valueStr) || valueStr; term1IsRegex = term1 instanceof RegExp; } else if (isJsepIdentifier(arg1Node)) { const nameStr = arg1Node.name; term1 = parseRegexLiteral(nameStr) || nameStr; term1IsRegex = term1 instanceof RegExp; } let term2: string | RegExp | null = null; let term2IsRegex = false; if (isJsepLiteral(arg2Node) && typeof arg2Node.value === 'string') { const valueStr = arg2Node.value; term2 = parseRegexLiteral(valueStr) || valueStr; term2IsRegex = term2 instanceof RegExp; } else if (isJsepIdentifier(arg2Node)) { const nameStr = arg2Node.name; term2 = parseRegexLiteral(nameStr) || nameStr; term2IsRegex = term2 instanceof RegExp; } let distance: number | null = null; if (isJsepLiteral(arg3Node) && typeof arg3Node.value === 'number' && arg3Node.value >= 0) { distance = Math.floor(arg3Node.value); } if (term1 === null || term2 === null || distance === null) { console.warn(`Invalid arguments for NEAR function. term1: ${term1}, term2: ${term2}, distance: ${distance}`); return false; } const indices1 = findTermIndices(content, term1, term1IsRegex ? false : caseSensitive, term1IsRegex); const indices2 = findTermIndices(content, term2, term2IsRegex ? false : caseSensitive, term2IsRegex); if (indices1.length === 0 || indices2.length === 0) { return false; } if (!wordBoundariesCache.has(content)) { wordBoundariesCache.set(content, getWordBoundaries(content)); } for (const index1 of indices1) { const wordIndex1 = getWordIndexFromCharIndex(index1, content); if (wordIndex1 === -1) continue; for (const index2 of indices2) { const wordIndex2 = getWordIndexFromCharIndex(index2, content); if (wordIndex2 === -1) continue; if (Math.abs(wordIndex1 - wordIndex2) <= distance) { return true; } } } return false; default: console.warn(`Unsupported AST node type: ${(node as Jsep.Expression).type}`); return false; } } catch (evalError) { console.error("Error during boolean AST evaluation:", evalError, "Node:", node); wordBoundariesCache.delete(content); return false; } }
// ----------------------------------------------------

// --- Main Search Function ---
export async function searchFiles(
  params: SearchParams,
  progressCallback: ProgressCallback,
  checkCancellation: CancellationChecker, // Add cancellation checker
): Promise<SearchResult> {
  const {
    searchPaths, extensions, excludeFiles, excludeFolders,
    folderExclusionMode = 'contains', contentSearchTerm,
    contentSearchMode = 'term', caseSensitive = false,
    modifiedAfter, modifiedBefore, minSizeBytes, maxSizeBytes, maxDepth,
  } = params;

  const pathErrors: string[] = [];
  const fileReadErrors: FileReadError[] = [];
  const structuredItems: StructuredItem[] = [];
  const outputLines: string[] = [];
  let wasCancelled = false; // Cancellation flag for this specific search

  // --- Initialize p-limit ---
  if (typeof pLimit !== 'function') { /* ... error handling ... */ console.error("pLimit was not loaded correctly. Type:", typeof pLimit, "Value:", pLimit); pathErrors.push("Internal error: Concurrency limiter failed to load."); return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors }; }
  const limit = pLimit(FILE_OPERATION_CONCURRENCY_LIMIT);

  // --- 1. Initial File Discovery ---
  progressCallback({ processed: 0, total: 0, message: "Scanning directories...", status: 'searching' });
  const includePatterns = extensions.map((ext) => `**/*.${ext.replace(/^\./, "")}`);
  const allFoundFiles = new Set<string>();
  let initialFileCount = 0;
  const globDepth = (maxDepth && maxDepth > 0) ? maxDepth : Infinity;
  console.log(`Using glob depth: ${globDepth}`);

  try {
    // Check for cancellation before starting potentially long glob operations
    if (checkCancellation()) {
        wasCancelled = true;
        progressCallback({ processed: 0, total: 0, message: "Search cancelled before file discovery.", status: 'cancelled' });
        return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled };
    }

    await Promise.all(searchPaths.map(async (searchPath) => {
      // Check cancellation inside the loop too
      if (checkCancellation()) { wasCancelled = true; return; }
      const normalizedPath = searchPath.replace(/\\/g, "/");
      try { /* ... stat check ... */ const stats = await fs.stat(searchPath); if (!stats.isDirectory()) { const errorMsg = `Search path is not a directory: ${searchPath}`; console.warn(errorMsg); pathErrors.push(errorMsg); progressCallback({ processed: 0, total: 0, message: `Skipping non-directory: ${searchPath}`, status: 'searching' }); return; } }
      catch (statError: any) { /* ... error handling ... */ let errorMsg = `Error accessing search path: ${searchPath}`; let reason = "Access Error"; if (statError.code === 'ENOENT') { reason = "Path Not Found"; errorMsg = `Search path not found: ${searchPath}`; } else if (statError.code === 'EACCES' || statError.code === 'EPERM') { reason = "Permission Denied"; errorMsg = `Permission denied for search path: ${searchPath}`; } else { errorMsg = `Error accessing search path: ${searchPath} - ${statError.message}`; } console.warn(`Path Error (${reason}): ${errorMsg}`, statError); pathErrors.push(errorMsg); progressCallback({ processed: 0, total: 0, message: `Cannot access path: ${searchPath}`, error: statError.message, status: 'error' }); return; }
      // Check cancellation again before the glob itself
      if (checkCancellation()) { wasCancelled = true; return; }
      const found = await fg(includePatterns, { cwd: normalizedPath, absolute: true, onlyFiles: true, dot: true, stats: false, suppressErrors: true, deep: globDepth });
      // Check cancellation after glob returns, before adding files
      if (checkCancellation()) { wasCancelled = true; return; }
      found.forEach((file) => allFoundFiles.add(file.replace(/\\/g, "/")));
    }));

    // If cancelled during the loop, exit early
    if (wasCancelled) {
        progressCallback({ processed: 0, total: 0, message: "Search cancelled during file discovery.", status: 'cancelled' });
        return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled };
    }

    initialFileCount = allFoundFiles.size;
    progressCallback({ processed: 0, total: initialFileCount, message: `Found ${initialFileCount} potential files (depth limit: ${globDepth === Infinity ? 'none' : globDepth}). Filtering...`, status: 'searching' });
  } catch (error: any) { /* ... error handling ... */ console.error("Error during file discovery:", error); const errorMsg = `Unexpected error during file search: ${error.message}`; pathErrors.push(errorMsg); progressCallback({ processed: 0, total: 0, message: errorMsg, error: error.message, status: 'error' }); return { output: "", structuredItems: [], filesFound: 0, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors }; }

  const initialFiles = Array.from(allFoundFiles);
  let filesToProcess: string[] = initialFiles;
  let currentTotal = initialFileCount;
  // ---------------------------------------------

  // --- Filtering Stages (Add cancellation checks) ---
  // Check before each potentially long filter stage
  if (checkCancellation()) { wasCancelled = true; /* return cancelled result */ progressCallback({ processed: 0, total: currentTotal, message: "Search cancelled before filtering.", status: 'cancelled' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled }; }

  // --- 2. File Exclusion Filter ---
  if (excludeFiles && excludeFiles.length > 0 && filesToProcess.length > 0) { /* ... filter logic ... */ progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded file patterns...`, status: 'searching' }); filesToProcess = filesToProcess.filter((filePath) => { const filename = path.basename(filePath); const isExcluded = excludeFiles.some((pattern) => { const regex = parseRegexLiteral(pattern); if (regex) return regex.test(filename); return picomatch.isMatch(filename, pattern, { dot: true }); }); return !isExcluded; }); currentTotal = filesToProcess.length; progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after file exclusion.`, status: 'searching' }); }
  if (checkCancellation()) { wasCancelled = true; /* return cancelled result */ progressCallback({ processed: 0, total: currentTotal, message: "Search cancelled after file exclusion filter.", status: 'cancelled' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled }; }

  // --- 3. Folder Exclusion Filter ---
  if (excludeFolders && excludeFolders.length > 0 && filesToProcess.length > 0) { /* ... filter logic ... */ progressCallback({ processed: 0, total: currentTotal, message: `Filtering by excluded folder patterns (${folderExclusionMode})...`, status: 'searching' }); const picoOptions = { dot: true, nocase: true }; const folderMatchers = excludeFolders.map(pattern => { let matchPattern = pattern; switch (folderExclusionMode) { case 'startsWith': matchPattern = pattern + '*'; break; case 'endsWith': matchPattern = '*' + pattern; break; case 'contains': if (!pattern.includes('*') && !pattern.includes('?')) matchPattern = '*' + pattern + '*'; break; case 'exact': default: break; } return picomatch(matchPattern, picoOptions); }); filesToProcess = filesToProcess.filter((filePath) => { const dirPath = path.dirname(filePath); const segments = dirPath.split(/[\\/]/).filter(Boolean); const isExcluded = folderMatchers.some(isMatch => segments.some(segment => isMatch(segment))); return !isExcluded; }); currentTotal = filesToProcess.length; progressCallback({ processed: 0, total: currentTotal, message: `Filtered ${currentTotal} files after folder exclusion.`, status: 'searching' }); }
  if (checkCancellation()) { wasCancelled = true; /* return cancelled result */ progressCallback({ processed: 0, total: currentTotal, message: "Search cancelled after folder exclusion filter.", status: 'cancelled' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled }; }

  // --- 4. Stat-Based Filtering ---
  const afterDate = parseDateStartOfDay(modifiedAfter);
  const beforeDate = parseDateEndOfDay(modifiedBefore);
  const hasSizeFilter = minSizeBytes !== undefined || maxSizeBytes !== undefined;
  const hasDateFilter = !!afterDate || !!beforeDate;
  if ((hasSizeFilter || hasDateFilter) && filesToProcess.length > 0) { /* ... filter logic ... */ const initialCountForStatFilter = filesToProcess.length; progressCallback({ processed: 0, total: initialCountForStatFilter, message: `Filtering ${initialCountForStatFilter} files by size/date (parallel)...`, status: 'searching' }); const statCheckPromises = filesToProcess.map((filePath) => limit(async () => { if (checkCancellation()) return null; try { const stats = await fs.stat(filePath); const fileSize = stats.size; const mtime = stats.mtime; const passSizeCheck = !hasSizeFilter || ((minSizeBytes === undefined || fileSize >= minSizeBytes) && (maxSizeBytes === undefined || fileSize <= maxSizeBytes)); const passDateCheck = !hasDateFilter || ((!afterDate || mtime.getTime() >= afterDate.getTime()) && (!beforeDate || mtime.getTime() <= beforeDate.getTime())); return passSizeCheck && passDateCheck ? filePath : null; } catch (statError: any) { console.warn(`Could not get stats for file during size/date filter: ${filePath}`, statError); return null; } })); const statResults = await Promise.all(statCheckPromises); if (checkCancellation()) { wasCancelled = true; /* return cancelled result */ progressCallback({ processed: initialCountForStatFilter, total: initialCountForStatFilter, message: "Search cancelled during size/date filter.", status: 'cancelled' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled }; } filesToProcess = statResults.filter((result): result is string => result !== null); currentTotal = filesToProcess.length; progressCallback({ processed: initialCountForStatFilter, total: initialCountForStatFilter, message: `Filtered ${currentTotal} files after size/date check.`, status: 'searching' }); }
  if (checkCancellation()) { wasCancelled = true; /* return cancelled result */ progressCallback({ processed: 0, total: currentTotal, message: "Search cancelled after size/date filter.", status: 'cancelled' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled }; }
  // ---------------------------------------------

  // --- 5. Read Content, Filter by Content, and Format Output ---
  let filesProcessedCounter = 0;
  const totalFilesToProcess = filesToProcess.length;
  let contentMatcher: ((content: string) => boolean) | null = null;
  let parseOrRegexError = false;

  if (contentSearchTerm) { /* ... setup contentMatcher ... */ switch (contentSearchMode) { case 'regex': const flags = caseSensitive ? '' : 'i'; const regex = createSafeRegex(contentSearchTerm, flags); if (regex) { contentMatcher = (content) => regex.test(content); } else { parseOrRegexError = true; const errorMsg = `Invalid regular expression pattern: ${contentSearchTerm}`; pathErrors.push(errorMsg); progressCallback({ processed: 0, total: 0, message: errorMsg, error: "Invalid Regex", status: 'error' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors }; } break; case 'boolean': try { if (jsep.binary_ops['||']) jsep.removeBinaryOp('||'); if (jsep.binary_ops['&&']) jsep.removeBinaryOp('&&'); if (jsep.unary_ops['!']) jsep.removeUnaryOp('!'); if (!jsep.binary_ops['AND']) jsep.addBinaryOp('AND', 1); if (!jsep.binary_ops['OR']) jsep.addBinaryOp('OR', 0); if (!jsep.unary_ops['NOT']) jsep.addUnaryOp('NOT'); const parsedAst = jsep(contentSearchTerm); console.log("Parsed Boolean AST:", JSON.stringify(parsedAst, null, 2)); contentMatcher = (content) => { wordBoundariesCache.delete(content); const result = evaluateBooleanAst(parsedAst, content, caseSensitive); return result; }; } catch (parseError: any) { parseOrRegexError = true; let errorDetail = parseError.message || 'Unknown parsing error'; if (typeof parseError.index === 'number') { errorDetail += ` near character ${parseError.index + 1}`; } const errorMsg = `Invalid boolean query syntax: ${errorDetail}`; pathErrors.push(errorMsg); progressCallback({ processed: 0, total: 0, message: errorMsg, error: "Invalid Boolean Query", status: 'error' }); return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors }; } break; case 'term': default: if (caseSensitive) { contentMatcher = (content) => content.includes(contentSearchTerm); } else { const searchTermLower = contentSearchTerm.toLowerCase(); contentMatcher = (content) => content.toLowerCase().includes(searchTermLower); } break; } }

  if (totalFilesToProcess > 0 && !parseOrRegexError) {
    progressCallback({ processed: 0, total: totalFilesToProcess, message: `Processing ${totalFilesToProcess} files (parallel)...`, status: 'searching' });
  } else if (pathErrors.length === 0 && !parseOrRegexError) {
    progressCallback({ processed: 0, total: 0, message: `No files to process after filtering.`, status: 'completed' });
  }

  // --- Parallel Processing Loop ---
  if (!parseOrRegexError) {
      // Check for cancellation before starting the main loop
      if (checkCancellation()) {
          wasCancelled = true;
          progressCallback({ processed: 0, total: totalFilesToProcess, message: "Search cancelled before processing files.", status: 'cancelled' });
          // Return potentially partially filtered results if needed, or empty
          return { output: "", structuredItems: [], filesFound: initialFileCount, filesProcessed: 0, errorsEncountered: 0, pathErrors, fileReadErrors, wasCancelled };
      }

      const processingPromises = filesToProcess.map((file) =>
        limit(async () => {
          // Check cancellation at the start of each task
          if (checkCancellation()) {
              // Don't increment counter, just return null to signal skip
              return null;
          }

          const currentFileName = path.basename(file);
          const displayFilePath = file.replace(/\\/g, "/");
          let fileContent: string | null = null;
          let structuredItemResult: StructuredItem | null = null;
          let outputLineResult: string | null = null;
          let fileReadErrorResult: FileReadError | null = null;
          let errorKeyForProgress: string | undefined = undefined;
          let incrementCounter = true; // Flag to control counter increment

          try {
            // Check cancellation *again* right before the expensive file read
            if (checkCancellation()) {
                incrementCounter = false; // Don't count this file as processed
                return null; // Skip processing
            }

            fileContent = await fs.readFile(file, { encoding: "utf8" });
            const contentMatches = !contentMatcher || contentMatcher(fileContent);

            if (contentMatches) {
              outputLineResult = `${displayFilePath}\n\n${fileContent}\n`;
              structuredItemResult = { filePath: displayFilePath, content: fileContent, readError: undefined };
            } else {
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
            if (fileContent !== null) {
                wordBoundariesCache.delete(fileContent);
            }
            // Only increment and report progress if not cancelled before processing
            if (incrementCounter) {
                filesProcessedCounter++;
                // Check cancellation one last time before sending progress
                const cancelled = checkCancellation();
                progressCallback({
                  processed: filesProcessedCounter,
                  total: totalFilesToProcess,
                  currentFile: currentFileName,
                  message: errorKeyForProgress ? `Error: ${currentFileName}` : (cancelled ? 'Cancelling...' : `Processed: ${currentFileName}`),
                  error: errorKeyForProgress,
                  status: cancelled ? 'cancelling' : 'searching', // Update status
                });
            }
          }
          // Return null if cancelled during processing, otherwise return results
          return checkCancellation() ? null : { structuredItemResult, outputLineResult, fileReadErrorResult };
        })
      );

      const resultsFromPromises = await Promise.all(processingPromises);

      // Check cancellation status *after* all promises settle
      wasCancelled = checkCancellation();

      // Aggregate results, skipping nulls (cancelled tasks)
      resultsFromPromises.forEach(result => {
        if (result) { // Only process non-null results
            if (result.structuredItemResult) { structuredItems.push(result.structuredItemResult); }
            if (result.outputLineResult) { outputLines.push(result.outputLineResult); }
            if (result.fileReadErrorResult) { fileReadErrors.push(result.fileReadErrorResult); }
        }
      });
  }
  // -----------------------------

  const finalStatus = wasCancelled ? 'cancelled' : 'completed';
  progressCallback({
    processed: filesProcessedCounter,
    total: totalFilesToProcess,
    message: wasCancelled ? `Search cancelled after processing ${filesProcessedCounter} files.` : `Finished processing ${filesProcessedCounter} files.`,
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
    wasCancelled: wasCancelled, // Include cancellation status in result
  };
}
