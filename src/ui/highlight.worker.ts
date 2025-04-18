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
const highlightCache = new Map<string, string>();

// Maximum cache size to prevent memory issues
const MAX_CACHE_SIZE = 100;

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
  // Use a simple hash of the content and language as the cache key
  // This is a basic implementation - could be improved for production
  return `${language}:${code.length}:${code.substring(0, 100)}`;
}

// Helper function to maintain cache size
function maintainCacheSize(): void {
  if (highlightCache.size > MAX_CACHE_SIZE) {
    // Remove oldest entries (first 20% of entries)
    const entriesToRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
    let count = 0;
    for (const key of highlightCache.keys()) {
      highlightCache.delete(key);
      count++;
      if (count >= entriesToRemove) break;
    }
  }
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
    let highlightedHtml = highlightCache.get(cacheKey);

    if (!highlightedHtml) {
      // Not in cache, perform the highlighting
      // ignoreIllegals: true helps prevent errors on potentially invalid code snippets
      const result = hljs.highlight(code, { language, ignoreIllegals: true });
      highlightedHtml = result.value;

      // Store in cache
      highlightCache.set(cacheKey, highlightedHtml);
      maintainCacheSize();
    }

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
