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

self.onmessage = (
  event: MessageEvent<{ filePath: string; code: string; language: string }>
) => {
  const { filePath, code, language } = event.data;

  if (!code || !language) {
    // Avoid processing empty requests
    return;
  }

  try {
    // Perform the highlighting
    // ignoreIllegals: true helps prevent errors on potentially invalid code snippets
    const result = hljs.highlight(code, { language, ignoreIllegals: true });

    // Send the highlighted HTML back to the main thread
    self.postMessage({
      filePath: filePath,
      highlightedHtml: result.value,
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
