/**
 * Mock implementation of MemoryMonitor for testing
 */

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  memoryPressure: "low" | "medium" | "high";
  timestamp: number;
}

export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private listeners: Array<(stats: MemoryStats) => void> = [];
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
  private constructor() {}

  /**
   * Start monitoring memory usage
   * @param intervalMs Interval in milliseconds between checks (default: 30000 - 30 seconds)
   */
  public startMonitoring(intervalMs = 30000): void {
    this.monitoringEnabled = true;
  }

  /**
   * Stop monitoring memory usage
   */
  public stopMonitoring(): void {
    this.monitoringEnabled = false;
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

    return {
      heapUsed,
      heapTotal,
      rss,
      memoryPressure: "low",
      timestamp: Date.now(),
    };
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
    if (typeof global !== "undefined" && (global as any).gc) {
      try {
        (global as any).gc();
        return true;
      } catch (error) {
        // Ignore errors
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
