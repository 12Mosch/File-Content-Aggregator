/**
 * Enhanced Performance Profiler
 *
 * A utility for measuring and analyzing code performance with detailed metrics.
 * Provides methods for timing operations, tracking memory usage, and generating
 * comprehensive performance reports with visualization capabilities.
 */

import { Logger } from "../services/Logger.js";

interface ProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
  children: string[];
  callCount?: number;
  memoryBefore?: number;
  memoryAfter?: number;
  memoryDelta?: number;
  metadata?: Record<string, unknown>;
}

export interface ProfileReport {
  name: string;
  duration: number;
  percentage: number;
  callCount?: number;
  averageDuration?: number;
  memoryDelta?: number;
  metadata?: Record<string, unknown>;
  children: ProfileReport[];
}

export interface ProfileSummary {
  totalOperations: number;
  totalDuration: number;
  topOperations: Array<{
    name: string;
    duration: number;
    callCount: number;
    averageDuration: number;
    percentage: number;
  }>;
  memoryUsage: {
    total: number;
    byOperation: Record<string, number>;
  };
}

export interface PerformanceMetrics {
  timestamp: number;
  operationName: string;
  duration: number;
  memoryDelta?: number;
  metadata?: Record<string, unknown>;
}

export class Profiler {
  private static instance: Profiler;
  private entries: Map<string, ProfileEntry> = new Map();
  private activeStack: string[] = [];
  private logger: Logger;
  private enabled: boolean = false;
  private detailedMemoryTracking: boolean = false;
  private operationStats: Map<
    string,
    {
      callCount: number;
      totalDuration: number;
      maxDuration: number;
      minDuration: number;
    }
  > = new Map();
  private metricsHistory: PerformanceMetrics[] = [];
  private historyLimit: number = 1000; // Limit the number of historical metrics to prevent memory issues

  /**
   * Get the singleton instance
   */
  public static getInstance(): Profiler {
    if (!Profiler.instance) {
      Profiler.instance = new Profiler();
    }
    return Profiler.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Enable or disable profiling
   * @param enabled Whether profiling should be enabled
   * @param options Additional profiling options
   */
  public setEnabled(
    enabled: boolean,
    options?: { detailedMemoryTracking?: boolean }
  ): void {
    this.enabled = enabled;
    if (options) {
      this.detailedMemoryTracking =
        options.detailedMemoryTracking ?? this.detailedMemoryTracking;
    }
    this.logger.debug(
      `Profiling ${enabled ? "enabled" : "disabled"} with options:`,
      {
        detailedMemoryTracking: this.detailedMemoryTracking,
      }
    );
  }

  /**
   * Check if profiling is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Check if detailed memory tracking is enabled
   */
  public isDetailedMemoryTrackingEnabled(): boolean {
    return this.detailedMemoryTracking;
  }

  /**
   * Get memory usage in MB
   * @returns Current memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof process !== "undefined" && process.memoryUsage) {
      const { heapUsed } = process.memoryUsage();
      return heapUsed / (1024 * 1024); // Convert to MB
    }
    return 0;
  }

  /**
   * Start timing an operation
   * @param name Name of the operation
   * @param metadata Optional metadata to associate with this operation
   * @returns A unique ID for the operation
   */
  public start(name: string, metadata?: Record<string, unknown>): string {
    if (!this.enabled) return "";

    const id = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const parent =
      this.activeStack.length > 0
        ? this.activeStack[this.activeStack.length - 1]
        : undefined;

    // Track memory usage if detailed tracking is enabled
    const memoryBefore = this.detailedMemoryTracking
      ? this.getMemoryUsage()
      : undefined;

    this.entries.set(id, {
      name,
      startTime: performance.now(),
      parent,
      children: [],
      memoryBefore,
      metadata,
    });

    // Add this entry as a child of its parent
    if (parent) {
      const parentEntry = this.entries.get(parent);
      if (parentEntry) {
        parentEntry.children.push(id);
      }
    }

    this.activeStack.push(id);
    return id;
  }

  /**
   * End timing an operation
   * @param id The ID returned from start()
   * @param additionalMetadata Optional additional metadata to associate with this operation
   * @returns The duration in milliseconds
   */
  public end(id: string, additionalMetadata?: Record<string, unknown>): number {
    if (!this.enabled || !id) return 0;

    const entry = this.entries.get(id);
    if (!entry) return 0;

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    // Track memory usage if detailed tracking is enabled
    if (this.detailedMemoryTracking && entry.memoryBefore !== undefined) {
      entry.memoryAfter = this.getMemoryUsage();
      entry.memoryDelta = entry.memoryAfter - entry.memoryBefore;
    }

    // Update operation statistics
    this.updateOperationStats(entry.name, entry.duration);

    // Add additional metadata if provided
    if (additionalMetadata) {
      entry.metadata = { ...entry.metadata, ...additionalMetadata };
    }

    // Add to metrics history
    this.addToMetricsHistory({
      timestamp: Date.now(),
      operationName: entry.name,
      duration: entry.duration,
      memoryDelta: entry.memoryDelta,
      metadata: entry.metadata,
    });

    // Remove from active stack
    const index = this.activeStack.lastIndexOf(id);
    if (index !== -1) {
      this.activeStack.splice(index, 1);
    }

    return entry.duration;
  }

  /**
   * Update operation statistics
   * @param operationName Name of the operation
   * @param duration Duration of the operation in milliseconds
   */
  private updateOperationStats(operationName: string, duration: number): void {
    const stats = this.operationStats.get(operationName) || {
      callCount: 0,
      totalDuration: 0,
      maxDuration: 0,
      minDuration: Number.MAX_VALUE,
    };

    stats.callCount++;
    stats.totalDuration += duration;
    stats.maxDuration = Math.max(stats.maxDuration, duration);
    stats.minDuration = Math.min(stats.minDuration, duration);

    this.operationStats.set(operationName, stats);
  }

  /**
   * Add a metrics entry to the history
   * @param metrics The metrics to add
   */
  private addToMetricsHistory(metrics: PerformanceMetrics): void {
    this.metricsHistory.push(metrics);

    // Trim history if it exceeds the limit
    if (this.metricsHistory.length > this.historyLimit) {
      this.metricsHistory = this.metricsHistory.slice(-this.historyLimit);
    }
  }

  /**
   * Measure the execution time of a function
   * @param name Name of the operation
   * @param fn Function to measure
   * @param metadata Optional metadata to associate with this operation
   * @returns The result of the function
   */
  public measure<T>(
    name: string,
    fn: () => T,
    metadata?: Record<string, unknown>
  ): T {
    const id = this.start(name, metadata);
    try {
      return fn();
    } finally {
      this.end(id);
    }
  }

  /**
   * Create a decorator for measuring method execution time
   * @param name Name of the operation (defaults to method name)
   * @returns Method decorator
   */
  public static profile(name?: string) {
    return function (
      target: unknown,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      // Type the original method more strictly
      const originalMethod = descriptor.value as (
        ...args: unknown[]
      ) => unknown;
      const profilerName =
        name ||
        `${(target as { constructor: { name: string } }).constructor.name}.${propertyKey}`;

      descriptor.value = function (...args: unknown[]) {
        const profiler = Profiler.getInstance();
        if (!profiler.isEnabled()) {
          // Safe because we're calling the original method with its expected 'this' and args
          return originalMethod.apply(this, args);
        }

        const id = profiler.start(profilerName);
        try {
          // Safe because we're calling the original method with its expected 'this' and args
          return originalMethod.apply(this, args);
        } finally {
          profiler.end(id);
        }
      };

      return descriptor;
    };
  }

  /**
   * Generate a report of all profiled operations
   * @returns A hierarchical report of operation durations
   */
  public generateReport(): ProfileReport[] {
    if (!this.enabled) return [];

    // Find root entries (those without parents)
    const rootEntries = Array.from(this.entries.entries())
      .filter(([_, entry]) => !entry.parent)
      .map(([id]) => id);

    // Generate reports for each root entry
    return rootEntries.map((id) => this.generateReportForEntry(id));
  }

  /**
   * Generate a summary of profiling data
   * @param limit Maximum number of top operations to include
   * @returns A summary of profiling data
   */
  public generateSummary(limit: number = 10): ProfileSummary {
    if (!this.enabled) {
      return {
        totalOperations: 0,
        totalDuration: 0,
        topOperations: [],
        memoryUsage: { total: 0, byOperation: {} },
      };
    }

    // Calculate total duration across all operations
    let totalDuration = 0;
    const operationDurations: Record<
      string,
      { duration: number; callCount: number; averageDuration: number }
    > = {};
    const memoryByOperation: Record<string, number> = {};
    let totalMemoryDelta = 0;

    // Process all completed entries
    for (const [_, entry] of this.entries.entries()) {
      if (entry.duration !== undefined) {
        // Track duration by operation name
        if (!operationDurations[entry.name]) {
          operationDurations[entry.name] = {
            duration: 0,
            callCount: 0,
            averageDuration: 0,
          };
        }
        operationDurations[entry.name].duration += entry.duration;
        operationDurations[entry.name].callCount++;

        // Track memory usage by operation name
        if (entry.memoryDelta !== undefined) {
          if (!memoryByOperation[entry.name]) {
            memoryByOperation[entry.name] = 0;
          }
          memoryByOperation[entry.name] += entry.memoryDelta;
          totalMemoryDelta += entry.memoryDelta;
        }
      }
    }

    // Calculate total duration and average durations
    for (const opName in operationDurations) {
      const opData = operationDurations[opName];
      totalDuration += opData.duration;
      opData.averageDuration = opData.duration / opData.callCount;
    }

    // Sort operations by total duration and get top N
    const topOperations = Object.entries(operationDurations)
      .map(([name, data]) => ({
        name,
        duration: data.duration,
        callCount: data.callCount,
        averageDuration: data.averageDuration,
        percentage:
          totalDuration > 0 ? (data.duration / totalDuration) * 100 : 0,
      }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit);

    return {
      totalOperations: this.entries.size,
      totalDuration,
      topOperations,
      memoryUsage: {
        total: totalMemoryDelta,
        byOperation: memoryByOperation,
      },
    };
  }

  /**
   * Generate a report for a specific entry and its children
   * @param id The entry ID
   * @returns A hierarchical report
   */
  private generateReportForEntry(id: string): ProfileReport {
    const entry = this.entries.get(id);
    if (!entry || !entry.duration) {
      return {
        name: "Unknown",
        duration: 0,
        percentage: 0,
        children: [],
      };
    }

    // Generate reports for children
    const childReports = entry.children.map((childId) =>
      this.generateReportForEntry(childId)
    );

    // Calculate percentage of parent's time
    const parentEntry = entry.parent ? this.entries.get(entry.parent) : null;
    const percentage =
      parentEntry && parentEntry.duration
        ? (entry.duration / parentEntry.duration) * 100
        : 100;

    // Get operation stats
    const stats = this.operationStats.get(entry.name);

    return {
      name: entry.name,
      duration: entry.duration,
      percentage,
      callCount: stats?.callCount,
      averageDuration: stats
        ? stats.totalDuration / stats.callCount
        : undefined,
      memoryDelta: entry.memoryDelta,
      metadata: entry.metadata,
      children: childReports,
    };
  }

  /**
   * Log a performance report to the console
   */
  public logReport(): void {
    if (!this.enabled) {
      this.logger.info("Profiling is disabled. No report available.");
      return;
    }

    const report = this.generateReport();
    this.logger.info("Performance Profile Report:");

    report.forEach((rootReport) => {
      this.logReportEntry(rootReport, 0);
    });
  }

  /**
   * Log a report entry with proper indentation
   */
  private logReportEntry(report: ProfileReport, level: number): void {
    const indent = "  ".repeat(level);
    this.logger.info(
      `${indent}${report.name}: ${report.duration.toFixed(2)}ms (${report.percentage.toFixed(1)}%)`
    );

    report.children.forEach((child) => {
      this.logReportEntry(child, level + 1);
    });
  }

  /**
   * Clear all profiling data
   */
  public clear(): void {
    this.entries.clear();
    this.activeStack = [];
  }

  /**
   * Save the profiling data to a file
   * @param filePath Path to save the file
   * @param includeMetricsHistory Whether to include the metrics history in the report
   */
  public async saveReport(
    filePath: string,
    includeMetricsHistory: boolean = false
  ): Promise<void> {
    if (!this.enabled) return;

    const report = this.generateReport();
    const summary = this.generateSummary();

    const fullReport = {
      timestamp: new Date().toISOString(),
      report,
      summary,
      metricsHistory: includeMetricsHistory ? this.metricsHistory : undefined,
      operationStats: Array.from(this.operationStats.entries()).reduce(
        (acc, [key, value]) => {
          acc[key] = value;
          return acc;
        },
        {} as Record<string, unknown>
      ),
    };

    const reportJson = JSON.stringify(fullReport, null, 2);

    try {
      // Use Node.js fs module to write the file
      const fs = await import("fs/promises");
      await fs.writeFile(filePath, reportJson, "utf8");
      this.logger.info(`Profile report saved to ${filePath}`);
    } catch (error) {
      this.logger.error("Failed to save profile report", error);
    }
  }

  /**
   * Get the metrics history
   * @returns Array of performance metrics
   */
  public getMetricsHistory(): PerformanceMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get operation statistics
   * @returns Map of operation statistics
   */
  public getOperationStats(): Map<
    string,
    {
      callCount: number;
      totalDuration: number;
      maxDuration: number;
      minDuration: number;
    }
  > {
    return new Map(this.operationStats);
  }
}

/**
 * Convenience function to get the profiler instance
 */
export function getProfiler(): Profiler {
  return Profiler.getInstance();
}
