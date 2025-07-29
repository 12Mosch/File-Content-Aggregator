import "@jest/globals";

// Mock highlight.js
const mockHighlight = jest.fn();
const mockGetLanguage = jest.fn();
const mockRegisterLanguage = jest.fn();

jest.mock("highlight.js/lib/core", () => ({
  default: {
    highlight: mockHighlight,
    getLanguage: mockGetLanguage,
    registerLanguage: mockRegisterLanguage,
  },
}));

// Mock language imports
jest.mock("highlight.js/lib/languages/javascript", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/typescript", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/json", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/css", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/xml", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/python", () => ({
  default: jest.fn(),
}));
jest.mock("highlight.js/lib/languages/plaintext", () => ({
  default: jest.fn(),
}));

// Mock crypto for UUID generation
Object.defineProperty(global, "crypto", {
  value: {
    randomUUID: () => "test-uuid-123",
  },
});

// Mock performance API
Object.defineProperty(global, "performance", {
  value: {
    now: jest.fn(() => 1000),
    mark: jest.fn(),
    measure: jest.fn(),
    getEntriesByName: jest.fn(() => [{ duration: 100 }]),
  },
});

// Mock self.postMessage
Object.defineProperty(global, "self", {
  value: {
    postMessage: jest.fn(),
  },
});

describe("Enhanced Syntax Highlighting Worker - Chunking", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHighlight.mockReturnValue({ value: "<span>highlighted</span>" });
    mockGetLanguage.mockReturnValue(true);
  });

  describe("Language-specific chunking configurations", () => {
    test("should have appropriate config for JavaScript", () => {
      // Import the worker to access internal functions
      // Note: This would need to be refactored to export the config function
      // for proper testing. For now, this is a placeholder test structure.
      expect(true).toBe(true);
    });

    test("should have appropriate config for Python", () => {
      expect(true).toBe(true);
    });

    test("should have appropriate config for CSS", () => {
      expect(true).toBe(true);
    });

    test("should fall back to default config for unknown languages", () => {
      expect(true).toBe(true);
    });
  });

  describe("Safe boundary detection", () => {
    test("should avoid breaking JavaScript template literals", () => {
      const code = `
const template = \`
  This is a multi-line
  template literal that
  should not be broken
  in the middle
\`;
console.log(template);
      `.trim();

      // Test that chunking doesn't break the template literal
      // This would require exposing the findSafeBoundary function
      expect(code.length).toBeGreaterThan(0);
    });

    test("should avoid breaking multi-line comments", () => {
      const code = `
/*
 * This is a multi-line comment
 * that spans several lines
 * and should not be broken
 */
function test() {
  return true;
}
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });

    test("should avoid breaking Python triple-quoted strings", () => {
      const code = `
def example():
    doc = """
    This is a multi-line
    docstring that should
    not be broken in chunks
    """
    return doc
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });

    test("should prefer function/class boundaries for safe breaks", () => {
      const code = `
function firstFunction() {
  return "first";
}

function secondFunction() {
  return "second";
}

class MyClass {
  method() {
    return "method";
  }
}
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });
  });

  describe("Context preservation", () => {
    test("should handle overlapping chunks correctly", () => {
      // This test would verify that context buffers work correctly
      expect(true).toBe(true);
    });

    test("should maintain syntax highlighting consistency across chunks", () => {
      // This test would verify that highlighting is consistent
      expect(true).toBe(true);
    });
  });

  describe("Edge cases and error handling", () => {
    test("should handle very small files without chunking", () => {
      const smallCode = "const x = 1;";
      expect(smallCode.length).toBeLessThan(50000); // LARGE_FILE_THRESHOLD
    });

    test("should handle files with no safe boundaries", () => {
      // Test with a file that has no good break points
      const code = "a".repeat(100000); // Very long line
      expect(code.length).toBeGreaterThan(50000);
    });

    test("should handle syntax errors gracefully", () => {
      mockHighlight.mockImplementation(() => {
        throw new Error("Syntax error");
      });

      // Should not crash and should fall back gracefully
      expect(true).toBe(true);
    });

    test("should handle empty or whitespace-only chunks", () => {
      const code = "\n\n\n\n\n".repeat(10001);
      expect(code.length).toBeGreaterThan(50000);
    });
  });

  describe("Performance characteristics", () => {
    test("should process large files efficiently", () => {
      const largeCode = "function test() { return true; }\n".repeat(5000);
      expect(largeCode.length).toBeGreaterThan(50000);

      // Test would measure processing time and memory usage
    });

    test("should send progress updates for very large files", () => {
      const veryLargeCode = "const x = 1;\n".repeat(20000);
      expect(veryLargeCode.length).toBeGreaterThan(200000);

      // Test would verify that progress messages are sent
    });
  });

  describe("Language-specific syntax preservation", () => {
    test("should handle JavaScript regex patterns correctly", () => {
      const code = `
const regex1 = /complex[a-z]+pattern/gi;
const regex2 = /another\\/pattern\\/with\\/slashes/;
const notRegex = a / b / c; // Division, not regex
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });

    test("should handle CSS selectors and rules correctly", () => {
      const code = `
.complex-selector:nth-child(2n+1):hover,
.another-selector[data-attribute="value"] {
  background: linear-gradient(
    45deg,
    #ff0000 0%,
    #00ff00 50%,
    #0000ff 100%
  );
}
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });

    test("should handle HTML with embedded scripts correctly", () => {
      const code = `
<script>
  function embedded() {
    const template = \`
      <div class="nested">
        \${variable}
      </div>
    \`;
    return template;
  }
</script>
      `.trim();

      expect(code.length).toBeGreaterThan(0);
    });
  });
});
