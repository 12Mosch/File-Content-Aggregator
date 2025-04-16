# Testing Guide

This document provides comprehensive information about the testing approach, structure, and practices for the File Content Aggregator application.

## Testing Philosophy

The File Content Aggregator follows these testing principles:

1. **Test-driven development** - Write tests before implementing features when possible
2. **Comprehensive coverage** - Aim for high test coverage of critical functionality
3. **Fast feedback** - Tests should run quickly to provide immediate feedback
4. **Isolation** - Unit tests should be isolated and not depend on external services
5. **Realistic scenarios** - Integration tests should reflect real-world usage patterns

## Test Structure

Tests are organized in a dedicated `tests/` directory that mirrors the source code structure:

```
tests/
├── unit/           # Unit tests for individual components and functions
│   └── ui/         # Tests for UI-related functionality
│       └── ...
├── integration/    # Integration tests that test multiple components together
│   └── search/     # Tests for search-related functionality
│       └── ...
└── README.md       # Brief overview of the test structure
```

## Test Types

### Unit Tests

Unit tests focus on testing individual functions and components in isolation. They verify that each unit of code works as expected.

**Location:** `tests/unit/`

**Naming Convention:** `[filename].test.ts`

**Example:**

```typescript
// tests/unit/ui/highlightHtmlUtils.test.ts
import { highlightTermsInHtml } from "../../../src/ui/highlightHtmlUtils";

describe("highlightTermsInHtml", () => {
  test("should return original HTML if no terms provided", () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    expect(highlightTermsInHtml(html, [], true)).toBe(html);
  });
});
```

### Boundary Tests

Boundary tests are a subset of unit tests that focus on edge cases and boundary conditions.

**Location:** `tests/unit/`

**Naming Convention:** `[filename].boundary.test.ts`

**Example:**

```typescript
// tests/unit/ui/highlightHtmlUtils.boundary.test.ts
import { highlightTermsInHtml } from "../../../src/ui/highlightHtmlUtils";

describe("highlightTermsInHtml - Boundary Cases", () => {
  test("should handle empty search term", () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    const result = highlightTermsInHtml(html, [""], true);
    expect(result).toBe(html);
  });
});
```

### Performance Tests

Performance tests verify that functions perform efficiently with large inputs or many operations.

**Location:** `tests/unit/`

**Naming Convention:** `[filename].performance.test.ts`

**Example:**

```typescript
// tests/unit/ui/highlightHtmlUtils.performance.test.ts
import { highlightTermsInHtml } from "../../../src/ui/highlightHtmlUtils";

describe("highlightTermsInHtml - Performance", () => {
  test("should handle large HTML documents", () => {
    const repeatedElement = '<span class="hljs-keyword">const</span> x = 10;\n';
    const largeHtml = repeatedElement.repeat(1000);
    const result = highlightTermsInHtml(largeHtml, ["const"], true);
    expect(typeof result).toBe("string");
  });
});
```

### Integration Tests

Integration tests verify that multiple components work together correctly.

**Location:** `tests/integration/`

**Naming Convention:** `[feature].test.ts`

**Example:**

```typescript
// tests/integration/search/highlighting.test.ts
import { highlightTermsInHtml } from "../../../src/ui/highlightHtmlUtils";

describe("Search Highlighting Integration", () => {
  test("should handle complex HTML with multiple term types", () => {
    const html = `<div class="code-block">...</div>`;
    const terms = ["function", /Database/, "query", "return"];
    const result = highlightTermsInHtml(html, terms, true);
    expect(typeof result).toBe("string");
  });
});
```

## Running Tests

You can run tests using the following npm scripts:

| Command                    | Description                           |
| -------------------------- | ------------------------------------- |
| `npm test`                 | Run all tests                         |
| `npm run test:unit`        | Run only unit tests                   |
| `npm run test:integration` | Run only integration tests            |
| `npm run test:coverage`    | Run all tests with coverage reporting |

## Test Coverage

We aim for high test coverage of critical functionality. You can generate a coverage report using:

```bash
npm run test:coverage
```

This will generate a coverage report in the `coverage/` directory.

## Mocking

For tests that require DOM manipulation or external dependencies, we use Jest's mocking capabilities.

### DOM Mocking

For DOM manipulation, we mock the necessary DOM APIs:

```typescript
beforeEach(() => {
  // Mock document.createElement
  document.createElement = jest.fn().mockImplementation((tag) => {
    return {
      nodeType: 1,
      nodeName: tag.toUpperCase(),
      // ... other properties and methods
    };
  });

  // Mock document.createTextNode
  document.createTextNode = jest.fn().mockImplementation((text) => {
    return {
      nodeType: 3,
      nodeName: "#text",
      textContent: text,
      parentNode: null,
    };
  });
});
```

## Writing New Tests

When writing new tests, follow these guidelines:

1. **Place tests in the appropriate directory**

   - Unit tests go in `tests/unit/[module]/`
   - Integration tests go in `tests/integration/[feature]/`

2. **Use descriptive test names**

   - Test names should describe what is being tested
   - Use the format "should [expected behavior] when [condition]"

3. **Test edge cases**

   - Empty inputs
   - Null or undefined values
   - Very large inputs
   - Special characters
   - Invalid inputs

4. **Keep tests focused**

   - Each test should verify one specific behavior
   - Use multiple small tests rather than one large test

5. **Use appropriate assertions**

   - Be specific about what you're testing
   - Use the most appropriate matcher for the situation

6. **Clean up after tests**
   - Reset mocks between tests
   - Clean up any resources created during tests

## Continuous Integration

Tests are run automatically as part of our CI/CD pipeline. Pull requests must pass all tests before they can be merged.

## Troubleshooting Tests

If you encounter issues with tests:

1. **Check the test environment**

   - Make sure all dependencies are installed
   - Verify that the test environment is properly configured

2. **Isolate the problem**

   - Run specific test files or test cases
   - Use `test.only()` to run only a specific test

3. **Check for timing issues**

   - Some tests may fail due to timing issues
   - Use Jest's async testing capabilities for asynchronous code

4. **Verify mocks**
   - Make sure mocks are properly set up
   - Reset mocks between tests

## Feature-Specific Testing Documentation

Detailed documentation for specific feature tests:

- [Fuzzy Search Tests](./fuzzy-search-tests.md): Tests for fuzzy search configuration and behavior
- [Highlighting Tests](./highlighting-tests.md): Tests for term highlighting in search results
- [Search Pipeline Tests](./search-pipeline-tests.md): Tests for the end-to-end search process

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [TypeScript Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
