/**
 * Script to analyze code complexity and generate a report
 *
 * This script uses ESLint's complexity rule to analyze the codebase
 * and generate a report on cyclomatic complexity.
 *
 * Usage: node scripts/analyzeCodeComplexity.js [directory]
 * Example: node scripts/analyzeCodeComplexity.js src/electron
 */

import fs from "fs";
import path from "path";
import { ESLint } from "eslint";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const COMPLEXITY_THRESHOLD_WARNING = 10;
const COMPLEXITY_THRESHOLD_ERROR = 20;

// Parse command line arguments
const targetDir = process.argv[2] || "src";
const outputFile = `complexity-report-${new Date().toISOString().replace(/:/g, "-")}.json`;

// Configure ESLint with complexity rule
const eslint = new ESLint({
  overrideConfig: {
    plugins: ["complexity"],
    rules: {
      complexity: ["error", COMPLEXITY_THRESHOLD_ERROR],
    },
    parserOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
});

async function analyzeComplexity() {
  console.log(`Analyzing code complexity in ${targetDir}...`);

  try {
    // Run ESLint on the target directory
    const results = await eslint.lintFiles([
      `${targetDir}/**/*.{js,jsx,ts,tsx}`,
    ]);

    // Process results to extract complexity information
    const complexityData = processResults(results);

    // Save the report
    fs.writeFileSync(outputFile, JSON.stringify(complexityData, null, 2));

    // Print summary
    printSummary(complexityData);

    console.log(`\nFull report saved to ${outputFile}`);
  } catch (error) {
    console.error("Error analyzing code complexity:", error);
    process.exit(1);
  }
}

function processResults(results) {
  const files = [];
  let totalComplexity = 0;
  let totalFunctions = 0;
  let highComplexityCount = 0;

  // Process each file
  for (const result of results) {
    const filePath = path.relative(process.cwd(), result.filePath);
    const functions = [];

    // Extract complexity information from messages
    for (const message of result.messages) {
      if (message.ruleId === "complexity") {
        const functionName = extractFunctionName(message.message);
        const complexity = extractComplexityValue(message.message);

        if (complexity) {
          functions.push({
            name: functionName || "anonymous",
            complexity: complexity,
            line: message.line,
            column: message.column,
          });

          totalComplexity += complexity;
          totalFunctions++;

          if (complexity >= COMPLEXITY_THRESHOLD_WARNING) {
            highComplexityCount++;
          }
        }
      }
    }

    // Only add files with functions
    if (functions.length > 0) {
      // Sort functions by complexity (highest first)
      functions.sort((a, b) => b.complexity - a.complexity);

      // Calculate file average complexity
      const fileAvgComplexity =
        functions.reduce((sum, fn) => sum + fn.complexity, 0) /
        functions.length;

      files.push({
        path: filePath,
        functions: functions,
        totalFunctions: functions.length,
        averageComplexity: fileAvgComplexity.toFixed(2),
      });
    }
  }

  // Sort files by average complexity (highest first)
  files.sort(
    (a, b) => parseFloat(b.averageComplexity) - parseFloat(a.averageComplexity)
  );

  // Calculate overall average complexity
  const averageComplexity =
    totalFunctions > 0 ? totalComplexity / totalFunctions : 0;

  return {
    summary: {
      totalFiles: files.length,
      totalFunctions: totalFunctions,
      averageComplexity: averageComplexity.toFixed(2),
      highComplexityFunctions: highComplexityCount,
      timestamp: new Date().toISOString(),
    },
    files: files,
  };
}

function extractFunctionName(message) {
  const match = message.match(/Function '([^']+)'/);
  return match ? match[1] : null;
}

function extractComplexityValue(message) {
  const match = message.match(/complexity of (\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

function printSummary(data) {
  const { summary, files } = data;

  console.log("\n" + "=".repeat(80));
  console.log("CODE COMPLEXITY SUMMARY");
  console.log("=".repeat(80));
  console.log(`Total Files Analyzed: ${summary.totalFiles}`);
  console.log(`Total Functions: ${summary.totalFunctions}`);
  console.log(`Average Complexity: ${summary.averageComplexity}`);
  console.log(
    `High Complexity Functions (>= ${COMPLEXITY_THRESHOLD_WARNING}): ${summary.highComplexityFunctions}`
  );
  console.log("-".repeat(80));

  // Print top 10 most complex files
  console.log("\nTOP 10 MOST COMPLEX FILES:");
  console.log("-".repeat(80));

  const top10Files = files.slice(0, 10);
  for (let i = 0; i < top10Files.length; i++) {
    const file = top10Files[i];
    console.log(`${i + 1}. ${file.path}`);
    console.log(`   Average Complexity: ${file.averageComplexity}`);
    console.log(`   Functions: ${file.totalFunctions}`);

    // Print top 3 most complex functions in this file
    const top3Functions = file.functions.slice(0, 3);
    if (top3Functions.length > 0) {
      console.log("   Most Complex Functions:");
      for (const fn of top3Functions) {
        console.log(
          `   - ${fn.name} (Line ${fn.line}): Complexity ${fn.complexity}`
        );
      }
    }

    if (i < top10Files.length - 1) {
      console.log("-".repeat(40));
    }
  }
}

// Run the analysis
analyzeComplexity();
