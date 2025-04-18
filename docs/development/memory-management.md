# Memory Management in File Content Aggregator

This document outlines the memory management strategies implemented in the File Content Aggregator application to ensure efficient memory usage, especially when processing large files and handling large result sets.

## Overview

The application implements several memory optimization techniques to prevent memory leaks and reduce memory pressure during file processing operations:

1. **Streaming File Processing**: Large files are processed in chunks rather than loading the entire content into memory.
2. **Memory-Aware Caching**: Caches automatically adjust their size based on memory pressure.
3. **Buffer Management**: Efficient buffer handling to minimize string concatenation operations.
4. **Result Size Limiting**: Automatic limiting of result sizes to prevent memory exhaustion.
5. **Memory Monitoring**: Continuous monitoring of memory usage with automatic optimization when needed.

## Key Components

### MemoryMonitor

The `MemoryMonitor` service tracks memory usage and provides memory pressure information to other components. It categorizes memory pressure as:

- **Low**: Normal operation, no memory optimization needed.
- **Medium**: Some optimization recommended, non-critical caches are trimmed.
- **High**: Aggressive optimization required, most caches are significantly reduced.

```typescript
// Example of memory pressure handling
memoryMonitor.addListener((stats) => {
  if (stats.memoryPressure === 'high') {
    // Perform aggressive memory optimization
    cache.trimToSize(Math.floor(cache.getMaxSize() * 0.3));
  }
});
```

### Memory-Aware LRUCache

The enhanced `LRUCache` implementation includes memory usage estimation and automatic trimming based on memory pressure:

- Tracks estimated memory usage of cached items
- Supports maximum memory size limits
- Automatically trims when memory pressure is high
- Provides memory usage statistics

```typescript
// Creating a memory-aware cache
const cache = new LRUCache<string, string>(100, 5 * 60 * 1000, 50 * 1024 * 1024);
// 100 items max, 5 minute TTL, 50MB memory limit
```

### Optimized File Processing

The `FileProcessingService` implements several memory optimization techniques:

1. **Chunk-Based Processing**: Files are read in configurable chunks (default 64KB).
2. **Early Termination**: Processing stops as soon as a match is found if requested.
3. **Buffer Management**: Buffers are cleared after processing to free memory.
4. **Result Size Limiting**: Maximum number of results is capped to prevent memory exhaustion.
5. **Memory Usage Tracking**: Memory usage is monitored during file processing operations.

```typescript
// Example of optimized file processing
const result = await fileProcessingService.processFileInChunks(
  filePath,
  (chunk) => chunk.includes("searchTerm"),
  {
    chunkSize: 64 * 1024, // 64KB chunks
    earlyTermination: true, // Stop after first match
    maxFileSize: 50 * 1024 * 1024 // 50MB max file size
  }
);
```

## Memory Optimization Strategies

### 1. Cache Management

- **Tiered Caching**: Different cache sizes for different types of data
- **TTL-Based Expiration**: Time-based expiration to automatically clear stale data
- **Memory-Based Eviction**: Items are evicted based on both count and memory usage
- **Pressure-Based Trimming**: Caches are automatically trimmed when memory pressure is high

### 2. String Handling

- **Minimized Concatenation**: String concatenation operations are minimized
- **Buffer Size Limiting**: Maximum buffer sizes are enforced to prevent memory issues
- **Efficient Line Processing**: Lines are processed as they are read, without storing the entire file

### 3. Result Management

- **Size Limiting**: Maximum result sizes are enforced to prevent memory exhaustion
- **Streaming Results**: Results are streamed rather than collected all at once when possible
- **Early Termination**: Processing stops as soon as the required results are found

## Memory Leak Detection

The application includes memory leak detection tests that:

1. Run repeated operations with the same input
2. Measure memory usage before and after each operation
3. Calculate the average memory change per operation
4. Flag potential memory leaks if the average change exceeds a threshold

```typescript
// Example memory leak detection
const memBefore = getMemoryUsage();
await fileProcessingService.processFileInChunks(filePath, matcher);
const memAfter = getMemoryUsage();
const memoryChange = (memAfter.heapUsed - memBefore.heapUsed) / 1024 / 1024;
```

## Best Practices

When working with file processing in the application, follow these best practices:

1. **Use Streaming**: Always use streaming for large files rather than loading the entire content.
2. **Enable Early Termination**: When only checking for existence, enable early termination.
3. **Limit Result Sizes**: Set appropriate limits for result sizes based on the use case.
4. **Monitor Memory Usage**: Use the MemoryMonitor to track memory usage in long-running operations.
5. **Clear References**: Explicitly clear references to large objects when they are no longer needed.
6. **Use Appropriate Chunk Sizes**: Adjust chunk sizes based on the specific use case (smaller for interactive operations, larger for batch processing).

## Performance Monitoring

Memory usage statistics are collected during file processing operations and can be viewed in the application logs. Significant memory changes are logged with details about the operation that caused them.

The application also includes performance tests that measure:

1. Memory usage during file processing operations
2. Cache hit rates and eviction counts
3. Processing time for different file sizes and operations

These metrics help identify potential memory issues and optimize the application's memory usage over time.
