/**
 * Script to compare performance test results before and after refactoring
 *
 * Usage: node scripts/comparePerformance.js <before-file> <after-file>
 * Example: node scripts/comparePerformance.js performance-results/term-search-performance-2023-05-01.json performance-results/term-search-performance-2023-06-01.json
 */

import fs from "fs";
import path from "path";

// Check if files are provided
if (process.argv.length < 4) {
  console.error("Usage: node comparePerformance.js <before-file> <after-file>");
  process.exit(1);
}

// Get file paths from command line arguments
const beforeFilePath = process.argv[2];
const afterFilePath = process.argv[3];

// Read and parse the files
try {
  const beforeData = JSON.parse(fs.readFileSync(beforeFilePath, "utf8"));
  const afterData = JSON.parse(fs.readFileSync(afterFilePath, "utf8"));

  // Ensure the data is in the expected format (array of test results)
  if (!Array.isArray(beforeData) || !Array.isArray(afterData)) {
    console.error(
      "Error: Input files must contain JSON arrays of test results"
    );
    process.exit(1);
  }

  console.log("=".repeat(80));
  console.log(`PERFORMANCE COMPARISON REPORT`);
  console.log("=".repeat(80));
  console.log(`Before: ${path.basename(beforeFilePath)}`);
  console.log(`After:  ${path.basename(afterFilePath)}`);
  console.log("-".repeat(80));

  // Group results by content size for easier comparison
  const groupedBefore = groupByProperty(beforeData, "contentSize");
  const groupedAfter = groupByProperty(afterData, "contentSize");

  // Compare execution times and memory usage
  const allSizes = [
    ...new Set([...Object.keys(groupedBefore), ...Object.keys(groupedAfter)]),
  ];

  allSizes.sort((a, b) => {
    // Extract numeric values for proper sorting
    const aValue = parseFloat(a.split(" ")[0]);
    const bValue = parseFloat(b.split(" ")[0]);
    return aValue - bValue;
  });

  // Calculate overall improvements
  let totalExecutionTimeBeforeMs = 0;
  let totalExecutionTimeAfterMs = 0;
  let totalMemoryUsedBeforeMB = 0;
  let totalMemoryUsedAfterMB = 0;
  let comparisonCount = 0;

  // Compare by content size
  for (const size of allSizes) {
    const beforeResults = groupedBefore[size] || [];
    const afterResults = groupedAfter[size] || [];

    if (beforeResults.length === 0 || afterResults.length === 0) {
      console.log(`\nContent Size: ${size} - No comparable data`);
      continue;
    }

    console.log(`\nContent Size: ${size}`);
    console.log("-".repeat(40));

    // Calculate averages for this size
    const beforeAvgExecTime = calculateAverage(beforeResults, "executionTime");
    const afterAvgExecTime = calculateAverage(afterResults, "executionTime");
    const beforeAvgMemory = calculateAverage(beforeResults, "memoryUsed");
    const afterAvgMemory = calculateAverage(afterResults, "memoryUsed");

    // Calculate improvements
    const execTimeImprovement = calculateImprovement(
      beforeAvgExecTime,
      afterAvgExecTime
    );
    const memoryImprovement = calculateImprovement(
      beforeAvgMemory,
      afterAvgMemory
    );

    console.log(
      `Execution Time: ${beforeAvgExecTime.toFixed(2)} ms → ${afterAvgExecTime.toFixed(2)} ms (${formatImprovement(execTimeImprovement)})`
    );
    console.log(
      `Memory Usage:   ${beforeAvgMemory.toFixed(2)} MB → ${afterAvgMemory.toFixed(2)} MB (${formatImprovement(memoryImprovement)})`
    );

    // Add to totals for overall calculation
    totalExecutionTimeBeforeMs += beforeAvgExecTime;
    totalExecutionTimeAfterMs += afterAvgExecTime;
    totalMemoryUsedBeforeMB += beforeAvgMemory;
    totalMemoryUsedAfterMB += afterAvgMemory;
    comparisonCount++;
  }

  // Calculate overall improvements
  if (comparisonCount > 0) {
    const overallExecTimeImprovement = calculateImprovement(
      totalExecutionTimeBeforeMs / comparisonCount,
      totalExecutionTimeAfterMs / comparisonCount
    );

    const overallMemoryImprovement = calculateImprovement(
      totalMemoryUsedBeforeMB / comparisonCount,
      totalMemoryUsedAfterMB / comparisonCount
    );

    console.log("\n" + "=".repeat(80));
    console.log("OVERALL IMPROVEMENT");
    console.log("-".repeat(80));
    console.log(
      `Execution Time: ${formatImprovement(overallExecTimeImprovement)}`
    );
    console.log(
      `Memory Usage:   ${formatImprovement(overallMemoryImprovement)}`
    );
    console.log("=".repeat(80));

    // Check against success metrics
    console.log("\nSUCCESS METRICS EVALUATION");
    console.log("-".repeat(80));
    console.log(`Search Time Reduction Goal: 50%`);
    console.log(
      `Actual Search Time Reduction: ${Math.abs(overallExecTimeImprovement).toFixed(2)}%`
    );
    console.log(
      `Status: ${Math.abs(overallExecTimeImprovement) >= 50 ? "ACHIEVED ✓" : "NOT YET ACHIEVED ✗"}`
    );
    console.log();
    console.log(`Memory Usage Reduction Goal: 30%`);
    console.log(
      `Actual Memory Usage Reduction: ${Math.abs(overallMemoryImprovement).toFixed(2)}%`
    );
    console.log(
      `Status: ${Math.abs(overallMemoryImprovement) >= 30 ? "ACHIEVED ✓" : "NOT YET ACHIEVED ✗"}`
    );
  }
} catch (error) {
  console.error(`Error processing files: ${error.message}`);
  process.exit(1);
}

/**
 * Group array items by a specific property
 */
function groupByProperty(array, property) {
  return array.reduce((grouped, item) => {
    const key = item[property];
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(item);
    return grouped;
  }, {});
}

/**
 * Calculate average value for a property across array items
 * Handles string values with units (e.g., "123.45 ms")
 */
function calculateAverage(array, property) {
  if (array.length === 0) return 0;

  const sum = array.reduce((total, item) => {
    const value = item[property];
    // If the value is a string with units, extract the number
    if (typeof value === "string") {
      const match = value.match(/^([\d.]+)/);
      return total + (match ? parseFloat(match[1]) : 0);
    }
    return total + (typeof value === "number" ? value : 0);
  }, 0);

  return sum / array.length;
}

/**
 * Calculate percentage improvement between before and after values
 */
function calculateImprovement(before, after) {
  if (before === 0) return 0;
  return ((after - before) / before) * 100;
}

/**
 * Format improvement percentage with appropriate sign
 */
function formatImprovement(percentage) {
  const sign = percentage < 0 ? "-" : "+";
  return `${sign}${Math.abs(percentage).toFixed(2)}%`;
}
