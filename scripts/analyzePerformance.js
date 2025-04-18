/**
 * Performance Analysis Script
 *
 * This script analyzes performance data from the profiling system and generates reports.
 * It can be used to compare performance data from different runs and identify bottlenecks.
 */

 
/* eslint-disable no-undef */

const fs = require("fs");
const path = require("path");
const { program } = require("commander");

// Define the command-line interface
program
  .name("analyzePerformance")
  .description("Analyze performance data from profiling reports")
  .version("1.0.0");

program
  .command("analyze")
  .description("Analyze a single performance report")
  .argument("<file>", "Path to the performance report JSON file")
  .option(
    "-o, --output <file>",
    "Output file for the analysis report (default: console)"
  )
  .option("-f, --format <format>", "Output format (text, json, html)", "text")
  .action(analyzeReport);

program
  .command("compare")
  .description("Compare multiple performance reports")
  .argument(
    "<files...>",
    "Paths to the performance report JSON files to compare"
  )
  .option(
    "-o, --output <file>",
    "Output file for the comparison report (default: console)"
  )
  .option("-f, --format <format>", "Output format (text, json, html)", "text")
  .option(
    "-m, --metrics <metrics>",
    "Comma-separated list of metrics to compare (default: all)"
  )
  .action(compareReports);

program
  .command("list")
  .description(
    "List available performance reports in the performance-results directory"
  )
  .option(
    "-d, --directory <dir>",
    "Directory containing performance reports",
    "./performance-results"
  )
  .action(listReports);

program.parse();

/**
 * Analyze a single performance report
 * @param {string} file Path to the performance report JSON file
 * @param {object} options Command options
 */
function analyzeReport(file, options) {
  try {
    console.log(`Analyzing performance report: ${file}`);

    // Read the report file
    const reportData = JSON.parse(fs.readFileSync(file, "utf8"));

    // Extract key metrics
    const analysis = {
      timestamp: reportData.timestamp || "Unknown",
      summary: reportData.summary || {},
      operationStats: reportData.operationStats || {},
      topOperations: reportData.summary?.topOperations || [],
      memoryUsage: reportData.summary?.memoryUsage || {
        total: 0,
        byOperation: {},
      },
      recommendations: generateRecommendations(reportData),
    };

    // Generate the report
    const report = formatReport(analysis, options.format);

    // Output the report
    if (options.output) {
      fs.writeFileSync(options.output, report);
      console.log(`Analysis report saved to: ${options.output}`);
    } else {
      console.log("\n--- PERFORMANCE ANALYSIS REPORT ---\n");
      console.log(report);
    }
  } catch (err) {
    console.error(`Error analyzing report: ${err.message}`);
    process.exit(1);
  }
}

/**
 * Compare multiple performance reports
 * @param {string[]} files Paths to the performance report JSON files to compare
 * @param {object} options Command options
 */
function compareReports(files, options) {
  try {
    console.log(`Comparing ${files.length} performance reports`);

    // Read all report files
    const reports = files
      .map((file) => {
        try {
          const data = JSON.parse(fs.readFileSync(file, "utf8"));
          return {
            file: path.basename(file),
            timestamp: data.timestamp || "Unknown",
            summary: data.summary || {},
            operationStats: data.operationStats || {},
          };
        } catch (error) {
          console.error(`Error reading file ${file}: ${error.message}`);
          return null;
        }
      })
      .filter(Boolean);

    if (reports.length < 2) {
      console.error("At least two valid reports are required for comparison");
      process.exit(1);
    }

    // Determine which metrics to compare
    const metricsToCompare = options.metrics
      ? options.metrics.split(",")
      : ["totalOperations", "totalDuration", "topOperations"];

    // Generate comparison data
    const comparison = {
      reports: reports.map((r) => ({ file: r.file, timestamp: r.timestamp })),
      metrics: {},
    };

    // Compare total metrics
    if (metricsToCompare.includes("totalOperations")) {
      comparison.metrics.totalOperations = reports.map((r) => ({
        file: r.file,
        value: r.summary.totalOperations || 0,
      }));
    }

    if (metricsToCompare.includes("totalDuration")) {
      comparison.metrics.totalDuration = reports.map((r) => ({
        file: r.file,
        value: r.summary.totalDuration || 0,
      }));
    }

    // Compare top operations
    if (metricsToCompare.includes("topOperations")) {
      // Get all unique operation names across all reports
      const allOperations = new Set();
      reports.forEach((r) => {
        (r.summary.topOperations || []).forEach((op) => {
          allOperations.add(op.name);
        });
      });

      // Compare each operation across reports
      comparison.metrics.operations = {};
      allOperations.forEach((opName) => {
        comparison.metrics.operations[opName] = reports.map((r) => {
          const op = (r.summary.topOperations || []).find(
            (o) => o.name === opName
          );
          return {
            file: r.file,
            duration: op ? op.duration : 0,
            callCount: op ? op.callCount : 0,
            avgDuration: op ? op.averageDuration : 0,
          };
        });
      });
    }

    // Generate improvement recommendations
    comparison.recommendations = generateComparisonRecommendations(reports);

    // Format the comparison report
    const report = formatComparisonReport(comparison, options.format);

    // Output the report
    if (options.output) {
      fs.writeFileSync(options.output, report);
      console.log(`Comparison report saved to: ${options.output}`);
    } else {
      console.log("\n--- PERFORMANCE COMPARISON REPORT ---\n");
      console.log(report);
    }
  } catch (error) {
    console.error(`Error comparing reports: ${error.message}`);
    process.exit(1);
  }
}

/**
 * List available performance reports
 * @param {object} options Command options
 */
function listReports(options) {
  try {
    const directory = options.directory;

    if (!fs.existsSync(directory)) {
      console.error(`Directory not found: ${directory}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(directory)
      .filter((file) => file.endsWith(".json"))
      .filter(
        (file) => file.includes("profile") || file.includes("performance")
      );

    if (files.length === 0) {
      console.log(`No performance reports found in ${directory}`);
      return;
    }

    console.log(`\nPerformance reports in ${directory}:\n`);

    // Get file details
    const fileDetails = files.map((file) => {
      const filePath = path.join(directory, file);
      const stats = fs.statSync(filePath);

      let timestamp = "Unknown";
      let summary = null;

      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        timestamp = data.timestamp || stats.mtime.toISOString();
        summary = data.summary;
      } catch (error) {
        // Ignore parsing errors
      }

      return {
        file,
        path: filePath,
        size: stats.size,
        modified: stats.mtime,
        timestamp,
        summary,
      };
    });

    // Sort by modification time (newest first)
    fileDetails.sort((a, b) => b.modified - a.modified);

    // Display the list
    fileDetails.forEach((file, index) => {
      console.log(`${index + 1}. ${file.file}`);
      console.log(`   Path: ${file.path}`);
      console.log(`   Size: ${formatFileSize(file.size)}`);
      console.log(`   Modified: ${file.modified.toLocaleString()}`);

      if (file.summary) {
        console.log(`   Operations: ${file.summary.totalOperations}`);
        console.log(
          `   Total Duration: ${formatDuration(file.summary.totalDuration)}`
        );
      }

      console.log("");
    });

    console.log(
      `\nTo analyze a report: node scripts/analyzePerformance.js analyze <file>`
    );
    console.log(
      `To compare reports: node scripts/analyzePerformance.js compare <file1> <file2> [<file3> ...]`
    );
  } catch (error) {
    console.error(`Error listing reports: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Generate recommendations based on performance data
 * @param {object} reportData Performance report data
 * @returns {string[]} Array of recommendations
 */
function generateRecommendations(reportData) {
  const recommendations = [];
  const summary = reportData.summary || {};
  const topOps = summary.topOperations || [];

  // Check for operations taking a large percentage of time
  const highPercentageOps = topOps.filter((op) => op.percentage > 20);
  if (highPercentageOps.length > 0) {
    highPercentageOps.forEach((op) => {
      recommendations.push(
        `Operation "${op.name}" takes ${op.percentage.toFixed(1)}% of total time. Consider optimizing this operation.`
      );
    });
  }

  // Check for operations with high average duration
  const highAvgDurationOps = topOps.filter((op) => op.averageDuration > 50);
  if (highAvgDurationOps.length > 0) {
    highAvgDurationOps.forEach((op) => {
      recommendations.push(
        `Operation "${op.name}" has a high average duration (${formatDuration(op.averageDuration)}). Consider optimizing or caching results.`
      );
    });
  }

  // Check for operations with high call counts
  const highCallCountOps = topOps.filter((op) => op.callCount > 1000);
  if (highCallCountOps.length > 0) {
    highCallCountOps.forEach((op) => {
      recommendations.push(
        `Operation "${op.name}" is called ${op.callCount.toLocaleString()} times. Consider reducing the number of calls or implementing batch processing.`
      );
    });
  }

  // Check for memory usage
  if (summary.memoryUsage && summary.memoryUsage.total > 50) {
    recommendations.push(
      `Total memory usage is high (${formatMemorySize(summary.memoryUsage.total)}). Consider implementing memory optimization strategies.`
    );

    // Check for operations with high memory usage
    const memoryByOp = summary.memoryUsage.byOperation || {};
    Object.entries(memoryByOp)
      .filter(([, value]) => value > 10)
      .forEach(([name, value]) => {
        recommendations.push(
          `Operation "${name}" uses ${formatMemorySize(value)} of memory. Consider optimizing memory usage.`
        );
      });
  }

  // If no specific recommendations, provide general advice
  if (recommendations.length === 0) {
    recommendations.push(
      "No specific performance issues detected. Continue monitoring for changes over time."
    );
  }

  return recommendations;
}

/**
 * Generate recommendations based on comparison of performance reports
 * @param {object[]} reports Array of performance reports
 * @returns {string[]} Array of recommendations
 */
function generateComparisonRecommendations(reports) {
  const recommendations = [];

  // Compare total duration between first and last report
  const firstReport = reports[0];
  const lastReport = reports[reports.length - 1];

  const firstDuration = firstReport.summary.totalDuration || 0;
  const lastDuration = lastReport.summary.totalDuration || 0;

  if (lastDuration > firstDuration * 1.2) {
    recommendations.push(
      `Performance has degraded by ${((lastDuration / firstDuration - 1) * 100).toFixed(1)}% since ${firstReport.timestamp}. Investigate recent changes.`
    );
  } else if (firstDuration > lastDuration * 1.2) {
    recommendations.push(
      `Performance has improved by ${((1 - lastDuration / firstDuration) * 100).toFixed(1)}% since ${firstReport.timestamp}. Recent optimizations are effective.`
    );
  }

  // Compare top operations
  const firstTopOps = firstReport.summary.topOperations || [];
  const lastTopOps = lastReport.summary.topOperations || [];

  // Find operations that have significantly changed
  firstTopOps.forEach((firstOp) => {
    const lastOp = lastTopOps.find((op) => op.name === firstOp.name);
    if (lastOp) {
      // Operation exists in both reports
      if (lastOp.duration > firstOp.duration * 1.5) {
        recommendations.push(
          `Operation "${firstOp.name}" has slowed down by ${((lastOp.duration / firstOp.duration - 1) * 100).toFixed(1)}%. Investigate recent changes.`
        );
      } else if (firstOp.duration > lastOp.duration * 1.5) {
        recommendations.push(
          `Operation "${firstOp.name}" has improved by ${((1 - lastOp.duration / firstOp.duration) * 100).toFixed(1)}%. Recent optimizations are effective.`
        );
      }
    }
  });

  // Find new operations in the latest report
  lastTopOps.forEach((lastOp) => {
    const firstOp = firstTopOps.find((op) => op.name === lastOp.name);
    if (!firstOp && lastOp.percentage > 10) {
      recommendations.push(
        `New operation "${lastOp.name}" takes ${lastOp.percentage.toFixed(1)}% of total time in the latest report. Investigate if this is expected.`
      );
    }
  });

  // If no specific recommendations, provide general advice
  if (recommendations.length === 0) {
    recommendations.push(
      "No significant performance changes detected between reports."
    );
  }

  return recommendations;
}

/**
 * Format a performance analysis report
 * @param {object} analysis Analysis data
 * @param {string} format Output format (text, json, html)
 * @returns {string} Formatted report
 */
function formatReport(analysis, format) {
  switch (format.toLowerCase()) {
    case "json":
      return JSON.stringify(analysis, null, 2);

    case "html":
      return generateHtmlReport(analysis);

    case "text":
    default:
      return generateTextReport(analysis);
  }
}

/**
 * Format a performance comparison report
 * @param {object} comparison Comparison data
 * @param {string} format Output format (text, json, html)
 * @returns {string} Formatted report
 */
function formatComparisonReport(comparison, format) {
  switch (format.toLowerCase()) {
    case "json":
      return JSON.stringify(comparison, null, 2);

    case "html":
      return generateHtmlComparisonReport(comparison);

    case "text":
    default:
      return generateTextComparisonReport(comparison);
  }
}

/**
 * Generate a text report for performance analysis
 * @param {object} analysis Analysis data
 * @returns {string} Text report
 */
function generateTextReport(analysis) {
  let report = "";

  report += `Performance Analysis Report\n`;
  report += `=========================\n\n`;
  report += `Timestamp: ${analysis.timestamp}\n\n`;

  report += `Summary:\n`;
  report += `---------\n`;
  report += `Total Operations: ${analysis.summary.totalOperations || 0}\n`;
  report += `Total Duration: ${formatDuration(analysis.summary.totalDuration || 0)}\n`;
  report += `Total Memory Change: ${formatMemorySize(analysis.summary.memoryUsage?.total || 0)}\n\n`;

  report += `Top Operations by Duration:\n`;
  report += `-------------------------\n`;
  (analysis.topOperations || []).forEach((op, index) => {
    report += `${index + 1}. ${op.name}\n`;
    report += `   Duration: ${formatDuration(op.duration)}\n`;
    report += `   Call Count: ${op.callCount.toLocaleString()}\n`;
    report += `   Average Duration: ${formatDuration(op.averageDuration)}\n`;
    report += `   Percentage of Total: ${op.percentage.toFixed(1)}%\n\n`;
  });

  report += `Memory Usage by Operation:\n`;
  report += `------------------------\n`;
  const memoryByOp = analysis.memoryUsage?.byOperation || {};
  if (Object.keys(memoryByOp).length === 0) {
    report += `No memory usage data available.\n\n`;
  } else {
    Object.entries(memoryByOp)
      .sort(([_, a], [__, b]) => Math.abs(b) - Math.abs(a))
      .slice(0, 10)
      .forEach(([name, value]) => {
        report += `${name}: ${formatMemorySize(value)}\n`;
      });
    report += "\n";
  }

  report += `Recommendations:\n`;
  report += `---------------\n`;
  (analysis.recommendations || []).forEach((rec, index) => {
    report += `${index + 1}. ${rec}\n`;
  });

  return report;
}

/**
 * Generate a text report for performance comparison
 * @param {object} comparison Comparison data
 * @returns {string} Text report
 */
function generateTextComparisonReport(comparison) {
  let report = "";

  report += `Performance Comparison Report\n`;
  report += `===========================\n\n`;

  report += `Reports Compared:\n`;
  report += `----------------\n`;
  comparison.reports.forEach((r, index) => {
    report += `${index + 1}. ${r.file} (${r.timestamp})\n`;
  });
  report += "\n";

  if (comparison.metrics.totalOperations) {
    report += `Total Operations:\n`;
    report += `----------------\n`;
    comparison.metrics.totalOperations.forEach((item) => {
      report += `${item.file}: ${item.value.toLocaleString()}\n`;
    });
    report += "\n";
  }

  if (comparison.metrics.totalDuration) {
    report += `Total Duration:\n`;
    report += `--------------\n`;
    comparison.metrics.totalDuration.forEach((item) => {
      report += `${item.file}: ${formatDuration(item.value)}\n`;
    });
    report += "\n";
  }

  if (comparison.metrics.operations) {
    report += `Operation Comparison:\n`;
    report += `-------------------\n`;
    Object.entries(comparison.metrics.operations)
      .sort(([, a], [, b]) => {
        // Sort by maximum duration across all reports
        const maxA = Math.max(...a.map((item) => item.duration));
        const maxB = Math.max(...b.map((item) => item.duration));
        return maxB - maxA;
      })
      .slice(0, 10) // Show only top 10 operations
      .forEach(([name, data]) => {
        report += `${name}:\n`;
        data.forEach((item) => {
          report += `  ${item.file}: ${formatDuration(item.duration)} (${item.callCount.toLocaleString()} calls, avg: ${formatDuration(item.avgDuration)})\n`;
        });
        report += "\n";
      });
  }

  report += `Recommendations:\n`;
  report += `---------------\n`;
  (comparison.recommendations || []).forEach((rec, index) => {
    report += `${index + 1}. ${rec}\n`;
  });

  return report;
}

/**
 * Generate an HTML report for performance analysis
 * @param {object} analysis Analysis data
 * @returns {string} HTML report
 */
function generateHtmlReport(analysis) {
  // Simple HTML report template
  return `<!DOCTYPE html>
<html>
<head>
  <title>Performance Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2 { color: #333; }
    .summary { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
    .operations { margin-top: 20px; }
    .operation { background-color: #fff; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; }
    .recommendations { margin-top: 20px; }
    .recommendation { background-color: #fffaf0; padding: 10px; margin-bottom: 5px; border-left: 4px solid #ffa500; }
  </style>
</head>
<body>
  <h1>Performance Analysis Report</h1>
  <p>Timestamp: ${analysis.timestamp}</p>

  <div class="summary">
    <h2>Summary</h2>
    <p>Total Operations: ${analysis.summary.totalOperations || 0}</p>
    <p>Total Duration: ${formatDuration(analysis.summary.totalDuration || 0)}</p>
    <p>Total Memory Change: ${formatMemorySize(analysis.summary.memoryUsage?.total || 0)}</p>
  </div>

  <div class="operations">
    <h2>Top Operations by Duration</h2>
    ${(analysis.topOperations || [])
      .map(
        (op, index) => `
      <div class="operation">
        <h3>${index + 1}. ${op.name}</h3>
        <p>Duration: ${formatDuration(op.duration)}</p>
        <p>Call Count: ${op.callCount.toLocaleString()}</p>
        <p>Average Duration: ${formatDuration(op.averageDuration)}</p>
        <p>Percentage of Total: ${op.percentage.toFixed(1)}%</p>
      </div>
    `
      )
      .join("")}
  </div>

  <div class="recommendations">
    <h2>Recommendations</h2>
    ${(analysis.recommendations || [])
      .map(
        (rec, index) => `
      <div class="recommendation">
        <p>${index + 1}. ${rec}</p>
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>`;
}

/**
 * Generate an HTML report for performance comparison
 * @param {object} comparison Comparison data
 * @returns {string} HTML report
 */
function generateHtmlComparisonReport(comparison) {
  // Simple HTML comparison report template
  return `<!DOCTYPE html>
<html>
<head>
  <title>Performance Comparison Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    h1, h2, h3 { color: #333; }
    .reports { background-color: #f5f5f5; padding: 15px; border-radius: 5px; }
    .metrics { margin-top: 20px; }
    .metric { background-color: #fff; padding: 10px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 5px; }
    .recommendations { margin-top: 20px; }
    .recommendation { background-color: #fffaf0; padding: 10px; margin-bottom: 5px; border-left: 4px solid #ffa500; }
  </style>
</head>
<body>
  <h1>Performance Comparison Report</h1>

  <div class="reports">
    <h2>Reports Compared</h2>
    <ul>
      ${comparison.reports
        .map(
          (r, index) => `
        <li>${index + 1}. ${r.file} (${r.timestamp})</li>
      `
        )
        .join("")}
    </ul>
  </div>

  <div class="metrics">
    ${
      comparison.metrics.totalOperations
        ? `
      <div class="metric">
        <h2>Total Operations</h2>
        <ul>
          ${comparison.metrics.totalOperations
            .map(
              (item) => `
            <li>${item.file}: ${item.value.toLocaleString()}</li>
          `
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }

    ${
      comparison.metrics.totalDuration
        ? `
      <div class="metric">
        <h2>Total Duration</h2>
        <ul>
          ${comparison.metrics.totalDuration
            .map(
              (item) => `
            <li>${item.file}: ${formatDuration(item.value)}</li>
          `
            )
            .join("")}
        </ul>
      </div>
    `
        : ""
    }

    ${
      comparison.metrics.operations
        ? `
      <div class="metric">
        <h2>Operation Comparison</h2>
        ${Object.entries(comparison.metrics.operations)
          .sort(([, a], [, b]) => {
            const maxA = Math.max(...a.map((item) => item.duration));
            const maxB = Math.max(...b.map((item) => item.duration));
            return maxB - maxA;
          })
          .slice(0, 10)
          .map(
            ([name, data]) => `
            <h3>${name}</h3>
            <ul>
              ${data
                .map(
                  (item) => `
                <li>${item.file}: ${formatDuration(item.duration)} (${item.callCount.toLocaleString()} calls, avg: ${formatDuration(item.avgDuration)})</li>
              `
                )
                .join("")}
            </ul>
          `
          )
          .join("")}
      </div>
    `
        : ""
    }
  </div>

  <div class="recommendations">
    <h2>Recommendations</h2>
    ${(comparison.recommendations || [])
      .map(
        (rec, index) => `
      <div class="recommendation">
        <p>${index + 1}. ${rec}</p>
      </div>
    `
      )
      .join("")}
  </div>
</body>
</html>`;
}

/**
 * Format a duration in milliseconds to a human-readable string
 * @param {number} ms Duration in milliseconds
 * @returns {string} Formatted duration
 */
function formatDuration(ms) {
  if (ms < 1) {
    return `${(ms * 1000).toFixed(2)}μs`;
  } else if (ms < 1000) {
    return `${ms.toFixed(2)}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(2)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(2);
    return `${minutes}m ${seconds}s`;
  }
}

/**
 * Format a memory size in MB to a human-readable string
 * @param {number} mb Memory size in MB
 * @returns {string} Formatted memory size
 */
function formatMemorySize(mb) {
  if (Math.abs(mb) < 0.001) {
    return "0 MB";
  } else if (Math.abs(mb) < 1) {
    return `${(mb * 1024).toFixed(2)} KB`;
  } else if (Math.abs(mb) < 1024) {
    return `${mb.toFixed(2)} MB`;
  } else {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
}

/**
 * Format a file size in bytes to a human-readable string
 * @param {number} bytes File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(2)} KB`;
  } else if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}
