# Refactoring Plan for File Content Aggregator

This document outlines a comprehensive plan for refactoring the File Content Aggregator application to improve performance, maintainability, and code quality. The plan is organized by priority areas, with specific implementation details for each.

## Priority Areas

1. **Search Algorithm Optimization**
2. **Memory Management in File Processing**
3. **UI Performance Optimization**
4. **Worker Thread Utilization**
5. **Caching Strategy Improvements**
6. **Code Organization and Maintainability**

## 1. Search Algorithm Optimization

### Issues Identified:
- Multiple implementations of fuzzy search with redundant code
- Inefficient string matching in the NEAR operator
- Excessive memory usage in word boundary caching
- Potential performance bottlenecks in complex boolean queries

### Implementation Plan:

#### 1.1 Unified Fuzzy Search Utility
- Create a dedicated `FuzzySearchService` module
- Implement lazy loading of Fuse.js
- Add result caching to avoid redundant operations
- Standardize fuzzy search options across the application

```typescript
// src/electron/services/FuzzySearchService.ts
export class FuzzySearchService {
  private static instance: FuzzySearchService;
  private fuseCache = new Map<string, any>(); // Cache Fuse instances
  private resultCache = new Map<string, any>(); // Cache search results
  
  // Singleton pattern
  public static getInstance(): FuzzySearchService {
    if (!FuzzySearchService.instance) {
      FuzzySearchService.instance = new FuzzySearchService();
    }
    return FuzzySearchService.instance;
  }
  
  // Perform fuzzy search with caching
  public search(content: string, term: string, options: FuzzySearchOptions): boolean {
    // Implementation with caching logic
  }
}
```

#### 1.2 NEAR Operator Optimization
- Implement a more efficient algorithm for proximity detection
- Add early termination for impossible matches
- Optimize index comparison logic
- Reduce memory footprint during operation

#### 1.3 Word Boundary Cache Improvements
- Implement size-limited LRU cache
- Add proper cleanup on search completion
- Optimize memory usage for large files
- Add cache statistics for monitoring

## 2. Memory Management in File Processing

### Issues Identified:
- Potential memory leaks in file content processing
- Large file sets held in memory during search operations
- Inefficient handling of large content strings

### Implementation Plan:

#### 2.1 Streaming File Processing
- Process files in chunks rather than loading entire content
- Add early termination for non-matching files
- Implement proper resource cleanup
- Use Node.js streams for efficient file reading

```typescript
// Example implementation for streaming file processing
async function processFileInChunks(filePath: string, matcher: ContentMatcher): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const readStream = fs.createReadStream(filePath, { 
      encoding: 'utf8',
      highWaterMark: 64 * 1024 // 64KB chunks
    });
    
    let buffer = '';
    let matched = false;
    
    readStream.on('data', (chunk) => {
      buffer += chunk;
      
      // Process complete lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      // Check if any complete line matches
      for (const line of lines) {
        if (matcher(line)) {
          matched = true;
          readStream.destroy(); // Early termination
          break;
        }
      }
    });
    
    readStream.on('end', () => {
      // Check remaining buffer
      if (!matched && buffer.length > 0) {
        matched = matcher(buffer);
      }
      resolve(matched);
    });
    
    readStream.on('error', (err) => reject(err));
  });
}
```

#### 2.2 Result Pagination
- Modify the search API to support pagination
- Implement lazy loading of search results
- Add virtual scrolling for large result sets
- Store minimal metadata in memory, load content on demand

#### 2.3 String Handling Optimization
- Minimize string concatenation operations
- Use string interning where appropriate
- Implement proper string object cleanup
- Consider using TypedArrays for large string operations

## 3. UI Performance Optimization

### Issues Identified:
- Inefficient re-rendering in ResultsDisplay component
- Excessive prop drilling
- Redundant state updates triggering unnecessary renders

### Implementation Plan:

#### 3.1 Component Rendering Optimization
- Apply React.memo to performance-critical components
- Implement shouldComponentUpdate where needed
- Use useCallback and useMemo consistently
- Optimize dependency arrays in hooks

```typescript
// Example of optimizing TreeRow component
const TreeRow = React.memo(({ index, style, data }: ListChildComponentProps<TreeRowData>) => {
  // Component implementation
}, (prevProps, nextProps) => {
  // Custom comparison function to prevent unnecessary re-renders
  return prevProps.index === nextProps.index && 
         prevProps.data.items[prevProps.index]?.filePath === 
         nextProps.data.items[nextProps.index]?.filePath &&
         prevProps.data.highlightUpdateCounter === nextProps.data.highlightUpdateCounter;
});
```

#### 3.2 State Management Improvements
- Reduce state updates by combining related state
- Implement context API for shared state
- Use reducers for complex state logic
- Add state normalization for complex data structures

#### 3.3 List Rendering Optimization
- Fine-tune react-window configuration
- Implement better item size estimation
- Add proper list item recycling
- Optimize the getItemSize function

## 4. Worker Thread Utilization

### Issues Identified:
- Only syntax highlighting is currently offloaded to a worker
- CPU-intensive search operations block the main thread

### Implementation Plan:

#### 4.1 Search Worker Implementation
- Create a dedicated search worker
- Implement message-based communication
- Add proper error handling and recovery
- Support cancellation of in-progress operations

```typescript
// src/ui/workers/search.worker.ts
self.onmessage = (event) => {
  const { id, action, payload } = event.data;
  
  switch (action) {
    case 'search':
      try {
        const { content, term, options } = payload;
        const result = performSearch(content, term, options);
        self.postMessage({ id, result, status: 'success' });
      } catch (error) {
        self.postMessage({ 
          id, 
          error: error instanceof Error ? error.message : String(error),
          status: 'error' 
        });
      }
      break;
      
    case 'cancel':
      // Handle cancellation
      break;
  }
};
```

#### 4.2 Worker Pool Implementation
- Create a configurable worker pool
- Add work distribution logic
- Implement proper worker lifecycle management
- Add adaptive scaling based on system capabilities

#### 4.3 Progress Reporting Enhancements
- Add detailed progress updates from workers
- Implement cancellation support
- Add error recovery mechanisms
- Provide better user feedback during long operations

## 5. Caching Strategy Improvements

### Issues Identified:
- Inefficient cache invalidation
- No size limits on caches
- Redundant cache lookups

### Implementation Plan:

#### 5.1 LRU Cache Implementation
- Add size limits to all caches
- Implement proper eviction policies
- Add cache statistics for monitoring
- Optimize cache key generation

```typescript
// src/lib/LRUCache.ts
export class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;
  private stats = { hits: 0, misses: 0, evictions: 0 };
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }
  
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
  
  set(key: K, value: V): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Evict least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    this.cache.set(key, value);
  }
  
  // Additional methods for cache management
}
```

#### 5.2 Cache Invalidation Strategy
- Implement targeted cache invalidation
- Add time-based expiration
- Implement proper cleanup on component unmount
- Add cache versioning for invalidation on code changes

#### 5.3 Cache Lookup Optimization
- Optimize key generation for better lookup performance
- Implement batch operations where appropriate
- Add prefetching for predictable access patterns
- Implement cache warming for common operations

## 6. Code Organization and Maintainability

### Issues Identified:
- Mixed concerns in fileSearchService.ts
- Redundant utility functions across files
- Inconsistent error handling

### Implementation Plan:

#### 6.1 Module Restructuring
- Split fileSearchService.ts into smaller, focused modules:
  - FileDiscoveryService
  - ContentMatchingService
  - SearchResultProcessor
- Improve separation of concerns
- Enhance testability

```
src/
├── electron/
│   ├── services/
│   │   ├── FileDiscoveryService.ts
│   │   ├── ContentMatchingService.ts
│   │   ├── SearchResultProcessor.ts
│   │   ├── FuzzySearchService.ts
│   │   └── index.ts
```

#### 6.2 Shared Utilities
- Create a shared utilities module
- Consolidate common functions
- Implement proper error handling
- Add comprehensive documentation

#### 6.3 Error Handling Standardization
- Create consistent error types
- Implement proper error propagation
- Add user-friendly error messages
- Implement error logging and telemetry

```typescript
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
  
  static fileNotFound(path: string): AppError {
    return new AppError(
      `File not found: ${path}`,
      'FILE_NOT_FOUND',
      { path }
    );
  }
  
  static searchError(message: string, details?: unknown): AppError {
    return new AppError(
      message,
      'SEARCH_ERROR',
      details
    );
  }
  
  // Additional factory methods for common errors
}
```

## Implementation Timeline

### Phase 1: Foundation (Weeks 1-2)
- Implement LRU Cache
- Create unified FuzzySearchService
- Restructure fileSearchService.ts into smaller modules

### Phase 2: Performance Improvements (Weeks 3-4)
- Optimize NEAR operator
- Implement streaming file processing
- Optimize UI component rendering

### Phase 3: Advanced Features (Weeks 5-6)
- Implement search worker
- Create worker pool
- Add result pagination

### Phase 4: Refinement (Weeks 7-8)
- Standardize error handling
- Optimize cache invalidation
- Add comprehensive documentation

## Success Metrics

The success of this refactoring plan will be measured by:

1. **Performance Improvements:**
   - 50% reduction in search time for large file sets
   - 30% reduction in memory usage
   - Smoother UI experience with no blocking operations

2. **Code Quality:**
   - Improved test coverage
   - Reduced complexity metrics
   - Better separation of concerns

3. **Developer Experience:**
   - Easier onboarding for new contributors
   - More maintainable codebase
   - Better documentation

## Conclusion

This refactoring plan addresses key performance and maintainability issues in the File Content Aggregator application. By implementing these changes in a phased approach, we can improve the application's performance, reduce resource usage, and create a more maintainable codebase for future development.
