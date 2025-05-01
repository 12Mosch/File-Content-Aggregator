/**
 * MemoryMonitor
 *
 * A service for monitoring memory usage and providing memory pressure information.
 * This service helps optimize memory usage by detecting high memory conditions
 * and triggering cleanup actions when necessary.
 */

import { Logger } from "./Logger.js";

/**
 * Type definition for NodeJS global with garbage collection
 */
interface GlobalWithGC {
  gc: () => void;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  memoryPressure: "low" | "medium" | "high";
  timestamp: number;
}

export interface MemoryThresholds {
  mediumPressureThreshold: number; // Percentage of heap used (0-1)
  highPressureThreshold: number; // Percentage of heap used (0-1)
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private logger: Logger;
  private memoryHistory: MemoryStats[] = [];
  private historyLimit = 20;
  private listeners: Array<(stats: MemoryStats) => void> = [];
  private thresholds: MemoryThresholds = {
    mediumPressureThreshold: 0.7, // 70% of heap
    highPressureThreshold: 0.85, // 85% of heap
  };
  private monitoringInterval: NodeJS.Timeout | null = null;
  private monitoringEnabled = false;

  /**
   * Gets the singleton instance of MemoryMonitor
   */
  public static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    this.logger = Logger.getInstance();
  }

  /**
   * Start monitoring memory usage
   * @param intervalMs Interval in milliseconds between checks (default: 30000 - 30 seconds)
   */
  public startMonitoring(intervalMs = 30000): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    this.monitoringEnabled = true;
    this.monitoringInterval = setInterval(() => {
      const stats = this.getMemoryStats();
      this.memoryHistory.push(stats);

      // Trim history if it exceeds the limit
      if (this.memoryHistory.length > this.historyLimit) {
        this.memoryHistory = this.memoryHistory.slice(-this.historyLimit);
      }

      // Notify listeners
      this.notifyListeners(stats);

      // Log memory pressure changes
      if (this.memoryHistory.length > 1) {
        const previousStats = this.memoryHistory[this.memoryHistory.length - 2];
        if (previousStats.memoryPressure !== stats.memoryPressure) {
          this.logger.info(
            `Memory pressure changed from ${previousStats.memoryPressure} to ${stats.memoryPressure}`,
            {
              heapUsed: `${(stats.heapUsed / 1024 / 1024).toFixed(2)} MB`,
              heapTotal: `${(stats.heapTotal / 1024 / 1024).toFixed(2)} MB`,
              percentUsed: `${((stats.heapUsed / stats.heapTotal) * 100).toFixed(1)}%`,
            }
          );
        }
      }
    }, intervalMs);

    this.logger.debug("Memory monitoring started", { intervalMs });
  }

  /**
   * Stop monitoring memory usage
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.monitoringEnabled = false;
    this.logger.debug("Memory monitoring stopped");
  }

  /**
   * Get current memory statistics
   */
  public getMemoryStats(): MemoryStats {
    let heapUsed = 0;
    let heapTotal = 0;
    let rss = 0;

    // Get memory usage from Node.js process
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memoryUsage = process.memoryUsage();
      heapUsed = memoryUsage.heapUsed;
      heapTotal = memoryUsage.heapTotal;
      rss = memoryUsage.rss;
    }

    // Calculate memory pressure
    const memoryPressure = this.calculateMemoryPressure(heapUsed, heapTotal);

    return {
      heapUsed,
      heapTotal,
      rss,
      memoryPressure,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate memory pressure level based on heap usage
   */
  private calculateMemoryPressure(
    heapUsed: number,
    heapTotal: number
  ): "low" | "medium" | "high" {
    if (heapTotal === 0) return "low";

    const usageRatio = heapUsed / heapTotal;

    if (usageRatio >= this.thresholds.highPressureThreshold) {
      return "high";
    } else if (usageRatio >= this.thresholds.mediumPressureThreshold) {
      return "medium";
    } else {
      return "low";
    }
  }

  /**
   * Add a listener for memory pressure changes
   * @param listener Function to call when memory stats are updated
   */
  public addListener(listener: (stats: MemoryStats) => void): void {
    this.listeners.push(listener);
  }

  /**
   * Remove a listener
   * @param listener The listener to remove
   */
  public removeListener(listener: (stats: MemoryStats) => void): void {
    this.listeners = this.listeners.filter((l) => l !== listener);
  }

  /**
   * Notify all listeners with the current memory stats
   */
  private notifyListeners(stats: MemoryStats): void {
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch (error) {
        this.logger.error("Error in memory monitor listener", { error });
      }
    }
  }

  /**
   * Set custom memory pressure thresholds
   * @param thresholds The new thresholds to use
   */
  public setThresholds(thresholds: Partial<MemoryThresholds>): void {
    this.thresholds = { ...this.thresholds, ...thresholds };
  }

  /**
   * Get memory usage history
   */
  public getMemoryHistory(): MemoryStats[] {
    return [...this.memoryHistory];
  }

  /**
   * Check if memory monitoring is enabled
   */
  public isMonitoringEnabled(): boolean {
    return this.monitoringEnabled;
  }

  /**
   * Force garbage collection if available
   * Note: This requires Node.js to be started with --expose-gc flag
   * @returns True if garbage collection was triggered, false otherwise
   */
  public forceGarbageCollection(): boolean {
    // Check if gc is available on the global object
    if (typeof global !== "undefined" && "gc" in global) {
      try {
        (global as GlobalWithGC).gc();
        this.logger.debug("Manual garbage collection triggered");
        return true;
      } catch (error) {
        this.logger.error("Error triggering garbage collection", { error });
      }
    }
    return false;
  }

  /**
   * Get a formatted memory usage report
   */
  public getMemoryReport(): string {
    const stats = this.getMemoryStats();
    const heapUsedMB = (stats.heapUsed / 1024 / 1024).toFixed(2);
    const heapTotalMB = (stats.heapTotal / 1024 / 1024).toFixed(2);
    const rssMB = (stats.rss / 1024 / 1024).toFixed(2);
    const percentUsed = ((stats.heapUsed / stats.heapTotal) * 100).toFixed(1);

    return `Memory Usage:
  Heap Used: ${heapUsedMB} MB
  Heap Total: ${heapTotalMB} MB
  Heap Usage: ${percentUsed}%
  RSS: ${rssMB} MB
  Pressure: ${stats.memoryPressure}`;
  }
}
