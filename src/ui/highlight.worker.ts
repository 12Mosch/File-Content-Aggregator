// --- Worker Setup ---
// Import the core library and necessary languages *within the worker*
import hljs from "highlight.js/lib/core";

// Import and register common languages (only those needed)
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import json from "highlight.js/lib/languages/json";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml"; // For HTML too
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import csharp from "highlight.js/lib/languages/csharp";
import plaintext from "highlight.js/lib/languages/plaintext";

// Cache for highlighted content to avoid redundant processing
interface CacheEntry {
  html: string;
  timestamp: number;
  size: number;
}

const highlightCache = new Map<string, CacheEntry>();

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 200; // Increased cache size
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes in milliseconds

// Register languages in the worker scope
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("tsx", typescript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("css", css);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("csharp", csharp);
hljs.registerLanguage("log", plaintext);
hljs.registerLanguage("txt", plaintext);
hljs.registerLanguage("plaintext", plaintext);

// --- Message Handling ---

// Helper function to generate a cache key
function getCacheKey(code: string, language: string): string {
  // Use a hash of the content and language as the cache key
  // For better performance, we use a combination of language, content length, and a prefix of the content
  // This avoids expensive hash calculations while still providing good uniqueness
  const contentPrefix = code.length > 200 ? code.substring(0, 200) : code;
  return `${language}:${code.length}:${contentPrefix}`;
}

// Helper function to maintain cache size and remove expired entries
function maintainCache(): void {
  const now = Date.now();

  // First, remove expired entries
  for (const [key, entry] of highlightCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      highlightCache.delete(key);
    }
  }

  // If still over size limit, remove oldest entries
  if (highlightCache.size > MAX_CACHE_SIZE) {
    // Sort entries by timestamp (oldest first)
    const entries = Array.from(highlightCache.entries()).sort(
      (a, b) => a[1].timestamp - b[1].timestamp
    );

    // Remove oldest entries until we're under the limit
    const entriesToRemove = Math.floor(
      highlightCache.size - MAX_CACHE_SIZE * 0.8
    ); // Remove 20% more than needed
    entries.slice(0, entriesToRemove).forEach(([key]) => {
      highlightCache.delete(key);
    });
  }
}

// Helper function to estimate the size of a string in bytes
function estimateStringSize(str: string): number {
  // In JavaScript, strings are UTF-16 encoded, so each character can be 2 bytes
  // This is a rough estimate and doesn't account for actual UTF-16 encoding details
  return str.length * 2;
}

self.onmessage = (
  event: MessageEvent<{ filePath: string; code: string; language: string }>
) => {
  const { filePath, code, language } = event.data;

  if (!code || !language) {
    // Avoid processing empty requests
    return;
  }

  try {
    // Check if we have this content cached
    const cacheKey = getCacheKey(code, language);
    const cachedEntry = highlightCache.get(cacheKey);
    const now = Date.now();

    // If we have a valid cache entry that hasn't expired
    if (cachedEntry && now - cachedEntry.timestamp < CACHE_TTL) {
      // Update the timestamp to mark it as recently used
      cachedEntry.timestamp = now;

      // Send the cached highlighted HTML back to the main thread
      self.postMessage({
        filePath: filePath,
        highlightedHtml: cachedEntry.html,
        status: "done",
      });
      return;
    }

    // Not in cache or expired, perform the highlighting
    // Use a performance mark to measure highlighting time
    performance.mark("highlight-start");

    // ignoreIllegals: true helps prevent errors on potentially invalid code snippets
    const result = hljs.highlight(code, { language, ignoreIllegals: true });
    const highlightedHtml = result.value;

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

    // Store in cache with timestamp and size estimate
    highlightCache.set(cacheKey, {
      html: highlightedHtml,
      timestamp: now,
      size: estimateStringSize(highlightedHtml),
    });

    // Maintain cache after adding new entry
    maintainCache();

    // Send the highlighted HTML back to the main thread
    self.postMessage({
      filePath: filePath,
      highlightedHtml: highlightedHtml,
      status: "done",
    });
  } catch (error) {
    console.error(
      `[Highlight Worker] Error highlighting ${filePath} (lang: ${language}):`,
      error
    );
    // Send an error status back
    self.postMessage({
      filePath: filePath,
      status: "error",
      error:
        error instanceof Error ? error.message : "Unknown highlighting error",
    });
  } finally {
    // Clean up performance marks
    performance.clearMarks("highlight-start");
    performance.clearMarks("highlight-end");
    performance.clearMeasures("highlight-duration");
  }
};

// Optional: Add an error handler for the worker itself
self.onerror = (event) => {
  console.error("[Highlight Worker] Uncaught error:", event);
};

console.log("[Highlight Worker] Initialized and ready.");

// Export empty object to satisfy TypeScript's module requirement if needed,
// though for workers it might not be strictly necessary depending on tsconfig.
export {};
