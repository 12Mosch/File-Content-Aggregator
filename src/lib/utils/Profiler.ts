/**
 * Performance Profiler
 *
 * A utility for measuring and analyzing code performance.
 * Provides methods for timing operations and generating performance reports.
 */

import { Logger } from "../services/Logger.js";

interface ProfileEntry {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  parent?: string;
  children: string[];
}

export interface ProfileReport {
  name: string;
  duration: number;
  percentage: number;
  children: ProfileReport[];
}

export class Profiler {
  private static instance: Profiler;
  private entries: Map<string, ProfileEntry> = new Map();
  private activeStack: string[] = [];
  private logger: Logger;
  private enabled: boolean = false;

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
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.logger.debug(`Profiling ${enabled ? "enabled" : "disabled"}`);
  }

  /**
   * Check if profiling is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Start timing an operation
   * @param name Name of the operation
   * @returns A unique ID for the operation
   */
  public start(name: string): string {
    if (!this.enabled) return "";

    const id = `${name}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const parent =
      this.activeStack.length > 0
        ? this.activeStack[this.activeStack.length - 1]
        : undefined;

    this.entries.set(id, {
      name,
      startTime: performance.now(),
      parent,
      children: [],
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
   * @returns The duration in milliseconds
   */
  public end(id: string): number {
    if (!this.enabled || !id) return 0;

    const entry = this.entries.get(id);
    if (!entry) return 0;

    entry.endTime = performance.now();
    entry.duration = entry.endTime - entry.startTime;

    // Remove from active stack
    const index = this.activeStack.lastIndexOf(id);
    if (index !== -1) {
      this.activeStack.splice(index, 1);
    }

    return entry.duration;
  }

  /**
   * Measure the execution time of a function
   * @param name Name of the operation
   * @param fn Function to measure
   * @returns The result of the function
   */
  public measure<T>(name: string, fn: () => T): T {
    const id = this.start(name);
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

    return {
      name: entry.name,
      duration: entry.duration,
      percentage,
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
   */
  public async saveReport(filePath: string): Promise<void> {
    if (!this.enabled) return;

    const report = this.generateReport();
    const reportJson = JSON.stringify(report, null, 2);

    try {
      // Use Node.js fs module to write the file
      const fs = await import("fs/promises");
      await fs.writeFile(filePath, reportJson, "utf8");
      this.logger.info(`Profile report saved to ${filePath}`);
    } catch (error) {
      this.logger.error("Failed to save profile report", error);
    }
  }
}

/**
 * Convenience function to get the profiler instance
 */
export function getProfiler(): Profiler {
  return Profiler.getInstance();
}
