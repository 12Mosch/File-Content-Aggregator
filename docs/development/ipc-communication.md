# IPC Communication

This document describes the Inter-Process Communication (IPC) architecture used in the File Content Aggregator.

## Overview

The application uses Electron's IPC (Inter-Process Communication) system to communicate between the renderer process (UI) and the main process (Node.js backend). This separation allows the UI to remain responsive while intensive operations like file searching and processing happen in the main process.

## IPC Channels

### Main Process to Renderer Process

- `search-progress`: Sends progress updates during search operations
- `file-operation-progress`: Sends progress updates during file operations
- `update-available`: Notifies when an application update is available
- `log-message`: Sends log messages to be displayed in the UI

### Renderer Process to Main Process

- `search-files`: Initiates a file search operation
- `cancel-search`: Cancels an ongoing search operation
- `open-file`: Opens a file in the default application
- `show-in-folder`: Shows a file in the file explorer
- `export-results`: Exports search results to a file
- `get-app-info`: Retrieves application information
- `clear-cache`: Clears the application cache
- `get-cache-stats`: Retrieves cache statistics

## Timeout Handling

To prevent IPC calls from hanging indefinitely, the application implements timeout handling for long-running operations:

1. **Client-side timeout**: The renderer process sets a timeout for IPC calls using `Promise.race()` with a timeout promise.

```typescript
// Example from App.tsx
const timeoutPromise = new Promise<SearchResult>((_, reject) => {
  const timeoutId = setTimeout(
    () => {
      reject(new Error("Search request timed out after 5 minutes"));
    },
    5 * 60 * 1000
  ); // 5 minute timeout

  return () => clearTimeout(timeoutId);
});

// Race the search against the timeout
const searchResult: SearchResult = await Promise.race([
  window.electronAPI.invokeSearch(backendParams),
  timeoutPromise,
]);
```

2. **Server-side timeout**: The main process also implements a timeout for long-running operations.

```typescript
// Example from main.ts
const timeoutPromise = new Promise<SearchResult>((_, reject) => {
  const timeoutId = setTimeout(
    () => {
      isSearchCancelled = true; // Set cancellation flag
      reject(new Error("Search operation timed out after 5 minutes"));
    },
    5 * 60 * 1000
  ); // 5 minute timeout

  // Clear the timeout if the component is unmounted
  return () => clearTimeout(timeoutId);
});

// Race the search against the timeout
const results = await Promise.race([
  searchFiles(params, progressCallback, checkCancellation),
  timeoutPromise,
]);
```

## Memory Management

For operations that process large amounts of data, the application implements memory monitoring to prevent out-of-memory errors:

```typescript
// Example from OptimizedFileSearchService.ts
const memoryUsage = process.memoryUsage();
const heapUsedMB = Math.round(memoryUsage.heapUsed / (1024 * 1024));

// Log memory usage for monitoring
this.logger.debug("Memory usage during file processing", {
  heapUsedMB,
  rssMB: Math.round(memoryUsage.rss / (1024 * 1024)),
  filesProcessed: filesProcessedCounter,
  totalFiles: totalFilesToProcess,
});

// If memory usage is getting high, force GC if available and slow down processing
if (heapUsedMB > 1200) {
  // 1.2GB
  this.logger.warn("High memory usage during file processing", { heapUsedMB });

  // Force garbage collection if available
  if (global.gc) {
    this.logger.info("Forcing garbage collection during processing");
    global.gc();

    // Small delay to allow GC to complete and memory to be freed
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
```

## Best Practices

When implementing new IPC communication:

1. Always handle errors on both sides of the communication
2. Implement timeouts for long-running operations
3. Use progress updates for operations that take more than a few seconds
4. Keep the UI responsive by moving intensive operations to the main process
5. Implement cancellation for long-running operations
6. Monitor memory usage for operations that process large amounts of data
7. Use structured data for IPC communication (avoid sending raw DOM elements or circular references)
8. Validate input parameters before processing
