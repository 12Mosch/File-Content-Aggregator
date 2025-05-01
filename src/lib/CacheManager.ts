/**
 * Cache Manager
 *
 * Centralized service for managing application caches.
 * Provides a unified interface for creating, accessing, and monitoring caches.
 */

import { LRUCache, CacheStats } from "./LRUCache.js";

export interface CacheConfig {
  maxSize: number;
  timeToLive?: number; // Time in milliseconds
  name: string;
}

export interface CacheInfo extends CacheStats {
  name: string;
}

export interface CacheMetricsHistory {
  timestamp: number;
  cacheId: string;
  cacheName: string;
  size: number;
  capacity: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictions: number;
  memoryUsage: number;
  cacheEfficiencyScore?: number;
}

export class CacheManager {
  private static instance: CacheManager;
  private caches: Map<string, LRUCache<unknown, unknown>> = new Map();
  private configs: Map<string, CacheConfig> = new Map();
  private metricsHistory: CacheMetricsHistory[] = [];
  private historyLimit: number = 1000; // Limit the number of historical metrics
  private metricsInterval: NodeJS.Timeout | null = null;

  /**
   * Get the singleton instance
   */
  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  /**
   * Private constructor (use getInstance)
   */
  private constructor() {
    // Initialize with default settings
    this.setupDefaultCaches();

    // Start collecting metrics
    this.startMetricsCollection();
  }

  /**
   * Set up default caches with appropriate configurations
   */
  private setupDefaultCaches(): void {
    // Search results cache
    this.createCache("searchResults", {
      maxSize: 50,
      timeToLive: 30 * 60 * 1000, // 30 minutes
      name: "Search Results",
    });

    // File content cache
    this.createCache("fileContent", {
      maxSize: 100,
      timeToLive: 5 * 60 * 1000, // 5 minutes
      name: "File Content",
    });

    // Highlight cache
    this.createCache("highlight", {
      maxSize: 200,
      name: "Syntax Highlighting",
    });

    // UI state cache
    this.createCache("uiState", {
      maxSize: 20,
      name: "UI State",
    });
  }

  /**
   * Create a new cache with the specified configuration
   * @param id Unique identifier for the cache
   * @param config Cache configuration
   * @returns The created cache
   */
  public createCache<K, V>(id: string, config: CacheConfig): LRUCache<K, V> {
    if (this.caches.has(id)) {
      throw new Error(`Cache with ID '${id}' already exists`);
    }

    const cache = new LRUCache<K, V>(config.maxSize, config.timeToLive);
    this.caches.set(id, cache);
    this.configs.set(id, config);

    return cache;
  }

  /**
   * Get a cache by its ID
   * @param id The cache ID
   * @returns The cache or undefined if not found
   */
  public getCache<K, V>(id: string): LRUCache<K, V> | undefined {
    return this.caches.get(id) as LRUCache<K, V> | undefined;
  }

  /**
   * Get or create a cache
   * @param id The cache ID
   * @param config Configuration to use if the cache needs to be created
   * @returns The existing or newly created cache
   */
  public getOrCreateCache<K, V>(
    id: string,
    config: CacheConfig
  ): LRUCache<K, V> {
    const existing = this.getCache<K, V>(id);
    if (existing) return existing;
    return this.createCache<K, V>(id, config);
  }

  /**
   * Remove a cache
   * @param id The cache ID
   * @returns True if the cache was removed, false if it didn't exist
   */
  public removeCache(id: string): boolean {
    this.configs.delete(id);
    return this.caches.delete(id);
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }

  /**
   * Get information about all caches
   * @returns Array of cache information
   */
  public getAllCacheInfo(): CacheInfo[] {
    return Array.from(this.caches.entries()).map(([id, cache]) => {
      const config = this.configs.get(id)!;
      return {
        ...cache.getStats(),
        name: config.name,
      };
    });
  }

  /**
   * Get information about a specific cache
   * @param id The cache ID
   * @returns Cache information or undefined if not found
   */
  public getCacheInfo(id: string): CacheInfo | undefined {
    const cache = this.caches.get(id);
    const config = this.configs.get(id);

    if (!cache || !config) return undefined;

    return {
      ...cache.getStats(),
      name: config.name,
    };
  }

  /**
   * Update a cache's configuration
   * @param id The cache ID
   * @param config The new configuration
   * @returns True if the cache was updated, false if it doesn't exist
   */
  public updateCacheConfig(id: string, config: Partial<CacheConfig>): boolean {
    const cache = this.caches.get(id);
    const existingConfig = this.configs.get(id);

    if (!cache || !existingConfig) return false;

    // Update the configuration
    const newConfig = { ...existingConfig, ...config };
    this.configs.set(id, newConfig);

    // Update the cache settings
    if (config.maxSize !== undefined && config.maxSize !== cache.getMaxSize()) {
      cache.setMaxSize(config.maxSize);
    }

    if (
      config.timeToLive !== undefined &&
      config.timeToLive !== cache.getTimeToLive()
    ) {
      cache.setTimeToLive(config.timeToLive);
    }

    return true;
  }

  /**
   * Get the total memory usage of all caches (approximate)
   * @returns Approximate memory usage in bytes
   */
  public getMemoryUsage(): number {
    let totalSize = 0;

    for (const [_id, cache] of this.caches.entries()) {
      const entries = cache.entries();

      // Estimate size of each entry
      for (const [key, value] of entries) {
        totalSize += this.estimateObjectSize(key);
        totalSize += this.estimateObjectSize(value);
      }
    }

    return totalSize;
  }

  /**
   * Estimate the size of an object in bytes (approximate)
   * @param obj The object to measure
   * @returns Approximate size in bytes
   */
  private estimateObjectSize(obj: unknown): number {
    if (obj === null || obj === undefined) return 0;

    const type = typeof obj;

    if (type === "number") return 8;
    if (type === "boolean") return 4;
    if (type === "string") return (obj as string).length * 2;

    if (type === "object") {
      if (Array.isArray(obj)) {
        return obj.reduce<number>(
          (size, item) => size + this.estimateObjectSize(item),
          0
        );
      }

      let size = 0;
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          size += key.length * 2; // Key size
          size += this.estimateObjectSize(
            (obj as Record<string, unknown>)[key]
          ); // Value size
        }
      }
      return size;
    }

    return 0;
  }

  /**
   * Start collecting cache metrics at regular intervals
   * @param intervalMs Interval in milliseconds (default: 60000 - 1 minute)
   */
  public startMetricsCollection(intervalMs = 60000): void {
    // Clear any existing interval
    this.stopMetricsCollection();

    // Set up a new interval
    this.metricsInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);
  }

  /**
   * Stop collecting cache metrics
   */
  public stopMetricsCollection(): void {
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = null;
    }
  }

  /**
   * Collect metrics from all caches and add to history
   */
  private collectMetrics(): void {
    const timestamp = Date.now();

    for (const [id, cache] of this.caches.entries()) {
      const config = this.configs.get(id)!;
      const stats = cache.getStats();

      this.metricsHistory.push({
        timestamp,
        cacheId: id,
        cacheName: config.name,
        size: stats.size,
        capacity: stats.capacity,
        hitRate: stats.hitRate,
        hits: stats.hits,
        misses: stats.misses,
        evictions: stats.evictions,
        memoryUsage: stats.estimatedMemoryUsage || 0,
        cacheEfficiencyScore: stats.cacheEfficiencyScore,
      });
    }

    // Trim history if it exceeds the limit
    if (this.metricsHistory.length > this.historyLimit) {
      this.metricsHistory = this.metricsHistory.slice(-this.historyLimit);
    }
  }

  /**
   * Get the cache metrics history
   * @param cacheId Optional cache ID to filter by
   * @param limit Maximum number of entries to return
   * @returns Array of cache metrics history entries
   */
  public getMetricsHistory(
    cacheId?: string,
    limit = 100
  ): CacheMetricsHistory[] {
    // Force collection of current metrics
    this.collectMetrics();

    let history = [...this.metricsHistory];

    // Filter by cache ID if specified
    if (cacheId) {
      history = history.filter((entry) => entry.cacheId === cacheId);
    }

    // Return the most recent entries up to the limit
    return history.slice(-limit);
  }

  /**
   * Clear the metrics history
   */
  public clearMetricsHistory(): void {
    this.metricsHistory = [];
  }
}
