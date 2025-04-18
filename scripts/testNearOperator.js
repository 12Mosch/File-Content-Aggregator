/**
 * Test script for profiling the NEAR operator
 */

import { getProfiler } from "../dist-electron/lib/utils/Profiler.js";
import { NearOperatorService } from "../dist-electron/electron/services/NearOperatorService.js";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enable profiling
const profiler = getProfiler();
profiler.setEnabled(true, { detailedMemoryTracking: true });
console.log("Profiling enabled");

// Create a NearOperatorService instance
const nearOperatorService = new NearOperatorService();

// Test cases with varying complexity
const testCases = [
  {
    name: "Simple NEAR",
    term1: "function",
    term2: "return",
    distance: 5,
    options: { caseSensitive: false, fuzzySearchEnabled: false },
  },
  {
    name: "NEAR with fuzzy search",
    term1: "functon",
    term2: "retun",
    distance: 5,
    options: { caseSensitive: false, fuzzySearchEnabled: true },
  },
  {
    name: "NEAR with regex",
    term1: /function\s+\w+/,
    term2: /return\s+\w+/,
    distance: 8,
    options: { caseSensitive: false, fuzzySearchEnabled: false },
  },
  {
    name: "Complex NEAR",
    term1: "performance",
    term2: "metrics",
    distance: 15,
    options: { caseSensitive: false, fuzzySearchEnabled: true },
  },
  {
    name: "NEAR with whole word matching",
    term1: "function",
    term2: "return",
    distance: 5,
    options: {
      caseSensitive: false,
      fuzzySearchEnabled: false,
      wholeWordMatchingEnabled: true,
    },
  },
];

// Get all TypeScript files in the src directory
function getAllTsFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllTsFiles(filePath, fileList);
    } else if (file.endsWith(".ts") || file.endsWith(".tsx")) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

// Run the test cases
async function runTests() {
  console.log("Starting NEAR operator tests...");

  // Get all TypeScript files
  const files = getAllTsFiles(path.join(__dirname, "../src"));
  console.log(`Found ${files.length} TypeScript files to test`);

  // Process each test case
  for (const testCase of testCases) {
    console.log(`\nRunning test: ${testCase.name}`);
    const startTime = Date.now();
    let matchCount = 0;

    // Process each file
    for (const filePath of files) {
      try {
        const content = fs.readFileSync(filePath, "utf8");

        // Test the NEAR operator
        const result = nearOperatorService.evaluateNear(
          content,
          testCase.term1,
          testCase.term2,
          testCase.distance,
          testCase.options
        );

        if (result) {
          matchCount++;
        }
      } catch (error) {
        console.error(`Error processing file ${filePath}:`, error.message);
      }
    }

    const endTime = Date.now();
    console.log(`Test completed in ${endTime - startTime}ms`);
    console.log(`Found ${matchCount} matches in ${files.length} files`);
  }

  console.log("\nAll tests completed");

  // Generate and save the performance report
  const timestamp = new Date().toISOString().replace(/:/g, "-");
  const reportPath = path.join(
    __dirname,
    "../performance-results",
    `near-operator-profile-${timestamp}.json`
  );

  // Ensure directory exists
  if (!fs.existsSync(path.dirname(reportPath))) {
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  }

  // Save the report
  await profiler.saveReport(reportPath, true);
  console.log(`Performance report saved to: ${reportPath}`);

  // Run the analysis script
  console.log("\nAnalyzing performance data...");
  const analysisPath = path.join(
    __dirname,
    "../performance-results",
    `near-operator-analysis-${timestamp}.txt`
  );

  try {
    execSync(
      `node scripts/analyzePerformance.js analyze ${reportPath} -o ${analysisPath}`
    );
    console.log(`Analysis saved to: ${analysisPath}`);

    // Print the analysis
    const analysis = fs.readFileSync(analysisPath, "utf8");
    console.log("\nPerformance Analysis:");
    console.log(analysis);
  } catch (error) {
    console.error("Error running analysis:", error.message);
  }
}

// Run the tests
runTests().catch((error) => {
  console.error("Error running tests:", error);
  process.exit(1);
});
