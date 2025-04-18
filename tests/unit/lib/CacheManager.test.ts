/**
 * Cache Manager Tests
 * 
 * Tests the CacheManager service functionality.
 */

import { CacheManager } from '../../../src/lib/CacheManager';

describe('CacheManager', () => {
  let cacheManager: CacheManager;
  
  beforeEach(() => {
    // Reset the singleton instance for each test
    // @ts-expect-error - Accessing private static property for testing
    CacheManager.instance = undefined;
    cacheManager = CacheManager.getInstance();
  });
  
  test('should be a singleton', () => {
    const instance1 = CacheManager.getInstance();
    const instance2 = CacheManager.getInstance();
    expect(instance1).toBe(instance2);
  });
  
  test('should create default caches on initialization', () => {
    // Check that default caches exist
    expect(cacheManager.getCache('searchResults')).toBeDefined();
    expect(cacheManager.getCache('fileContent')).toBeDefined();
    expect(cacheManager.getCache('highlight')).toBeDefined();
    expect(cacheManager.getCache('uiState')).toBeDefined();
  });
  
  test('should create and retrieve caches', () => {
    const testCache = cacheManager.createCache('testCache', {
      maxSize: 10,
      name: 'Test Cache'
    });
    
    expect(testCache).toBeDefined();
    expect(testCache.getMaxSize()).toBe(10);
    
    const retrievedCache = cacheManager.getCache('testCache');
    expect(retrievedCache).toBe(testCache);
  });
  
  test('should throw error when creating a cache with existing ID', () => {
    cacheManager.createCache('uniqueCache', {
      maxSize: 10,
      name: 'Unique Cache'
    });
    
    expect(() => {
      cacheManager.createCache('uniqueCache', {
        maxSize: 20,
        name: 'Duplicate Cache'
      });
    }).toThrow(/already exists/);
  });
  
  test('should get or create a cache', () => {
    // Get a non-existent cache (should create it)
    const newCache = cacheManager.getOrCreateCache('newCache', {
      maxSize: 15,
      name: 'New Cache'
    });
    
    expect(newCache).toBeDefined();
    expect(newCache.getMaxSize()).toBe(15);
    
    // Get an existing cache (should return the same instance)
    const existingCache = cacheManager.getOrCreateCache('newCache', {
      maxSize: 30, // Different size, but should be ignored
      name: 'New Cache'
    });
    
    expect(existingCache).toBe(newCache);
    expect(existingCache.getMaxSize()).toBe(15); // Should still have the original size
  });
  
  test('should remove caches', () => {
    cacheManager.createCache('tempCache', {
      maxSize: 5,
      name: 'Temporary Cache'
    });
    
    expect(cacheManager.getCache('tempCache')).toBeDefined();
    
    const removed = cacheManager.removeCache('tempCache');
    expect(removed).toBe(true);
    expect(cacheManager.getCache('tempCache')).toBeUndefined();
    
    // Try to remove a non-existent cache
    const removedNonExistent = cacheManager.removeCache('nonExistentCache');
    expect(removedNonExistent).toBe(false);
  });
  
  test('should clear all caches', () => {
    // Add some items to the default caches
    const searchCache = cacheManager.getCache<string, string>('searchResults');
    const fileCache = cacheManager.getCache<string, string>('fileContent');
    
    if (searchCache && fileCache) {
      searchCache.set('query1', 'results1');
      fileCache.set('file1.txt', 'content1');
      
      expect(searchCache.get('query1')).toBe('results1');
      expect(fileCache.get('file1.txt')).toBe('content1');
      
      // Clear all caches
      cacheManager.clearAllCaches();
      
      // Caches should be empty but still exist
      expect(searchCache.get('query1')).toBeUndefined();
      expect(fileCache.get('file1.txt')).toBeUndefined();
      expect(cacheManager.getCache('searchResults')).toBeDefined();
      expect(cacheManager.getCache('fileContent')).toBeDefined();
    }
  });
  
  test('should get cache information', () => {
    const testCache = cacheManager.createCache<string, string>('infoCache', {
      maxSize: 10,
      name: 'Info Test Cache'
    });
    
    // Add some items and generate some hits/misses
    testCache.set('key1', 'value1');
    testCache.set('key2', 'value2');
    testCache.get('key1'); // Hit
    testCache.get('key3'); // Miss
    
    const cacheInfo = cacheManager.getCacheInfo('infoCache');
    expect(cacheInfo).toBeDefined();
    if (cacheInfo) {
      expect(cacheInfo.name).toBe('Info Test Cache');
      expect(cacheInfo.size).toBe(2);
      expect(cacheInfo.capacity).toBe(10);
      expect(cacheInfo.hits).toBe(1);
      expect(cacheInfo.misses).toBe(1);
    }
    
    // Get info for all caches
    const allCacheInfo = cacheManager.getAllCacheInfo();
    expect(allCacheInfo.length).toBeGreaterThan(0);
    expect(allCacheInfo.some(info => info.name === 'Info Test Cache')).toBe(true);
  });
  
  test('should update cache configuration', () => {
    const testCache = cacheManager.createCache<string, string>('configCache', {
      maxSize: 10,
      name: 'Config Test Cache'
    });
    
    // Update the configuration
    const updated = cacheManager.updateCacheConfig('configCache', {
      maxSize: 20,
      timeToLive: 5000
    });
    
    expect(updated).toBe(true);
    expect(testCache.getMaxSize()).toBe(20);
    expect(testCache.getTimeToLive()).toBe(5000);
    
    // Try to update a non-existent cache
    const updatedNonExistent = cacheManager.updateCacheConfig('nonExistentCache', {
      maxSize: 30
    });
    
    expect(updatedNonExistent).toBe(false);
  });
  
  test('should estimate memory usage', () => {
    const testCache = cacheManager.createCache<string, string>('memoryCache', {
      maxSize: 10,
      name: 'Memory Test Cache'
    });
    
    // Add some items
    testCache.set('key1', 'small value');
    testCache.set('key2', 'this is a much longer value that should take more memory');
    
    const memoryUsage = cacheManager.getMemoryUsage();
    expect(memoryUsage).toBeGreaterThan(0);
    
    // Add more data and check that memory usage increases
    testCache.set('key3', 'a'.repeat(1000)); // Add a large string
    
    const newMemoryUsage = cacheManager.getMemoryUsage();
    expect(newMemoryUsage).toBeGreaterThan(memoryUsage);
  });
});
