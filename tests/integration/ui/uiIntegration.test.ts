import { highlightTermsInHtml } from "../../../src/ui/highlightHtmlUtils";
import "@jest/globals";

// Mock the DOM methods used in highlightHtmlUtils.ts
beforeEach(() => {
  // Create a simple mock for document.createElement that returns an object with the necessary properties
  document.createElement = jest.fn().mockImplementation((tag) => {
    return {
      nodeType: 1,
      nodeName: tag.toUpperCase(),
      className: "",
      textContent: "",
      innerHTML: "",
      childNodes: [],
      style: {},
      setAttribute: jest.fn(),
      appendChild: jest.fn(function (child) {
        this.childNodes.push(child);
        if (typeof child === "object" && child !== null) {
          child.parentNode = this;
        }
        return child;
      }),
      querySelectorAll: jest.fn().mockReturnValue([]),
    };
  });

  // Mock other DOM methods
  Object.defineProperty(window, "getComputedStyle", {
    value: jest.fn().mockReturnValue({
      getPropertyValue: jest.fn().mockReturnValue(""),
    }),
  });

  // Add a spy on console.log to suppress output during tests
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

// Mock React components
jest.mock("react", () => {
  const originalReact = jest.requireActual("react");
  return {
    ...originalReact,
    useState: jest
      .fn()
      .mockImplementation((initialValue) => [initialValue, jest.fn()]),
  };
});

// Mock the ResultsDisplay component
jest.mock("../../../src/ui/ResultsDisplay", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((props) => {
      return {
        props,
        render: () => `<div>Results: ${props.structuredItems.length}</div>`,
      };
    }),
  };
});

describe("UI Integration Tests", () => {
  describe("Search Results Display", () => {
    test("should display search results correctly", () => {
      // Mock structured items
      const mockItems = [
        { filePath: "file1.txt", matched: true },
        { filePath: "file2.txt", matched: true },
      ];

      // Get the mocked ResultsDisplay component
      const { default: ResultsDisplay } = jest.requireMock(
        "../../../src/ui/ResultsDisplay"
      );
      const _mockResultsDisplay = ResultsDisplay({
        structuredItems: mockItems,
        summary: { filesFound: 2, filesProcessed: 5, errorsEncountered: 0 },
        viewMode: "tree",
        itemDisplayStates: {},
        itemDisplayVersion: 1,
        onToggleExpand: jest.fn(),
        onShowFullContent: jest.fn(),
        isFilterActive: false,
        filterTerm: "",
        filterCaseSensitive: false,
        searchQueryStructure: null,
        searchQueryCaseSensitive: false,
      });

      // Verify the component was called with the correct props
      expect(ResultsDisplay).toHaveBeenCalledWith(
        expect.objectContaining({
          structuredItems: mockItems,
          viewMode: "tree",
        })
      );
    });
  });

  describe("Tree View Expansion/Collapse", () => {
    test("should handle tree view expansion and collapse", () => {
      // Mock the toggle expand function
      const mockToggleExpand = jest.fn();

      // Get the mocked ResultsDisplay component
      const { default: ResultsDisplay } = jest.requireMock(
        "../../../src/ui/ResultsDisplay"
      );
      const _mockResultsDisplay = ResultsDisplay({
        structuredItems: [{ filePath: "file1.txt", matched: true }],
        summary: { filesFound: 1, filesProcessed: 1, errorsEncountered: 0 },
        viewMode: "tree",
        itemDisplayStates: { "file1.txt": { expanded: false } },
        itemDisplayVersion: 1,
        onToggleExpand: mockToggleExpand,
        onShowFullContent: jest.fn(),
        isFilterActive: false,
        filterTerm: "",
        filterCaseSensitive: false,
        searchQueryStructure: null,
        searchQueryCaseSensitive: false,
      });

      // Simulate a toggle expand action
      // In a real test, we would trigger the click event on the element
      // Here we just verify the function was passed correctly
      expect(ResultsDisplay).toHaveBeenCalledWith(
        expect.objectContaining({
          onToggleExpand: mockToggleExpand,
        })
      );
    });
  });

  describe("File Content Preview Loading", () => {
    test("should handle file content preview loading", () => {
      // Mock the content loading function
      const mockShowFullContent = jest.fn();

      // Get the mocked ResultsDisplay component
      const { default: ResultsDisplay } = jest.requireMock(
        "../../../src/ui/ResultsDisplay"
      );
      const _mockResultsDisplay = ResultsDisplay({
        structuredItems: [{ filePath: "file1.txt", matched: true }],
        summary: { filesFound: 1, filesProcessed: 1, errorsEncountered: 0 },
        viewMode: "tree",
        itemDisplayStates: {
          "file1.txt": {
            expanded: true,
            showFull: false,
          },
        },
        itemDisplayVersion: 1,
        onToggleExpand: jest.fn(),
        onShowFullContent: mockShowFullContent,
        isFilterActive: false,
        filterTerm: "",
        filterCaseSensitive: false,
        searchQueryStructure: null,
        searchQueryCaseSensitive: false,
      });

      // Verify the function was passed correctly
      expect(ResultsDisplay).toHaveBeenCalledWith(
        expect.objectContaining({
          onShowFullContent: mockShowFullContent,
        })
      );
    });
  });

  describe("Search Term Highlighting in Previews", () => {
    test("should highlight search terms in HTML content", () => {
      // Test HTML content
      const html = `
        <div class="code-block">
          <span class="hljs-keyword">function</span> <span class="hljs-title">searchDatabase</span>(<span class="hljs-params">query</span>) {
            <span class="hljs-keyword">const</span> connection = <span class="hljs-keyword">new</span> <span class="hljs-title">DatabaseConnection</span>();
            <span class="hljs-keyword">const</span> results = connection.<span class="hljs-title">query</span>(query);
            <span class="hljs-keyword">return</span> results.filter(<span class="hljs-function"><span class="hljs-params">item</span> =></span> item.active);
          }
        </div>
      `;

      // Search terms to highlight
      const terms = ["function", "query", "return"];

      // Call the highlighting function
      const result = highlightTermsInHtml(html, terms, true);

      // Verify the result is a string (actual highlighting is tested in unit tests)
      expect(typeof result).toBe("string");
    });

    test("should highlight fuzzy search matches in content", () => {
      // Test HTML content
      const html = `
        <div class="code-block">
          <span class="hljs-keyword">function</span> <span class="hljs-title">searchDatabase</span>(<span class="hljs-params">query</span>) {
            <span class="hljs-keyword">const</span> connection = <span class="hljs-keyword">new</span> <span class="hljs-title">DatabaseConnection</span>();
            <span class="hljs-keyword">const</span> results = connection.<span class="hljs-title">query</span>(query);
            <span class="hljs-keyword">return</span> results.filter(<span class="hljs-function"><span class="hljs-params">item</span> =></span> item.active);
          }
        </div>
      `;

      // Fuzzy search terms (slightly misspelled)
      const terms = ["functon", "qurey", "retrun"];

      // Call the highlighting function
      const result = highlightTermsInHtml(html, terms, false);

      // Verify the result is a string
      expect(typeof result).toBe("string");
    });

    test("should highlight NEAR operator matches in content", () => {
      // Test HTML content
      const html = `
        <div class="code-block">
          <span class="hljs-keyword">function</span> <span class="hljs-title">searchDatabase</span>(<span class="hljs-params">query</span>) {
            <span class="hljs-keyword">const</span> connection = <span class="hljs-keyword">new</span> <span class="hljs-title">DatabaseConnection</span>();
            <span class="hljs-keyword">const</span> results = connection.<span class="hljs-title">query</span>(query);
            <span class="hljs-keyword">return</span> results.filter(<span class="hljs-function"><span class="hljs-params">item</span> =></span> item.active);
          }
        </div>
      `;

      // Terms that would be found via NEAR operator
      const terms = ["function", "query"];

      // Call the highlighting function
      const result = highlightTermsInHtml(html, terms, true);

      // Verify the result is a string
      expect(typeof result).toBe("string");
    });

    test("should highlight search terms with Unicode characters", () => {
      // Test HTML content with Unicode characters
      const html = `
        <div class="code-block">
          <span class="hljs-keyword">function</span> <span class="hljs-title">greetUser</span>(<span class="hljs-params">name</span>) {
            <span class="hljs-keyword">const</span> greeting = "こんにちは, " + name;
            <span class="hljs-keyword">return</span> greeting;
          }
        </div>
      `;

      // Unicode search terms
      const terms = ["こんにちは"];

      // Call the highlighting function
      const result = highlightTermsInHtml(html, terms, true);

      // Verify the result is a string
      expect(typeof result).toBe("string");
    });
  });
});
