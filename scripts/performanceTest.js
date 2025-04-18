/**
 * Performance Test Script
 *
 * This script performs a series of searches with the NEAR operator to collect performance data.
 */

const { ipcRenderer } = require("electron");

// Define test cases with varying complexity
const testCases = [
  {
    name: "Simple NEAR search",
    searchParams: {
      searchPaths: ["./src"],
      filePattern: "*.ts",
      contentQuery: "function NEAR(5) return",
      useRegex: false,
      caseSensitive: false,
      includeHidden: false,
      maxResults: 100,
      excludePattern: "node_modules",
      searchMode: "standard",
    },
  },
  {
    name: "Complex NEAR search",
    searchParams: {
      searchPaths: ["./src"],
      filePattern: "*.ts",
      contentQuery: "performance NEAR(10) profiler NEAR(15) metrics",
      useRegex: false,
      caseSensitive: false,
      includeHidden: false,
      maxResults: 100,
      excludePattern: "node_modules",
      searchMode: "standard",
    },
  },
  {
    name: "NEAR with regex",
    searchParams: {
      searchPaths: ["./src"],
      filePattern: "*.ts",
      contentQuery: "/function\\s+\\w+/ NEAR(8) /return\\s+\\w+/",
      useRegex: true,
      caseSensitive: false,
      includeHidden: false,
      maxResults: 100,
      excludePattern: "node_modules",
      searchMode: "standard",
    },
  },
  {
    name: "NEAR with fuzzy search",
    searchParams: {
      searchPaths: ["./src"],
      filePattern: "*.ts",
      contentQuery: "profle NEAR(10) metrcs",
      useRegex: false,
      caseSensitive: false,
      includeHidden: false,
      maxResults: 100,
      excludePattern: "node_modules",
      searchMode: "standard",
    },
  },
  {
    name: "Large file scope NEAR search",
    searchParams: {
      searchPaths: ["./"],
      filePattern: "*",
      contentQuery: "function NEAR(5) return",
      useRegex: false,
      caseSensitive: false,
      includeHidden: false,
      maxResults: 100,
      excludePattern: "node_modules",
      searchMode: "standard",
    },
  },
];

// Run the test cases
async function runTests() {
  console.log("Starting performance tests...");

  for (const testCase of testCases) {
    console.log(`Running test: ${testCase.name}`);

    try {
      // Perform the search
      const results = await ipcRenderer.invoke(
        "search-files",
        testCase.searchParams
      );
      console.log(`Test completed: ${testCase.name}`);
      console.log(`Found ${results.length} results`);
    } catch (error) {
      console.error(`Error in test ${testCase.name}:`, error);
    }

    // Wait a bit between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("All tests completed");

  // Save the performance report
  try {
    const result = await ipcRenderer.invoke("save-performance-report");
    if (result.success) {
      console.log("Performance report saved successfully");
    } else {
      console.error("Failed to save performance report:", result.error);
    }
  } catch (error) {
    console.error("Error saving performance report:", error);
  }
}

// Execute the tests when the window is loaded
window.addEventListener("DOMContentLoaded", () => {
  // Wait a bit for the application to fully initialize
  setTimeout(runTests, 3000);
});
