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
  const input = `${language}:${theme || "default"}:${code.length}:${code.substring(0, 500)}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
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
      "[Highlight Worker] Failed to load language: %s",
      language,
      error
    );
    return false;
  }
}

/**
 * Detect language from file extension
 */
function detectLanguageFromPath(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  const extensionMap: Record<string, string> = {
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

  return extensionMap[ext || ""] || "plaintext";
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
 * Process large files in chunks for better performance
 */
function processInChunks(
  code: string,
  language: string,
  filePath: string,
  _theme?: string
): string {
  const chunks: string[] = [];
  let processedChunks = 0;
  const totalChunks = Math.ceil(code.length / CHUNK_SIZE);

  for (let i = 0; i < code.length; i += CHUNK_SIZE) {
    const chunk = code.substring(i, Math.min(i + CHUNK_SIZE, code.length));

    try {
      const result = hljs.highlight(chunk, { language, ignoreIllegals: true });
      chunks.push(result.value);
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
    } catch (error) {
      console.error(
        `[Highlight Worker] Error processing chunk ${processedChunks}:`,
        error
      );
      // Fallback to plaintext for this chunk
      chunks.push(chunk);
    }
  }

  return chunks.join("");
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
  const ariaLabel = `Code block in ${language}${fileName ? ` from ${fileName}` : ""}, ${totalLines} line${totalLines !== 1 ? "s" : ""}`;
  const themeClass = theme ? ` hljs-theme-${theme}` : "";

  // Enhanced accessibility wrapper
  let accessibleHtml = `<div role="region" aria-label="${ariaLabel}" class="hljs-enhanced${themeClass}" tabindex="0">`;

  // Add screen reader description
  const descId = `hljs-desc-${Math.random().toString(36).substring(2, 11)}`;
  const escapedFileName = fileName ? fileName.replace(/[<>&"']/g, (char) => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&#x27;'
  }[char] || char)) : '';
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
      "[Highlight Worker] Error highlighting %s (lang: %s):",
      filePath,
      language,
      error
    );

    throw error;
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
