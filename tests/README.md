# Tests

This directory contains all the tests for the File Content Aggregator application.

> **Note:** For comprehensive documentation on testing, please see [Testing Guide](../docs/development/testing.md).

## Quick Reference

### Structure

```
tests/
├── unit/           # Unit tests for individual components and functions
│   └── ui/         # Tests for UI-related functionality
├── integration/    # Integration tests that test multiple components together
│   └── search/     # Tests for search-related functionality
└── README.md       # This file
```

### Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests with coverage reporting
npm run test:coverage
```

### Test Types

- **Unit Tests** (`*.test.ts`) - Test individual functions and components
- **Boundary Tests** (`*.boundary.test.ts`) - Test edge cases and boundary conditions
- **Performance Tests** (`*.performance.test.ts`) - Test performance with large inputs
- **Integration Tests** (in `integration/`) - Test how components work together

### Writing Tests

See the [Testing Guide](../docs/development/testing.md) for detailed guidelines on writing tests.
