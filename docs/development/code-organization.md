# Code Organization

This document describes the code organization of the File Content Aggregator application.

## Directory Structure

The application is organized into the following directories:

```
src/
├── components/     # Reusable UI components
├── electron/       # Electron main process code
│   ├── services/   # Main process services
│   └── utils/      # Main process utilities
├── lib/            # Shared libraries
│   ├── services/   # Shared services
│   └── utils/      # Shared utilities
├── ui/             # React UI code
│   ├── components/ # UI components
│   ├── services/   # UI services
│   └── workers/    # Web workers
└── styles/         # CSS styles
```

## Core Modules

### Error Handling

The application uses a standardized error handling approach with the `AppError` class. This class provides:

- Consistent error types with error codes
- Detailed error information
- Factory methods for common error types
- Proper error propagation

Example usage:

```typescript
try {
  // Some operation that might fail
} catch (error) {
  throw AppError.fileNotFound(filePath);
}
```

### Utilities

The application has a set of utility modules that provide common functionality:

- `common.ts`: General utility functions
- `string.ts`: String manipulation utilities
- `file.ts`: File system utilities
- `search.ts`: Search-related utilities

These utilities are designed to be reusable across the application and provide consistent behavior.

### Services

The application uses a service-oriented architecture with the following key services:

- `Logger`: Provides standardized logging functionality
- `ConfigService`: Manages application configuration
- `CacheManager`: Manages application caches
- `OptimizedFileSearchService`: Provides file search functionality
- `FileDiscoveryService`: Discovers files based on search criteria
- `ContentMatchingService`: Matches content against search terms
- `SearchResultProcessor`: Processes search results

## Design Patterns

### Singleton Pattern

Services are implemented as singletons to ensure a single instance is used throughout the application:

```typescript
export class SomeService {
  private static instance: SomeService;
  
  public static getInstance(): SomeService {
    if (!SomeService.instance) {
      SomeService.instance = new SomeService();
    }
    return SomeService.instance;
  }
  
  private constructor() {
    // Initialize the service
  }
}
```

### Facade Pattern

The `FileSearchService` acts as a facade for the more complex `OptimizedFileSearchService`, providing a simpler interface and maintaining backward compatibility.

### Factory Pattern

The `AppError` class uses factory methods to create specific error types:

```typescript
static fileNotFound(path: string): AppError {
  return new AppError(`File not found: ${path}`, "FILE_NOT_FOUND", { path });
}
```

## Coding Standards

### Naming Conventions

- **Classes**: PascalCase (e.g., `AppError`, `Logger`)
- **Interfaces**: PascalCase (e.g., `SearchOptions`, `LoggerConfig`)
- **Methods and Functions**: camelCase (e.g., `searchFiles`, `updateSettings`)
- **Variables**: camelCase (e.g., `fileContent`, `searchResult`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `FILE_OPERATION_CONCURRENCY_LIMIT`)
- **Private Properties**: camelCase with underscore prefix (e.g., `_cache`, `_config`)

### Documentation

All public APIs should be documented with JSDoc comments:

```typescript
/**
 * Updates the search settings
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 * @param wholeWordEnabled Whether whole word matching is enabled
 */
export function updateSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  // Implementation
}
```

### Error Handling

All functions that can fail should use proper error handling:

- Use try/catch blocks to handle errors
- Use the `AppError` class for consistent error reporting
- Propagate errors with appropriate context
- Log errors with the `Logger` service

### Asynchronous Code

Asynchronous code should use async/await for better readability:

```typescript
async function processFile(filePath: string): Promise<Result> {
  try {
    const content = await readFile(filePath);
    return processContent(content);
  } catch (error) {
    throw AppError.fileAccessError(filePath, error);
  }
}
```

## Best Practices

### Separation of Concerns

Each module should have a single responsibility:

- **Services**: Provide business logic
- **Utilities**: Provide reusable functions
- **Components**: Provide UI elements
- **Workers**: Handle CPU-intensive tasks

### Dependency Injection

Services should be designed to accept dependencies through their constructor or methods:

```typescript
class SearchService {
  constructor(
    private fileDiscoveryService: FileDiscoveryService,
    private contentMatchingService: ContentMatchingService
  ) {}
  
  // Methods that use the injected services
}
```

### Immutability

Prefer immutable data structures to avoid unexpected side effects:

```typescript
// Good
const newArray = [...oldArray, newItem];

// Avoid
oldArray.push(newItem);
```

### Pure Functions

Prefer pure functions that don't have side effects:

```typescript
// Good
function add(a: number, b: number): number {
  return a + b;
}

// Avoid
let sum = 0;
function addToSum(value: number): void {
  sum += value;
}
```

## Testing

### Unit Testing

Unit tests should focus on testing a single unit of code in isolation:

```typescript
describe('AppError', () => {
  it('should create a file not found error', () => {
    const error = AppError.fileNotFound('/path/to/file');
    expect(error.code).toBe('FILE_NOT_FOUND');
    expect(error.message).toBe('File not found: /path/to/file');
  });
});
```

### Integration Testing

Integration tests should focus on testing the interaction between multiple units:

```typescript
describe('FileSearchService', () => {
  it('should search files and return results', async () => {
    const service = OptimizedFileSearchService.getInstance();
    const results = await service.searchFiles(params, progressCallback, checkCancellation);
    expect(results.filesFound).toBeGreaterThan(0);
  });
});
```

### Mocking

Use mocks to isolate the code being tested:

```typescript
jest.mock('./services/FileDiscoveryService');
const mockDiscoveryService = FileDiscoveryService as jest.MockedClass<typeof FileDiscoveryService>;
mockDiscoveryService.getInstance.mockReturnValue({
  discoverFiles: jest.fn().mockResolvedValue({
    files: [{ filePath: '/path/to/file', stats: null }],
    errors: [],
    wasCancelled: false
  })
});
```
