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
}

export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private stats = { hits: 0, misses: 0, evictions: 0 };

  /**
   * Creates a new LRU cache with the specified maximum size
   * @param maxSize Maximum number of items to store in the cache (default: 100)
   */
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  /**
   * Gets a value from the cache
   * @param key The key to look up
   * @returns The cached value or undefined if not found
   */
  get(key: K): V | undefined {
    if (this.cache.has(key)) {
      // Move to end (most recently used)
      const value = this.cache.get(key)!;
      this.cache.delete(key);
      this.cache.set(key, value);
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return undefined;
  }

  /**
   * Sets a value in the cache
   * @param key The key to store
   * @param value The value to store
   */
  set(key: K, value: V): void {
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
    this.cache.set(key, value);
  }

  /**
   * Checks if a key exists in the cache
   * @param key The key to check
   * @returns True if the key exists, false otherwise
   */
  has(key: K): boolean {
    return this.cache.has(key);
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
   * Gets the cache statistics
   * @returns An object with hit, miss, and eviction counts
   */
  getStats(): CacheStats {
    return {
      ...this.stats,
      size: this.cache.size,
      capacity: this.maxSize,
    };
  }

  /**
   * Resets the cache statistics
   */
  resetStats(): void {
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Gets all keys in the cache
   * @returns An array of all keys in the cache
   */
  keys(): K[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Gets all values in the cache
   * @returns An array of all values in the cache
   */
  values(): V[] {
    return Array.from(this.cache.values());
  }

  /**
   * Gets all entries in the cache
   * @returns An array of [key, value] pairs
   */
  entries(): [K, V][] {
    return Array.from(this.cache.entries());
  }
}
