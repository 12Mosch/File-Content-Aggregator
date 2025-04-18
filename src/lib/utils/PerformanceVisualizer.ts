/**
 * Performance Visualizer
 *
 * Utility for generating visualizations from performance data.
 * Provides methods for creating charts and graphs from profiling data.
 */

import { ProfileReport, ProfileSummary, PerformanceMetrics } from "./Profiler.js";

export interface ChartData {
  labels: string[];
  datasets: Array<{
    label: string;
    data: number[];
    backgroundColor?: string[];
    borderColor?: string;
    borderWidth?: number;
  }>;
}

export interface TimeSeriesPoint {
  timestamp: number;
  value: number;
}

export interface TimeSeriesData {
  label: string;
  data: TimeSeriesPoint[];
  color?: string;
}

export class PerformanceVisualizer {
  /**
   * Generate chart data for operation durations
   * @param summary Profile summary
   * @returns Chart data for operation durations
   */
  public static generateOperationDurationChart(summary: ProfileSummary): ChartData {
    const topOps = summary.topOperations.slice(0, 10); // Limit to top 10 for readability
    
    return {
      labels: topOps.map(op => op.name),
      datasets: [
        {
          label: 'Total Duration (ms)',
          data: topOps.map(op => op.duration),
          backgroundColor: this.generateColors(topOps.length),
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Generate chart data for operation call counts
   * @param summary Profile summary
   * @returns Chart data for operation call counts
   */
  public static generateOperationCallCountChart(summary: ProfileSummary): ChartData {
    const topOps = summary.topOperations.slice(0, 10); // Limit to top 10 for readability
    
    return {
      labels: topOps.map(op => op.name),
      datasets: [
        {
          label: 'Call Count',
          data: topOps.map(op => op.callCount),
          backgroundColor: this.generateColors(topOps.length, 0.7),
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Generate chart data for average operation durations
   * @param summary Profile summary
   * @returns Chart data for average operation durations
   */
  public static generateAverageDurationChart(summary: ProfileSummary): ChartData {
    const topOps = summary.topOperations.slice(0, 10); // Limit to top 10 for readability
    
    return {
      labels: topOps.map(op => op.name),
      datasets: [
        {
          label: 'Average Duration (ms)',
          data: topOps.map(op => op.averageDuration),
          backgroundColor: this.generateColors(topOps.length, 0.5),
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Generate chart data for memory usage by operation
   * @param summary Profile summary
   * @returns Chart data for memory usage
   */
  public static generateMemoryUsageChart(summary: ProfileSummary): ChartData {
    // Get operations with memory usage data
    const memoryOps = Object.entries(summary.memoryUsage.byOperation)
      .map(([name, memoryDelta]) => ({ name, memoryDelta }))
      .filter(op => op.memoryDelta !== 0) // Filter out operations with no memory change
      .sort((a, b) => Math.abs(b.memoryDelta) - Math.abs(a.memoryDelta)) // Sort by absolute memory change
      .slice(0, 10); // Limit to top 10
    
    return {
      labels: memoryOps.map(op => op.name),
      datasets: [
        {
          label: 'Memory Change (MB)',
          data: memoryOps.map(op => op.memoryDelta),
          backgroundColor: memoryOps.map(op => op.memoryDelta >= 0 ? 'rgba(255, 99, 132, 0.6)' : 'rgba(75, 192, 192, 0.6)'),
          borderWidth: 1
        }
      ]
    };
  }

  /**
   * Generate time series data for operation durations
   * @param metrics Performance metrics history
   * @param operationName Name of the operation to track (or undefined for all operations)
   * @param limit Maximum number of data points
   * @returns Time series data for operation durations
   */
  public static generateTimeSeriesData(
    metrics: PerformanceMetrics[],
    operationName?: string,
    limit: number = 100
  ): TimeSeriesData[] {
    // If no operation name is specified, get the top 5 operations by frequency
    if (!operationName) {
      const opCounts = new Map<string, number>();
      
      metrics.forEach(metric => {
        const count = opCounts.get(metric.operationName) || 0;
        opCounts.set(metric.operationName, count + 1);
      });
      
      const topOps = Array.from(opCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name]) => name);
      
      return topOps.map((name, index) => {
        const opMetrics = metrics
          .filter(m => m.operationName === name)
          .slice(-limit);
        
        return {
          label: name,
          data: opMetrics.map(m => ({ timestamp: m.timestamp, value: m.duration })),
          color: this.getColorByIndex(index)
        };
      });
    }
    
    // Filter metrics for the specified operation and limit the number of data points
    const filteredMetrics = metrics
      .filter(m => m.operationName === operationName)
      .slice(-limit);
    
    return [{
      label: operationName,
      data: filteredMetrics.map(m => ({ timestamp: m.timestamp, value: m.duration })),
      color: this.getColorByIndex(0)
    }];
  }

  /**
   * Generate a hierarchical visualization of the profile report
   * @param report Profile report
   * @returns Hierarchical data structure for visualization
   */
  public static generateHierarchicalData(report: ProfileReport[]): any {
    return {
      name: 'root',
      children: report.map(entry => this.transformReportToHierarchy(entry))
    };
  }

  /**
   * Transform a profile report entry to a hierarchical structure
   * @param report Profile report entry
   * @returns Hierarchical data structure
   */
  private static transformReportToHierarchy(report: ProfileReport): any {
    return {
      name: report.name,
      value: report.duration,
      percentage: report.percentage,
      callCount: report.callCount,
      averageDuration: report.averageDuration,
      memoryDelta: report.memoryDelta,
      children: report.children.map(child => this.transformReportToHierarchy(child))
    };
  }

  /**
   * Generate a set of colors for charts
   * @param count Number of colors to generate
   * @param alpha Alpha value for colors (0-1)
   * @returns Array of color strings
   */
  private static generateColors(count: number, alpha: number = 0.6): string[] {
    const colors: string[] = [];
    
    // Predefined color palette
    const baseColors = [
      [255, 99, 132],   // Red
      [54, 162, 235],   // Blue
      [255, 206, 86],   // Yellow
      [75, 192, 192],   // Teal
      [153, 102, 255],  // Purple
      [255, 159, 64],   // Orange
      [199, 199, 199],  // Gray
      [83, 102, 255],   // Indigo
      [255, 99, 255],   // Pink
      [0, 168, 133]     // Green
    ];
    
    for (let i = 0; i < count; i++) {
      const colorIndex = i % baseColors.length;
      const [r, g, b] = baseColors[colorIndex];
      colors.push(`rgba(${r}, ${g}, ${b}, ${alpha})`);
    }
    
    return colors;
  }

  /**
   * Get a color by index
   * @param index Color index
   * @param alpha Alpha value (0-1)
   * @returns Color string
   */
  private static getColorByIndex(index: number, alpha: number = 0.6): string {
    const baseColors = [
      [255, 99, 132],   // Red
      [54, 162, 235],   // Blue
      [255, 206, 86],   // Yellow
      [75, 192, 192],   // Teal
      [153, 102, 255],  // Purple
      [255, 159, 64],   // Orange
      [199, 199, 199],  // Gray
      [83, 102, 255],   // Indigo
      [255, 99, 255],   // Pink
      [0, 168, 133]     // Green
    ];
    
    const colorIndex = index % baseColors.length;
    const [r, g, b] = baseColors[colorIndex];
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Format duration for display
   * @param duration Duration in milliseconds
   * @returns Formatted duration string
   */
  public static formatDuration(duration: number): string {
    if (duration < 1) {
      return `${(duration * 1000).toFixed(2)}μs`;
    } else if (duration < 1000) {
      return `${duration.toFixed(2)}ms`;
    } else {
      return `${(duration / 1000).toFixed(2)}s`;
    }
  }

  /**
   * Format memory size for display
   * @param sizeInMB Size in megabytes
   * @returns Formatted size string
   */
  public static formatMemorySize(sizeInMB: number): string {
    if (Math.abs(sizeInMB) < 0.001) {
      return '0 MB';
    } else if (Math.abs(sizeInMB) < 1) {
      return `${(sizeInMB * 1024).toFixed(2)} KB`;
    } else {
      return `${sizeInMB.toFixed(2)} MB`;
    }
  }

  /**
   * Format timestamp for display
   * @param timestamp Timestamp in milliseconds
   * @returns Formatted timestamp string
   */
  public static formatTimestamp(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  }
}
