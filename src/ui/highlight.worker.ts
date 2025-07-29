// --- Enhanced Highlight Worker with Pool Support ---
// Import the core library for syntax highlighting
import hljs from "highlight.js/lib/core";

// Import essential languages that are always loaded
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml"; // For HTML too
import python from "highlight.js/lib/languages/python";
import plaintext from "highlight.js/lib/languages/plaintext";

// Enhanced cache interface with access tracking
interface CacheEntry {
  html: string;
  timestamp: number;
  size: number;
  accessCount: number;
  priority: "high" | "medium" | "low";
}

const highlightCache = new Map<string, CacheEntry>();

// Enhanced configuration
const MAX_CACHE_SIZE = 300; // Increased cache size for better performance
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds
const CHUNK_SIZE = 15000; // Characters per chunk for large files
const LARGE_FILE_THRESHOLD = 50000; // Threshold for chunked processing

// Register essential languages immediately
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("log", plaintext);
hljs.registerLanguage("txt", plaintext);
hljs.registerLanguage("plaintext", plaintext);

// Lazy language loaders for additional languages
const languageLoaders = {
  java: () => import("highlight.js/lib/languages/java"),
  csharp: () => import("highlight.js/lib/languages/csharp"),
  rust: () => import("highlight.js/lib/languages/rust"),
  go: () => import("highlight.js/lib/languages/go"),
  php: () => import("highlight.js/lib/languages/php"),
  ruby: () => import("highlight.js/lib/languages/ruby"),
  swift: () => import("highlight.js/lib/languages/swift"),
  kotlin: () => import("highlight.js/lib/languages/kotlin"),
  scala: () => import("highlight.js/lib/languages/scala"),
  cpp: () => import("highlight.js/lib/languages/cpp"),
  c: () => import("highlight.js/lib/languages/c"),
  shell: () => import("highlight.js/lib/languages/shell"),
  bash: () => import("highlight.js/lib/languages/bash"),
  powershell: () => import("highlight.js/lib/languages/powershell"),
  sql: () => import("highlight.js/lib/languages/sql"),
  yaml: () => import("highlight.js/lib/languages/yaml"),
  dockerfile: () => import("highlight.js/lib/languages/dockerfile"),
  markdown: () => import("highlight.js/lib/languages/markdown"),
  lua: () => import("highlight.js/lib/languages/lua"),
  perl: () => import("highlight.js/lib/languages/perl"),
  r: () => import("highlight.js/lib/languages/r"),
  matlab: () => import("highlight.js/lib/languages/matlab"),
  haskell: () => import("highlight.js/lib/languages/haskell"),
  elixir: () => import("highlight.js/lib/languages/elixir"),
  erlang: () => import("highlight.js/lib/languages/erlang"),
  clojure: () => import("highlight.js/lib/languages/clojure"),
  dart: () => import("highlight.js/lib/languages/dart"),
  vim: () => import("highlight.js/lib/languages/vim"),
  ini: () => import("highlight.js/lib/languages/ini"),
  properties: () => import("highlight.js/lib/languages/properties"),
  makefile: () => import("highlight.js/lib/languages/makefile"),
  cmake: () => import("highlight.js/lib/languages/cmake"),
  apache: () => import("highlight.js/lib/languages/apache"),
  diff: () => import("highlight.js/lib/languages/diff"),
  patch: () => import("highlight.js/lib/languages/diff"), // Use diff for patch files
};

// --- Enhanced Helper Functions ---
/**
 * Fallback synchronous cache key for when crypto is not available
 */
function getCacheKeySync(
  code: string,
  language: string,
  theme?: string
): string {
  // FNV-1a hash implementation
  let hash = 2166136261;
  const input = `${language}:${theme || "default"}:${code.length}:${code.substring(0, 500)}${code.substring(code.length - 500)}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash.toString(16);
}

/**
 * Load a language definition dynamically
 */
async function loadLanguage(language: string): Promise<boolean> {
  // Check if language is already registered
  if (hljs.getLanguage(language)) {
    return true;
  }

  // Check if we have a loader for this language
  const loader = languageLoaders[language as keyof typeof languageLoaders];
  if (!loader) {
    return false;
  }

  try {
    const langModule = await loader();
    hljs.registerLanguage(language, langModule.default);
    console.log(`[Highlight Worker] Loaded language: ${language}`);
    return true;
  } catch (error) {
    console.error(
      "[Highlight Worker] Failed to load language:",
      language,
      error
    );
    return false;
  }
}

// Extension to language mapping
const EXTENSION_MAP: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  jsx: "jsx",
  ts: "typescript",
  tsx: "tsx",
  py: "python",
  pyw: "python",
  java: "java",
  cs: "csharp",
  rs: "rust",
  go: "go",
  php: "php",
  rb: "ruby",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  cpp: "cpp",
  cxx: "cpp",
  cc: "cpp",
  c: "c",
  h: "c",
  hpp: "cpp",
  sh: "shell",
  bash: "bash",
  zsh: "shell",
  fish: "shell",
  ps1: "powershell",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  css: "css",
  scss: "css",
  sass: "css",
  less: "css",
  html: "html",
  htm: "html",
  xml: "xml",
  dockerfile: "dockerfile",
  md: "markdown",
  markdown: "markdown",
  lua: "lua",
  pl: "perl",
  r: "r",
  m: "matlab",
  hs: "haskell",
  ex: "elixir",
  exs: "elixir",
  erl: "erlang",
  clj: "clojure",
  dart: "dart",
  vim: "vim",
  ini: "ini",
  cfg: "ini",
  conf: "ini",
  properties: "properties",
  makefile: "makefile",
  cmake: "cmake",
  diff: "diff",
  patch: "patch",
  log: "log",
  txt: "txt",
};

/**
 * Detect language from file extension
 */
function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();

  return EXTENSION_MAP[ext || ""] || "plaintext";
}

/**
 * Enhanced cache maintenance with priority-based eviction
 */
function maintainCache(): void {
  const now = Date.now();

  // First, remove expired entries
  for (const [key, entry] of highlightCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      highlightCache.delete(key);
    }
  }

  // If still over size limit, use smart eviction
  if (highlightCache.size > MAX_CACHE_SIZE) {
    const entries = Array.from(highlightCache.entries());

    // Sort by priority and access patterns (low priority, old, less accessed first)
    entries.sort((a, b) => {
      const [, entryA] = a;
      const [, entryB] = b;

      // Priority weight
      const priorityWeight = { low: 0, medium: 1, high: 2 };
      const priorityDiff =
        priorityWeight[entryA.priority] - priorityWeight[entryB.priority];
      if (priorityDiff !== 0) return priorityDiff;

      // Access count weight
      const accessDiff = entryA.accessCount - entryB.accessCount;
      if (accessDiff !== 0) return accessDiff;

      // Timestamp weight (older first)
      return entryA.timestamp - entryB.timestamp;
    });

    // Remove entries until we're under 80% of max size
    const targetSize = Math.floor(MAX_CACHE_SIZE * 0.8);
    const entriesToRemove = highlightCache.size - targetSize;

    entries.slice(0, entriesToRemove).forEach(([key]) => {
      highlightCache.delete(key);
    });
  }
}
/**
 * Language-specific configuration for chunking
 */
interface LanguageChunkConfig {
  contextBufferSize: number;
  safeBreakPatterns: RegExp[];
  stringDelimiters: string[];
  commentPatterns: {
    single?: string[];
    multi?: Array<{ start: string; end: string }>;
  };
  avoidBreakInPatterns: RegExp[];
}

/**
 * Get language-specific chunking configuration
 */
function getLanguageChunkConfig(language: string): LanguageChunkConfig {
  const configs: Record<string, LanguageChunkConfig> = {
    javascript: {
      contextBufferSize: 500,
      safeBreakPatterns: [
        /\n\s*(?:function|class|const|let|var|if|for|while|switch|try)\s/,
        /\n\s*\/\/.*\n/,
        /\n\s*\/\*[\s\S]*?\*\/\s*\n/,
        /\n\s*}\s*\n/,
        /\n\s*;\s*\n/,
      ],
      stringDelimiters: ['"', "'", "`"],
      commentPatterns: {
        single: ["//"],
        multi: [{ start: "/*", end: "*/" }],
      },
      avoidBreakInPatterns: [
        /`[\s\S]*?`/g, // Template literals
        /"(?:[^"\\]|\\.)*"/g, // Double quoted strings
        /'(?:[^'\\]|\\.)*'/g, // Single quoted strings
        /\/\*[\s\S]*?\*\//g, // Multi-line comments
        /\/\/.*$/gm, // Single line comments
        /\/(?:[^/\\\n]|\\.)+\/[gimuy]*/g, // Regular expressions
      ],
    },
    typescript: {
      contextBufferSize: 500,
      safeBreakPatterns: [
        /\n\s*(?:function|class|interface|type|const|let|var|if|for|while|switch|try|export|import)\s/,
        /\n\s*\/\/.*\n/,
        /\n\s*\/\*[\s\S]*?\*\/\s*\n/,
        /\n\s*}\s*\n/,
        /\n\s*;\s*\n/,
      ],
      stringDelimiters: ['"', "'", "`"],
      commentPatterns: {
        single: ["//"],
        multi: [{ start: "/*", end: "*/" }],
      },
      avoidBreakInPatterns: [
        /`[\s\S]*?`/g,
        /"(?:[^"\\]|\\.)*"/g,
        /'(?:[^'\\]|\\.)*'/g,
        /\/\*[\s\S]*?\*\//g,
        /\/\/.*$/gm,
        /\/(?:[^/\\\n]|\\.)+\/[gimuy]*/g,
      ],
    },
    python: {
      contextBufferSize: 300,
      safeBreakPatterns: [
        /\n(?:def|class|if|for|while|try|with|import|from)\s/,
        /\n#.*\n/,
        /\n\s*\n/,
      ],
      stringDelimiters: ['"', "'"],
      commentPatterns: {
        single: ["#"],
      },
      avoidBreakInPatterns: [
        /"""[\s\S]*?"""/g, // Triple double quotes
        /'''[\s\S]*?'''/g, // Triple single quotes
        /"(?:[^"\\]|\\.)*"/g,
        /'(?:[^'\\]|\\.)*'/g,
        /#.*$/gm,
      ],
    },
    css: {
      contextBufferSize: 200,
      safeBreakPatterns: [
        /\n\s*[.#@][\w-]+\s*\{/,
        /\n\s*}\s*\n/,
        /\n\s*\/\*[\s\S]*?\*\/\s*\n/,
      ],
      stringDelimiters: ['"', "'"],
      commentPatterns: {
        multi: [{ start: "/*", end: "*/" }],
      },
      avoidBreakInPatterns: [
        /\/\*[\s\S]*?\*\//g,
        /"(?:[^"\\]|\\.)*"/g,
        /'(?:[^'\\]|\\.)*'/g,
      ],
    },
    html: {
      contextBufferSize: 300,
      safeBreakPatterns: [
        /\n\s*<\/?\w+[^>]*>\s*\n/,
        /\n\s*<!--[\s\S]*?-->\s*\n/,
      ],
      stringDelimiters: ['"', "'"],
      commentPatterns: {
        multi: [{ start: "<!--", end: "-->" }],
      },
      avoidBreakInPatterns: [
        /<!--[\s\S]*?-->/g,
        /<[^>]*>/g,
        /"(?:[^"\\]|\\.)*"/g,
        /'(?:[^'\\]|\\.)*'/g,
      ],
    },
  };

  // Default configuration for unknown languages
  const defaultConfig: LanguageChunkConfig = {
    contextBufferSize: 200,
    safeBreakPatterns: [/\n\s*\n/], // Empty lines
    stringDelimiters: ['"', "'"],
    commentPatterns: {},
    avoidBreakInPatterns: [],
  };

  return configs[language] || configs[language.split("-")[0]] || defaultConfig;
}

/**
 * Find a safe boundary for chunking that doesn't break syntax constructs
 */
function findSafeBoundary(
  code: string,
  idealPosition: number,
  config: LanguageChunkConfig,
  searchRadius: number = 1000
): number {
  const start = Math.max(0, idealPosition - searchRadius);
  const end = Math.min(code.length, idealPosition + searchRadius);
  const searchArea = code.substring(start, end);

  // First, try to find a safe break pattern
  for (const pattern of config.safeBreakPatterns) {
    const matches = Array.from(searchArea.matchAll(pattern));
    if (matches.length > 0) {
      // Find the match closest to our ideal position
      let bestMatch = matches[0];
      let bestDistance = Math.abs(
        start + (bestMatch.index ?? 0) - idealPosition
      );

      for (const match of matches) {
        const distance = Math.abs(start + (match.index ?? 0) - idealPosition);
        if (distance < bestDistance) {
          bestMatch = match;
          bestDistance = distance;
        }
      }

      return start + (bestMatch.index ?? 0) + bestMatch[0].length;
    }
  }

  // If no safe pattern found, look for line boundaries that don't break constructs
  const lines = searchArea.split("\n");
  let currentPos = start;
  let bestBoundary = idealPosition;
  let bestDistance = Infinity;

  for (let i = 0; i < lines.length - 1; i++) {
    currentPos += lines[i].length + 1; // +1 for newline
    const distance = Math.abs(currentPos - idealPosition);

    if (distance < bestDistance) {
      // Check if this position would break any constructs
      const beforeContext = code.substring(
        Math.max(0, currentPos - 100),
        currentPos
      );
      const afterContext = code.substring(
        currentPos,
        Math.min(code.length, currentPos + 100)
      );

      let wouldBreakConstruct = false;
      for (const pattern of config.avoidBreakInPatterns) {
        pattern.lastIndex = 0; // Reset regex state
        const combined = beforeContext + afterContext;
        const matches = Array.from(combined.matchAll(pattern));

        for (const match of matches) {
          const matchStart = match.index ?? 0;
          const matchEnd = matchStart + match[0].length;
          const breakPoint = beforeContext.length;

          if (matchStart < breakPoint && matchEnd > breakPoint) {
            wouldBreakConstruct = true;
            break;
          }
        }

        if (wouldBreakConstruct) break;
      }

      if (!wouldBreakConstruct) {
        bestBoundary = currentPos;
        bestDistance = distance;
      }
    }
  }

  console.debug(`[Highlight Worker] Safe boundary: ideal=${idealPosition}, found=${bestBoundary}, distance=${Math.abs(bestBoundary - idealPosition)}`);
  return bestBoundary;
}

/**
 * Enhanced chunked processing with syntax-aware boundaries and context preservation
 */
function processInChunks(
  code: string,
  language: string,
  filePath: string,
  _theme?: string
): string {
  const config = getLanguageChunkConfig(language);
  const chunks: string[] = [];
  let processedChunks = 0;

  // Calculate total chunks more accurately with overlapping
  const effectiveChunkSize = CHUNK_SIZE - config.contextBufferSize;
  const totalChunks = Math.ceil(code.length / effectiveChunkSize);

  let position = 0;

  while (position < code.length) {
    try {
      // Determine chunk boundaries
      const idealEnd = Math.min(position + CHUNK_SIZE, code.length);
      let chunkEnd = idealEnd;

      // Find safe boundary if not at end of file
      if (idealEnd < code.length) {
        chunkEnd = findSafeBoundary(code, idealEnd, config);
      }

      // Include context buffer from previous chunk
      const contextStart = Math.max(0, position - config.contextBufferSize);
      const chunkWithContext = code.substring(contextStart, chunkEnd);
      const actualChunkStart = position - contextStart;

      // Highlight the chunk with context
      const result = hljs.highlight(chunkWithContext, {
        language,
        ignoreIllegals: true,
      });

      // Extract only the new content (excluding context buffer)
      const highlightedHtml = result.value;

      // Parse the HTML to extract only the portion we want
      // This is a simplified approach - in a full implementation,
      // we'd need more sophisticated HTML parsing
      const newContentHtml = extractNewContentFromHighlighted(
        highlightedHtml,
        actualChunkStart,
        chunkWithContext.length
      );

      chunks.push(newContentHtml);
      processedChunks++;

      // Send progress updates for very large files
      if (totalChunks > 10 && processedChunks % 5 === 0) {
        self.postMessage({
          filePath,
          status: "partial",
          progress: processedChunks / totalChunks,
          partialHtml: chunks.join(""),
        });
      }

      // Update position for next chunk
      position = chunkEnd;
    } catch (error) {
      console.error(
        `[Highlight Worker] Error processing chunk ${processedChunks}:`,
        error
      );

      // Fallback: process remaining content as plaintext
      const remainingCode = code.substring(position);
      chunks.push(remainingCode);
      break;
    }
  }

  return chunks.join("");
}

/**
 * Extract new content from highlighted HTML, excluding context buffer
 * This implementation properly handles HTML tags while extracting the correct character range
 */
function extractNewContentFromHighlighted(
  highlightedHtml: string,
  startOffset: number,
  _totalLength: number
): string {
  if (startOffset === 0) {
    return highlightedHtml;
  }

  // Validate input HTML structure
  if (!highlightedHtml.startsWith("<")) {
    console.warn('[Highlight Worker] Invalid HTML: Does not start with a tag, falling back to substring');
    return highlightedHtml.substring(startOffset);
  }

  // Parse HTML and track character positions
  let plainTextPos = 0;
  let htmlPos = 0;
  let result = "";
  let inTag = false;
  let collecting = false;

  while (htmlPos < highlightedHtml.length) {
    const char = highlightedHtml[htmlPos];

    if (char === "<") {
      inTag = true;
      if (collecting) {
        result += char;
      }
    } else if (char === ">") {
      inTag = false;
      if (collecting) {
        result += char;
      }
    } else if (inTag) {
      // Inside a tag - don't count towards plain text position
      if (collecting) {
        result += char;
      }
    } else {
      // Regular character - count towards plain text position
      if (plainTextPos >= startOffset) {
        if (!collecting) {
          collecting = true;
          // Include any pending tag content that we might have missed
          // This is a simplified approach - a more robust implementation
          // would track tag boundaries more carefully
        }
        result += char;
      }
      plainTextPos++;
    }

    htmlPos++;
  }

  return result;
}
/**
 * Apply theme-specific classes and enhanced accessibility attributes
 */
function enhanceHighlightedHtml(
  html: string,
  language: string,
  theme?: string,
  filePath?: string
): string {
  // Count lines for accessibility
  const totalLines = (html.match(/\n/g) || []).length + 1;

  // Extract filename from path
  const fileName = filePath
    ? filePath.split("/").pop() || filePath.split("\\").pop()
    : undefined;

  // Create comprehensive accessibility wrapper
  const sanitizedLanguage = language.replace(/[^a-zA-Z0-9\-_]/g, '');
  const ariaLabel = `Code block in ${sanitizedLanguage}${fileName ? ` from ${fileName}` : ""}, ${totalLines} line${totalLines !== 1 ? "s" : ""}`;
  const themeClass = theme ? ` hljs-theme-${theme}` : "";

  // Enhanced accessibility wrapper
  let accessibleHtml = `<div role="region" aria-label="${ariaLabel}" class="hljs-enhanced${themeClass}" tabindex="0">`;

  // Add screen reader description
  const descId = `hljs-desc-${Math.random().toString(36).substring(2, 11)}`;
  const escapedFileName = fileName
    ? fileName.replace(
        /[<>&"'`]/g,
        (char) =>
          ({
            "<": "&lt;",
            ">": "&gt;",
            "&": "&amp;",
            '"': "&quot;",
            "'": "&#x27;",
            "`": "&#x60;",
          })[char] || char
      )
    : "";
  accessibleHtml += `<div id="${descId}" class="sr-only">This is a ${language} code block${escapedFileName ? ` from ${escapedFileName}` : ""} with ${totalLines} lines. Use arrow keys to navigate through the code.</div>`;

  // Main code content with enhanced tokens
  accessibleHtml += `<code role="note" aria-describedby="${descId}" class="hljs-content">`;
  accessibleHtml += enhanceTokensWithAccessibility(html, language);
  accessibleHtml += "</code>";

  // Keyboard navigation hints
  accessibleHtml += `<div class="hljs-keyboard-hints sr-only" role="note"><p>Keyboard navigation: Use Tab to focus, arrow keys to scroll, Escape to exit focus.</p></div>`;

  accessibleHtml += "</div>";

  return accessibleHtml;
}

/**
 * Enhance syntax tokens with accessibility information
 */
function enhanceTokensWithAccessibility(
  html: string,
  _language: string
): string {
  // Map of highlight.js classes to semantic descriptions
  const tokenDescriptions: Record<string, string> = {
    "hljs-keyword": "keyword",
    "hljs-string": "string literal",
    "hljs-number": "number",
    "hljs-comment": "comment",
    "hljs-function": "function",
    "hljs-class": "class",
    "hljs-variable": "variable",
    "hljs-type": "type",
    "hljs-built_in": "built-in function",
    "hljs-literal": "literal value",
    "hljs-tag": "HTML tag",
    "hljs-attribute": "attribute",
    "hljs-selector-tag": "CSS selector",
    "hljs-property": "CSS property",
    "hljs-title": "title or name",
    "hljs-meta": "metadata",
    "hljs-doctag": "documentation tag",
    "hljs-section": "section header",
    "hljs-name": "name",
    "hljs-symbol": "symbol",
    "hljs-bullet": "list bullet",
    "hljs-subst": "substitution",
    "hljs-template-variable": "template variable",
    "hljs-template-tag": "template tag",
    "hljs-addition": "added line",
    "hljs-deletion": "deleted line",
    "hljs-link": "link",
    "hljs-quote": "quote",
    "hljs-regexp": "regular expression",
  };

  // Add aria-label to significant tokens
  let enhancedHtml = html;

  Object.entries(tokenDescriptions).forEach(([className, description]) => {
    const regex = new RegExp(
      `<span class="([^"]*${className}[^"]*)"([^>]*)>`,
      "g"
    );
    enhancedHtml = enhancedHtml.replace(
      regex,
      (match: string, classes: string, attributes: string) => {
        // Only add aria-label if it doesn't already exist and the content is significant
        if (!attributes.includes("aria-label")) {
          return `<span class="${classes}" aria-label="${description}"${attributes}>`;
        }
        return match;
      }
    );
  });

  return enhancedHtml;
}

// Helper function to estimate the size of a string in bytes
function estimateStringSize(str: string): number {
  // In JavaScript, strings are UTF-16 encoded, so each character can be 2 bytes
  // This is a rough estimate and doesn't account for actual UTF-16 encoding details
  return str.length * 2;
}

// Define proper types for worker messages
interface WorkerPoolMessage {
  id: string;
  action: string;
  payload: {
    filePath: string;
    code: string;
    language: string;
    theme?: string;
    priority?: string;
    isVisible?: boolean;
  };
}

interface LegacyMessage {
  filePath: string;
  code: string;
  language: string;
  theme?: string;
  priority?: string;
}

// Type guard to check if message is WorkerPool format
function isWorkerPoolMessage(data: unknown): data is WorkerPoolMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    "id" in obj &&
    "action" in obj &&
    typeof obj.id === "string" &&
    typeof obj.action === "string"
  );
}

// Type guard to check if message is legacy format
function isLegacyMessage(data: unknown): data is LegacyMessage {
  if (typeof data !== "object" || data === null) {
    return false;
  }

  const obj = data as Record<string, unknown>;
  return (
    "filePath" in obj &&
    "code" in obj &&
    "language" in obj &&
    typeof obj.filePath === "string" &&
    typeof obj.code === "string" &&
    typeof obj.language === "string"
  );
}

// Enhanced message handler with WorkerPool support and new features
self.onmessage = async (event: MessageEvent) => {
  const data = event.data as unknown;

  // Handle WorkerPool-style messages
  if (isWorkerPoolMessage(data)) {
    await handleWorkerPoolMessage(data);
    return;
  }

  // Handle legacy direct messages
  if (isLegacyMessage(data)) {
    const result = await processHighlightRequest({
      filePath: data.filePath,
      code: data.code,
      language: data.language || detectLanguageFromPath(data.filePath),
      theme: data.theme,
      priority: data.priority || "normal",
    });

    // Send result for legacy messages
    self.postMessage({
      filePath: data.filePath,
      highlightedHtml: result.highlightedHtml,
      status: result.status,
      error: result.error,
      processingTimeMs: result.processingTimeMs,
    });
    return;
  }

  // Unknown message format
  console.error("[Highlight Worker] Unknown message format:", data);
};

/**
 * Handle WorkerPool-style messages
 */
async function handleWorkerPoolMessage(data: WorkerPoolMessage): Promise<void> {
  const { id, action, payload } = data;

  try {
    switch (action) {
      case "highlight": {
        const result = await processHighlightRequest(payload);
        self.postMessage({
          id,
          ...result,
          status: "done",
        });
        break;
      }

      case "cancel":
        // Handle cancellation if needed
        self.postMessage({
          id,
          status: "cancelled",
        });
        break;

      case "clearCache":
        // Clear the highlight cache
        highlightCache.clear();
        self.postMessage({
          id,
          status: "done",
          message: "Cache cleared successfully",
        });
        break;

      default:
        // Handle unknown action directly without throwing
        self.postMessage({
          id,
          status: "error",
          error: `Unknown action: ${action}`,
        });
        return;
    }
  } catch (error) {
    self.postMessage({
      id,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

/**
 * Process a highlight request with all enhancements
 */
async function processHighlightRequest(request: {
  filePath: string;
  code: string;
  language: string;
  theme?: string;
  priority?: string;
  isVisible?: boolean;
}): Promise<{
  filePath: string;
  highlightedHtml: string;
  status: string;
  error?: string;
  processingTimeMs: number;
  fromCache: boolean;
}> {
  const { filePath, code, language, theme, priority = "normal" } = request;

  if (!code || !language) {
    throw new Error("Code and language are required");
  }

  const startTime = performance.now();

  try {
    // Ensure language is loaded
    if (!hljs.getLanguage(language)) {
      const loaded = await loadLanguage(language);
      if (!loaded) {
        console.warn(
          "[Highlight Worker] Language '%s' not available, falling back to plaintext",
          language
        );
        return processHighlightRequest({
          ...request,
          language: "plaintext",
        });
      }
    }

    // Generate cache key (use sync version for performance)
    const cacheKey = getCacheKeySync(code, language, theme);
    const cachedEntry = highlightCache.get(cacheKey);
    const now = Date.now();

    // Check cache
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
      // Update access tracking
      cachedEntry.timestamp = now;
      cachedEntry.accessCount++;

      const processingTime = performance.now() - startTime;

      return {
        filePath,
        highlightedHtml: cachedEntry.html,
        status: "done",
        processingTimeMs: processingTime,
        fromCache: true,
      };
    }

    // Perform highlighting
    performance.mark("highlight-start");

    let highlightedHtml: string;

    // Use chunked processing for large files
    if (code.length > LARGE_FILE_THRESHOLD) {
      console.log(
        `[Highlight Worker] Processing large file (${code.length} chars) in chunks`
      );
      highlightedHtml = processInChunks(code, language, filePath, theme);
    } else {
      // Standard highlighting
      const result = hljs.highlight(code, { language, ignoreIllegals: true });
      highlightedHtml = result.value;
    }

    // Apply theme and accessibility enhancements
    highlightedHtml = enhanceHighlightedHtml(
      highlightedHtml,
      language,
      theme,
      filePath
    );

    performance.mark("highlight-end");
    performance.measure(
      "highlight-duration",
      "highlight-start",
      "highlight-end"
    );
    const duration =
      performance.getEntriesByName("highlight-duration")[0].duration;

    // Log performance for large files
    if (code.length > 50000) {
      console.log(
        `[Highlight Worker] Highlighted ${code.length} chars in ${duration.toFixed(2)}ms`
      );
    }

    // Store in cache with enhanced metadata
    const priorityLevel =
      priority === "high" ? "high" : priority === "low" ? "low" : "medium";
    highlightCache.set(cacheKey, {
      html: highlightedHtml,
      timestamp: now,
      size: estimateStringSize(highlightedHtml),
      accessCount: 1,
      priority: priorityLevel,
    });

    // Maintain cache
    maintainCache();

    const processingTime = performance.now() - startTime;

    return {
      filePath,
      highlightedHtml,
      status: "done",
      processingTimeMs: processingTime,
      fromCache: false,
    };
  } catch (error) {
    console.error(
      "[Highlight Worker] Error highlighting file (lang:",
      filePath + "):",
      language,
      error
    );

    // Return error response instead of throwing to work with worker message system
    const processingTime = performance.now() - startTime;
    return {
      filePath,
      highlightedHtml: "",
      status: "error",
      error: error instanceof Error ? error.message : "Unknown error occurred during highlighting",
      processingTimeMs: processingTime,
      fromCache: false,
    };
  } finally {
    // Clean up performance marks
    performance.clearMarks("highlight-start");
    performance.clearMarks("highlight-end");
    performance.clearMeasures("highlight-duration");
  }
}

// Optional: Add an error handler for the worker itself
self.onerror = (event) => {
  console.error("[Highlight Worker] Uncaught error:", event);
};

// Send ready message for WorkerPool compatibility
self.postMessage({ status: "ready" });

console.log(
  "[Highlight Worker] Enhanced highlighting worker initialized and ready."
);

// Export empty object to satisfy TypeScript's module requirement
export {};
