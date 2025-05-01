/**
 * LRU (Least Recently Used) Cache implementation
 * This cache automatically evicts the least recently used items when it reaches capacity
 * or when memory pressure is high. It also provides memory usage estimation.
 */

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  capacity: number;
  hitRate: number;
  timeToLive?: number;
  estimatedMemoryUsage?: number;
}

interface CacheEntry<V> {
  value: V;
  expires?: number; // Timestamp when this entry expires
  size?: number; // Estimated size in bytes
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private timeToLive?: number; // Time in milliseconds before entries expire
  private maxMemorySize?: number; // Maximum memory size in bytes
  private estimatedMemoryUsage = 0; // Estimated memory usage in bytes
  private stats = { hits: 0, misses: 0, evictions: 0 };
  private memoryPressureListener:
    | ((pressure: "low" | "medium" | "high") => void)
    | null = null;

  /**
   * Creates a new LRU cache with the specified maximum size
   * @param maxSize Maximum number of items to store in the cache (default: 100)
   * @param timeToLive Optional time in milliseconds before entries expire
   * @param maxMemorySize Optional maximum memory size in bytes
   */
  constructor(maxSize = 100, timeToLive?: number, maxMemorySize?: number) {
    this.maxSize = maxSize;
    this.timeToLive = timeToLive;
    this.maxMemorySize = maxMemorySize;

    // Try to set up memory pressure handling
    this.setupMemoryPressureHandling();
  }

  /**
   * Gets a value from the cache
   * @param key The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      const entry = this.cache.get(key)!;

      // Check if the entry has expired
      if (entry.expires && entry.expires < Date.now()) {
        this.cache.delete(key);
        this.stats.evictions++;
        this.stats.misses++;
        return undefined;
      }

      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, entry);
      this.stats.hits++;
      return entry.value;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Sets a value in the cache
   * @param key The key to store
   * @param value The value to store
   * @param customTTL Optional custom time-to-live in milliseconds for this specific entry
   */
  set(key: K, value: V, customTTL?: number): void {
    // Remove expired entries before checking size
    this.removeExpiredEntries();

    // Calculate the size of the new entry
    const entrySize =
      this.estimateObjectSize(key) + this.estimateObjectSize(value);

    // If we already have this key, subtract its current size from our total
    if (this.cache.has(key)) {
      const existingEntry = this.cache.get(key)!;
      if (existingEntry.size !== undefined) {
        this.estimatedMemoryUsage -= existingEntry.size;
      }
      // Update existing entry
      this.cache.delete(key);
    }
    // Check if we need to evict based on count
    else if (this.cache.size >= this.maxSize) {
      this.evictLeastRecentlyUsed();
    }

    // Check if we need to evict based on memory size
    if (
      this.maxMemorySize &&
      this.estimatedMemoryUsage + entrySize > this.maxMemorySize
    ) {
      // Keep evicting until we have enough space
      while (
        this.maxMemorySize &&
        this.estimatedMemoryUsage + entrySize > this.maxMemorySize &&
        this.cache.size > 0
      ) {
        this.evictLeastRecentlyUsed();
      }
    }

    // Create the cache entry
    const entry: CacheEntry<V> = {
      value,
      size: entrySize,
    };

    // Set expiration if applicable
    const ttl = customTTL !== undefined ? customTTL : this.timeToLive;
    if (ttl !== undefined) {
      entry.expires = Date.now() + ttl;
    }

    // Update our memory usage estimate
    this.estimatedMemoryUsage += entrySize;

    this.cache.set(key, entry);
  }

  /**
   * Checks if a key exists in the cache and is not expired
   * @param key The key to check
   * @returns True if the key exists and is not expired, false otherwise
   */
  has(key: K): boolean {
    if (!this.cache.has(key)) return false;

    const entry = this.cache.get(key)!;
    if (entry.expires && entry.expires < Date.now()) {
      this.cache.delete(key);
      this.stats.evictions++;
      return false;
    }

    return true;
  }

  /**
   * Removes all expired entries from the cache
   * @returns The number of entries removed
   */
  removeExpiredEntries(): number {
    if (!this.timeToLive) return 0;

    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires && entry.expires < now) {
        this.cache.delete(key);
        this.stats.evictions++;
        removed++;
      }
    }

    return removed;
  }

  /**
   * Deletes a key from the cache
   * @param key The key to delete
   * @returns True if the key was deleted, false if it didn't exist
   */
  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clears all items from the cache
   */
  clear(): void {
    this.cache.clear();
    this.resetStats();
  }

  /**
   * Gets the current size of the cache
   * @returns The number of items in the cache
   */
  size(): number {
    this.removeExpiredEntries();
    return this.cache.size;
  }

  /**
   * Gets the maximum size of the cache
   * @returns The maximum number of items the cache can hold
   */
  capacity(): number {
    return this.maxSize;
  }

  /**
   * Gets the maximum size of the cache (alias for capacity)
   * @returns The maximum number of items the cache can hold
   */
  getMaxSize(): number {
    return this.maxSize;
  }

  /**
   * Sets a new maximum size for the cache
   * @param size The new maximum size
   */
  setMaxSize(size: number): void {
    this.maxSize = size;
    this.removeExcessItems();
  }

  /**
   * Remove excess items from the cache if it exceeds the maximum size
   */
  private removeExcessItems(): void {
    if (this.cache.size <= this.maxSize) return;

    const itemsToRemove = this.cache.size - this.maxSize;
    const keys = this.cache.keys();

    for (let i = 0; i < itemsToRemove; i++) {
      const key = keys.next().value;
      if (key !== undefined) {
        this.cache.delete(key);
        this.stats.evictions++;
      }
    }
  }

  /**
   * Gets the cache statistics
   * @returns An object with hit, miss, eviction counts, and other stats
   */
  getStats(): CacheStats {
    // Remove expired entries before calculating stats
    this.removeExpiredEntries();

    const totalAccesses = this.stats.hits + this.stats.misses;
    const hitRate = totalAccesses > 0 ? this.stats.hits / totalAccesses : 0;

    return {
      ...this.stats,
      size: this.cache.size,
      capacity: this.maxSize,
      hitRate,
      timeToLive: this.timeToLive,
      estimatedMemoryUsage: this.estimatedMemoryUsage,
    };
  }

  /**
   * Resets the cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Gets all keys in the cache (removing expired entries first)
   * @returns An array of all keys in the cache
   */
  keys(): K[] {
    this.removeExpiredEntries();
    return Array.from(this.cache.keys());
  }

  /**
   * Gets all values in the cache (removing expired entries first)
   * @returns An array of all values in the cache
   */
  values(): V[] {
    this.removeExpiredEntries();
    return Array.from(this.cache.values()).map((entry) => entry.value);
  }

  /**
   * Gets all entries in the cache (removing expired entries first)
   * @returns An array of [key, value] pairs
   */
  entries(): [K, V][] {
    this.removeExpiredEntries();
    return Array.from(this.cache.entries()).map(([key, entry]) => [
      key,
      entry.value,
    ]);
  }

  /**
   * Sets the time-to-live for cache entries
   * @param timeToLive Time in milliseconds before entries expire (undefined to disable expiration)
   */
  setTimeToLive(timeToLive?: number): void {
    this.timeToLive = timeToLive;
    if (timeToLive !== undefined) {
      this.removeExpiredEntries();
    }
  }

  /**
   * Gets the current time-to-live setting
   * @returns The current time-to-live in milliseconds, or undefined if not set
   */
  getTimeToLive(): number | undefined {
    return this.timeToLive;
  }

  /**
   * Gets the current size of the cache
   * @returns The number of items in the cache
   */
  getSize(): number {
    return this.cache.size;
  }

  /**
   * Trims the cache to the specified size by removing the least recently used items
   * @param newSize The new maximum size
   * @returns The number of items removed
   */
  trimToSize(newSize: number): number {
    if (newSize >= this.cache.size) return 0;
    if (newSize < 0) newSize = 0;

    const itemsToRemove = this.cache.size - newSize;
    const keys = this.cache.keys();
    let removed = 0;

    for (let i = 0; i < itemsToRemove; i++) {
      const key = keys.next().value;
      if (key !== undefined) {
        this.cache.delete(key);
        this.stats.evictions++;
        removed++;
      }
    }

    return removed;
  }

  /**
   * Creates a cache key from multiple values
   * @param values Values to include in the key
   * @returns A string key
   */
  static createKey(...values: unknown[]): string {
    return values
      .map((v) => {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (typeof v === "object") {
          try {
            return JSON.stringify(v);
          } catch (_e) {
            // Use a more specific format than default toString()
            return `[object ${Object.prototype.toString.call(v).slice(8, -1)}]`;
          }
        }
        // Handle primitive types safely
        if (typeof v === "string") return v;
        if (
          typeof v === "number" ||
          typeof v === "boolean" ||
          typeof v === "bigint"
        ) {
          return v.toString();
        }
        if (typeof v === "symbol") {
          return v.description ?? "Symbol";
        }
        if (typeof v === "function") {
          return "[function]";
        }
        // Fallback for any other types
        return `[${typeof v}]`;
      })
      .join(":");
  }

  /**
   * Evict the least recently used item from the cache
   * @returns True if an item was evicted, false if the cache was empty
   */
  private evictLeastRecentlyUsed(): boolean {
    if (this.cache.size === 0) return false;

    const firstKey = this.cache.keys().next().value;
    if (firstKey !== undefined) {
      const entry = this.cache.get(firstKey)!;

      // Update memory usage estimate
      if (entry.size !== undefined) {
        this.estimatedMemoryUsage -= entry.size;
      }

      this.cache.delete(firstKey);
      this.stats.evictions++;
      return true;
    }

    return false;
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
      // We know obj is an object at this point
      const objAsRecord = obj as Record<string, unknown>;
      for (const key in objAsRecord) {
        if (Object.prototype.hasOwnProperty.call(objAsRecord, key)) {
          size += key.length * 2; // Key size
          size += this.estimateObjectSize(objAsRecord[key]); // Value size
        }
      }
      return size;
    }

    return 0;
  }

  /**
   * Set up memory pressure handling
   * This will automatically trim the cache when memory pressure is high
   */
  private setupMemoryPressureHandling(): void {
    // In test environments, we might not have access to dynamic imports
    // or the MemoryMonitor might be mocked differently
    if (process.env.NODE_ENV === "test") {
      return;
    }

    try {
      // Try to import the MemoryMonitor dynamically
      // This is done to avoid circular dependencies
      import("./services/MemoryMonitor.js")
        .then((module) => {
          const MemoryMonitor = module.MemoryMonitor;
          const monitor = MemoryMonitor.getInstance();

          // Set up a listener for memory pressure changes
          this.memoryPressureListener = (pressure) => {
            if (pressure === "high") {
              // Under high memory pressure, trim the cache aggressively
              this.trimToSize(Math.floor(this.maxSize * 0.5)); // Reduce to 50%
            } else if (pressure === "medium") {
              // Under medium pressure, do a moderate trim
              this.trimToSize(Math.floor(this.maxSize * 0.75)); // Reduce to 75%
            }
          };

          // Add the listener to the monitor
          monitor.addListener(
            (stats: { memoryPressure: "low" | "medium" | "high" }) => {
              if (this.memoryPressureListener) {
                this.memoryPressureListener(stats.memoryPressure);
              }
            }
          );

          // Start monitoring if not already started
          if (!monitor.isMonitoringEnabled()) {
            monitor.startMonitoring();
          }
        })
        .catch((error) => {
          // Silently fail if MemoryMonitor is not available
          // This allows the LRUCache to work without the MemoryMonitor
          console.debug("MemoryMonitor not available for LRUCache", error);
        });
    } catch (_error) {
      // Silently fail if dynamic import is not supported
      console.debug(
        "Dynamic import not supported for MemoryMonitor integration"
      );
    }
  }

  /**
   * Set the maximum memory size for this cache
   * @param maxMemorySize Maximum memory size in bytes, or undefined to disable
   */
  public setMaxMemorySize(maxMemorySize?: number): void {
    this.maxMemorySize = maxMemorySize;

    // If we're over the new limit, trim the cache
    if (
      maxMemorySize !== undefined &&
      this.estimatedMemoryUsage > maxMemorySize
    ) {
      // Keep evicting until we're under the limit
      while (this.estimatedMemoryUsage > maxMemorySize && this.cache.size > 0) {
        this.evictLeastRecentlyUsed();
      }
    }
  }

  /**
   * Get the current maximum memory size setting
   * @returns The maximum memory size in bytes, or undefined if not set
   */
  public getMaxMemorySize(): number | undefined {
    return this.maxMemorySize;
  }

  /**
   * Get the current estimated memory usage
   * @returns The estimated memory usage in bytes
   */
  public getEstimatedMemoryUsage(): number {
    return this.estimatedMemoryUsage;
  }
}
