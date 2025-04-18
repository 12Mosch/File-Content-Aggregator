/**
 * Mock implementation of CacheManager for testing
 */

import { LRUCache } from "../../src/lib/LRUCache";

export interface CacheConfig {
  maxSize: number;
  timeToLive?: number;
  name: string;
}

export class CacheManager {
  private static instance: CacheManager;
  private caches: Map<string, LRUCache<any, any>> = new Map();

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
  private constructor() {}

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
    const existing = this.caches.get(id) as LRUCache<K, V>;
    if (existing) return existing;

    const cache = new LRUCache<K, V>(config.maxSize, config.timeToLive);
    this.caches.set(id, cache);
    return cache;
  }

  /**
   * Clear all caches
   */
  public clearAllCaches(): void {
    for (const cache of this.caches.values()) {
      cache.clear();
    }
  }
}
