/**
 * Simple script to count lines of code and files in the project
 * This can be used as a baseline metric before refactoring
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const RESULTS_DIR = path.join(__dirname, "../performance-results");
const REPORT_FILE = path.join(
  RESULTS_DIR,
  `code-metrics-${new Date().toISOString().replace(/:/g, "-")}.json`
);
const SOURCE_DIR = path.join(__dirname, "../src");
const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".css", ".html"];
const EXCLUDE_DIRS = ["node_modules", "dist", "build", "coverage", ".git"];

// Ensure results directory exists
if (!fs.existsSync(RESULTS_DIR)) {
  fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Statistics object
const stats = {
  totalFiles: 0,
  totalLines: 0,
  totalBlankLines: 0,
  totalCommentLines: 0,
  totalCodeLines: 0,
  byExtension: {},
  byDirectory: {},
  timestamp: new Date().toISOString(),
};

/**
 * Count lines in a file
 */
function countLines(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const lines = content.split("\n");
    const extension = path.extname(filePath);

    let blankLines = 0;
    let commentLines = 0;

    // Count blank lines and comments
    for (const line of lines) {
      const trimmedLine = line.trim();

      if (trimmedLine === "") {
        blankLines++;
      } else if (
        trimmedLine.startsWith("//") ||
        trimmedLine.startsWith("/*") ||
        trimmedLine.startsWith("*") ||
        trimmedLine.startsWith("*/") ||
        trimmedLine.startsWith("#")
      ) {
        commentLines++;
      }
    }

    const totalLines = lines.length;
    const codeLines = totalLines - blankLines - commentLines;

    // Update statistics
    stats.totalFiles++;
    stats.totalLines += totalLines;
    stats.totalBlankLines += blankLines;
    stats.totalCommentLines += commentLines;
    stats.totalCodeLines += codeLines;

    // Update by extension
    if (!stats.byExtension[extension]) {
      stats.byExtension[extension] = {
        files: 0,
        lines: 0,
        blankLines: 0,
        commentLines: 0,
        codeLines: 0,
      };
    }

    stats.byExtension[extension].files++;
    stats.byExtension[extension].lines += totalLines;
    stats.byExtension[extension].blankLines += blankLines;
    stats.byExtension[extension].commentLines += commentLines;
    stats.byExtension[extension].codeLines += codeLines;

    // Update by directory
    const directory =
      path
        .dirname(filePath)
        .replace(SOURCE_DIR, "")
        .replace(/^[\/\\]/, "") || "root";

    if (!stats.byDirectory[directory]) {
      stats.byDirectory[directory] = {
        files: 0,
        lines: 0,
        blankLines: 0,
        commentLines: 0,
        codeLines: 0,
      };
    }

    stats.byDirectory[directory].files++;
    stats.byDirectory[directory].lines += totalLines;
    stats.byDirectory[directory].blankLines += blankLines;
    stats.byDirectory[directory].commentLines += commentLines;
    stats.byDirectory[directory].codeLines += codeLines;

    return {
      totalLines,
      blankLines,
      commentLines,
      codeLines,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error.message);
    return {
      totalLines: 0,
      blankLines: 0,
      commentLines: 0,
      codeLines: 0,
    };
  }
}

/**
 * Recursively scan directory for files
 */
function scanDirectory(directory) {
  try {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (EXCLUDE_DIRS.includes(entry.name)) {
          continue;
        }

        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        const extension = path.extname(entry.name);

        // Only process files with specified extensions
        if (EXTENSIONS.includes(extension)) {
          countLines(fullPath);
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${directory}:`, error.message);
  }
}

// Start scanning
console.log(`Scanning directory: ${SOURCE_DIR}`);
scanDirectory(SOURCE_DIR);

// Sort extensions and directories by code lines (descending)
const sortedExtensions = Object.entries(stats.byExtension)
  .sort(([, a], [, b]) => b.codeLines - a.codeLines)
  .reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

const sortedDirectories = Object.entries(stats.byDirectory)
  .sort(([, a], [, b]) => b.codeLines - a.codeLines)
  .reduce((obj, [key, value]) => {
    obj[key] = value;
    return obj;
  }, {});

stats.byExtension = sortedExtensions;
stats.byDirectory = sortedDirectories;

// Save results
fs.writeFileSync(REPORT_FILE, JSON.stringify(stats, null, 2));

// Print summary
console.log("\n" + "=".repeat(80));
console.log("CODE METRICS SUMMARY");
console.log("=".repeat(80));
console.log(`Total Files: ${stats.totalFiles}`);
console.log(`Total Lines: ${stats.totalLines}`);
console.log(
  `Code Lines: ${stats.totalCodeLines} (${Math.round((stats.totalCodeLines / stats.totalLines) * 100)}%)`
);
console.log(
  `Comment Lines: ${stats.totalCommentLines} (${Math.round((stats.totalCommentLines / stats.totalLines) * 100)}%)`
);
console.log(
  `Blank Lines: ${stats.totalBlankLines} (${Math.round((stats.totalBlankLines / stats.totalLines) * 100)}%)`
);
console.log("-".repeat(80));

console.log("\nTOP 5 FILE EXTENSIONS:");
console.log("-".repeat(80));
Object.entries(stats.byExtension)
  .slice(0, 5)
  .forEach(([ext, data]) => {
    console.log(`${ext}: ${data.files} files, ${data.codeLines} code lines`);
  });

console.log("\nTOP 5 DIRECTORIES:");
console.log("-".repeat(80));
Object.entries(stats.byDirectory)
  .slice(0, 5)
  .forEach(([dir, data]) => {
    console.log(`${dir}: ${data.files} files, ${data.codeLines} code lines`);
  });

console.log("\n" + "=".repeat(80));
console.log(`Results saved to: ${REPORT_FILE}`);
console.log("=".repeat(80));
