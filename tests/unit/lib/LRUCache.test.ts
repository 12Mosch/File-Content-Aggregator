/**
 * LRU Cache Tests
 *
 * Tests the enhanced LRUCache implementation with time-based expiration.
 */

import { LRUCache } from "../../../src/lib/LRUCache";

describe("LRUCache", () => {
  let cache: LRUCache<string, number>;

  beforeEach(() => {
    cache = new LRUCache<string, number>(3);
  });

  test("should store and retrieve values", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
  });

  test("should evict least recently used items when full", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    cache.set("d", 4); // This should evict 'a'

    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("b")).toBe(2);
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  test("should update access order when getting items", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Access 'a' to make it most recently used
    cache.get("a");

    // Add a new item, which should evict 'b' (now the least recently used)
    cache.set("d", 4);

    expect(cache.get("a")).toBe(1);
    expect(cache.get("b")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
    expect(cache.get("d")).toBe(4);
  });

  test("should handle time-based expiration", () => {
    // Create a cache with 1 second TTL
    const ttlCache = new LRUCache<string, number>(3, 1000);

    ttlCache.set("a", 1);
    ttlCache.set("b", 2);

    expect(ttlCache.get("a")).toBe(1);
    expect(ttlCache.get("b")).toBe(2);

    // Mock Date.now to simulate time passing
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 2000); // 2 seconds later

    // Items should be expired now
    expect(ttlCache.get("a")).toBeUndefined();
    expect(ttlCache.get("b")).toBeUndefined();

    // Restore Date.now
    Date.now = originalNow;
  });

  test("should support custom TTL for specific entries", () => {
    // Create a cache with 10 second default TTL
    const ttlCache = new LRUCache<string, number>(3, 10000);

    // Set 'a' with default TTL (10 seconds)
    ttlCache.set("a", 1);

    // Set 'b' with custom TTL (1 second)
    ttlCache.set("b", 2, 1000);

    expect(ttlCache.get("a")).toBe(1);
    expect(ttlCache.get("b")).toBe(2);

    // Mock Date.now to simulate time passing (2 seconds)
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 2000);

    // 'b' should be expired, but 'a' should still be valid
    expect(ttlCache.get("a")).toBe(1);
    expect(ttlCache.get("b")).toBeUndefined();

    // Restore Date.now
    Date.now = originalNow;
  });

  test("should remove expired entries when checking size", () => {
    // Create a cache with 1 second TTL
    const ttlCache = new LRUCache<string, number>(3, 1000);

    ttlCache.set("a", 1);
    ttlCache.set("b", 2);

    expect(ttlCache.size()).toBe(2);

    // Mock Date.now to simulate time passing
    const originalNow = Date.now;
    Date.now = jest.fn(() => originalNow() + 2000); // 2 seconds later

    // Size should be 0 after removing expired entries
    expect(ttlCache.size()).toBe(0);

    // Restore Date.now
    Date.now = originalNow;
  });

  test("should track cache statistics", () => {
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);

    // Get some values (hits)
    cache.get("a");
    cache.get("b");
    cache.get("a");

    // Try to get a non-existent value (miss)
    cache.get("d");

    // Add a value that causes eviction
    cache.set("d", 4);

    const stats = cache.getStats();
    expect(stats.hits).toBe(3);
    expect(stats.misses).toBe(1);
    expect(stats.evictions).toBe(1);
    expect(stats.size).toBe(3);
    expect(stats.capacity).toBe(3);
    expect(stats.hitRate).toBeCloseTo(0.75, 2); // 3 hits out of 4 accesses
  });

  test("should create cache keys from multiple values", () => {
    const key1 = LRUCache.createKey("user", 123, { role: "admin" });
    const key2 = LRUCache.createKey("user", 123, { role: "admin" });
    const key3 = LRUCache.createKey("user", 456, { role: "admin" });

    expect(key1).toBe(key2); // Same values should produce the same key
    expect(key1).not.toBe(key3); // Different values should produce different keys

    // Test with null and undefined
    const keyWithNull = LRUCache.createKey("test", null, undefined);
    expect(keyWithNull).toBe("test:null:undefined");
  });
});
