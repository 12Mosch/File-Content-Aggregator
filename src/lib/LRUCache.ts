/**
 * LRU (Least Recently Used) Cache implementation
 * This cache automatically evicts the least recently used items when it reaches capacity
 */

export interface CacheStats {
  hits: number;
  misses: number;
  evictions: number;
  size: number;
  capacity: number;
  hitRate: number;
  timeToLive?: number;
}

interface CacheEntry<V> {
  value: V;
  expires?: number; // Timestamp when this entry expires
}

export class LRUCache<K, V> {
  private cache = new Map<K, CacheEntry<V>>();
  private maxSize: number;
  private timeToLive?: number; // Time in milliseconds before entries expire
  private stats = { hits: 0, misses: 0, evictions: 0 };

  /**
   * Creates a new LRU cache with the specified maximum size
   * @param maxSize Maximum number of items to store in the cache (default: 100)
   * @param timeToLive Optional time in milliseconds before entries expire
   */
  constructor(maxSize = 100, timeToLive?: number) {
    this.maxSize = maxSize;
    this.timeToLive = timeToLive;
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

    if (this.cache.has(key)) {
      // Update existing entry
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
        this.stats.evictions++;
      }
    }

    // Create the cache entry
    const entry: CacheEntry<V> = { value };

    // Set expiration if applicable
    const ttl = customTTL !== undefined ? customTTL : this.timeToLive;
    if (ttl !== undefined) {
      entry.expires = Date.now() + ttl;
    }

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
      this.cache.delete(key);
      this.stats.evictions++;
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
   * Creates a cache key from multiple values
   * @param values Values to include in the key
   * @returns A string key
   */
  static createKey(...values: unknown[]): string {
    return values
      .map((v) => {
        if (v === null) return "null";
        if (v === undefined) return "undefined";
        if (typeof v === "object") return JSON.stringify(v);
        return String(v);
      })
      .join(":");
  }
}
