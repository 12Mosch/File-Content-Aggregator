# Performance Profiling System

The File Content Aggregator includes a comprehensive performance profiling system to help identify bottlenecks and optimize performance. This document describes how to use the profiling system and analyze the results.

## Overview

The profiling system consists of several components:

1. **Profiler Class**: A utility for measuring and analyzing code performance with detailed metrics.
2. **Performance Dashboard**: A UI component for visualizing performance data.
3. **Performance Analysis Script**: A command-line tool for analyzing performance data.

## Enabling Profiling

There are two ways to enable profiling:

1. **Command Line**: Launch the application with the `--profile` flag to enable profiling from startup.

   ```
   npm run dev -- --profile
   ```

2. **Settings UI**: Enable profiling in the application settings:
   - Open the Settings dialog
   - Go to the "Performance" tab
   - Toggle "Enable Performance Profiling"

## Profiling Options

The profiling system supports the following options:

- **Detailed Memory Tracking**: When enabled, the profiler will track memory usage for each operation. This provides valuable insights into memory consumption but may slightly impact performance.

## Viewing Performance Data

The Performance Dashboard in the Settings dialog provides real-time visualization of performance data:

- **Overview**: Shows high-level metrics like total operations, total duration, and memory usage.
- **Operations**: Provides detailed metrics for each operation, including call counts and average durations.
- **Memory**: Shows memory usage by operation (when detailed memory tracking is enabled).
- **Timeline**: Displays a timeline of recent operations.

## Saving Performance Reports

You can save performance data to a file for later analysis:

1. In the Performance Dashboard, click the "Save Report" button.
2. Choose a location to save the report file.

Performance reports are saved in JSON format and include:

- Timestamp
- Summary metrics
- Detailed operation statistics
- Metrics history

## Analyzing Performance Data

The application includes a performance analysis script for analyzing performance data:

```
node scripts/analyzePerformance.js analyze <file>
```

This script can:

- Analyze a single performance report
- Compare multiple performance reports
- Generate recommendations for optimization

### Commands

- **List available reports**:

  ```
  node scripts/analyzePerformance.js list
  ```

- **Analyze a single report**:

  ```
  node scripts/analyzePerformance.js analyze <file> [options]
  ```

  Options:

  - `-o, --output <file>`: Output file for the analysis report
  - `-f, --format <format>`: Output format (text, json, html)

- **Compare multiple reports**:
  ```
  node scripts/analyzePerformance.js compare <file1> <file2> [<file3> ...] [options]
  ```
  Options:
  - `-o, --output <file>`: Output file for the comparison report
  - `-f, --format <format>`: Output format (text, json, html)
  - `-m, --metrics <metrics>`: Comma-separated list of metrics to compare

## Instrumenting Code

To add profiling to your code, use the Profiler class:

```typescript
import { getProfiler } from "../lib/utils/Profiler.js";

// Start timing an operation
const profiler = getProfiler();
const profileId = profiler.start("OperationName", {
  // Optional metadata
  param1: "value1",
  param2: "value2",
});

// ... code to profile ...

// End timing and record metrics
profiler.end(profileId, {
  // Optional additional metadata
  result: "success",
});
```

You can also use the `measure` method for simpler profiling:

```typescript
const result = profiler.measure("OperationName", () => {
  // Code to profile
  return someValue;
});
```

## Identifying Bottlenecks

The profiling system helps identify bottlenecks in several ways:

1. **Top Operations**: The operations that take the most time are prime candidates for optimization.
2. **Call Counts**: Operations with high call counts might benefit from batching or caching.
3. **Memory Usage**: Operations with high memory usage might need memory optimization.
4. **Timeline Analysis**: The timeline view can help identify patterns and spikes in performance.
5. **Phase Metrics**: Detailed metrics for different phases of an algorithm help pinpoint specific bottlenecks.
6. **Cache Efficiency**: Cache hit/miss ratios indicate the effectiveness of caching mechanisms.

## Best Practices

1. **Focus on Hot Paths**: Concentrate optimization efforts on the most frequently executed code paths.
2. **Compare Before and After**: Always compare performance before and after making changes.
3. **Measure in Production-like Conditions**: Profile with realistic data sizes and workloads.
4. **Look for Patterns**: Sometimes the issue isn't a single operation but a pattern of operations.
5. **Consider Trade-offs**: Some optimizations might improve speed at the cost of memory, or vice versa.

## Implementation Details

The profiling system is implemented in the following files:

- `src/lib/utils/Profiler.ts`: The core profiling utility
- `src/lib/utils/PerformanceVisualizer.ts`: Utilities for visualizing performance data
- `src/ui/components/PerformanceDashboard.tsx`: The UI component for the performance dashboard
- `src/ui/components/PerformanceChart.tsx`: Chart components for visualizing metrics
- `scripts/analyzePerformance.js`: Command-line tool for analyzing performance data

The NEAR operator implementation in `src/electron/services/NearOperatorService.ts` includes detailed profiling to help identify bottlenecks in the search algorithm.
