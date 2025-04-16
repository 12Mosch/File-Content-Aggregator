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
      insertBefore: jest.fn(function (newChild, refChild) {
        const index = this.childNodes.indexOf(refChild);
        if (index !== -1) {
          this.childNodes.splice(index, 0, newChild);
        } else {
          this.childNodes.push(newChild);
        }
        if (typeof newChild === "object" && newChild !== null) {
          newChild.parentNode = this;
        }
        return newChild;
      }),
      removeChild: jest.fn(function (child) {
        const index = this.childNodes.indexOf(child);
        if (index !== -1) {
          this.childNodes.splice(index, 1);
        }
        if (typeof child === "object" && child !== null) {
          child.parentNode = null;
        }
        return child;
      }),
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

  // Add a spy on console.log to suppress output during tests
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("highlightTermsInHtml - Boundary Cases", () => {
  test("should handle empty search term", () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    const result = highlightTermsInHtml(html, [""], true);
    
    // Empty search terms should be filtered out, so the result should be the same as the input
    expect(result).toBe(html);
  });

  test("should handle very long search terms", () => {
    const longTerm = "a".repeat(1000);
    const html = `<span class="hljs-string">"${longTerm}"</span>`;
    
    // This should not crash
    const result = highlightTermsInHtml(html, [longTerm], true);
    expect(typeof result).toBe("string");
  });

  test("should handle special characters in search terms", () => {
    const html = '<span class="hljs-string">"line1\\nline2\\tindented"</span>';
    
    // Test with escape sequences
    const result1 = highlightTermsInHtml(html, ["\\n"], true);
    expect(typeof result1).toBe("string");
    
    // Test with tab character
    const result2 = highlightTermsInHtml(html, ["\\t"], true);
    expect(typeof result2).toBe("string");
    
    // Test with backslash
    const result3 = highlightTermsInHtml(html, ["\\\\"], true);
    expect(typeof result3).toBe("string");
  });

  test("should handle quoted term extraction", () => {
    const html = '<span class="hljs-string">"database query"</span>';
    
    // Test with Term: prefix
    const result1 = highlightTermsInHtml(html, ["Term: database"], true);
    expect(typeof result1).toBe("string");
    
    // Test with quoted term
    const result2 = highlightTermsInHtml(html, ['"database"'], true);
    expect(typeof result2).toBe("string");
  });

  test("should handle different case combinations", () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    
    // Mixed case with case-insensitive search
    const result = highlightTermsInHtml(html, ["cOnSt"], false);
    expect(typeof result).toBe("string");
  });

  test("should handle null or undefined terms gracefully", () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    
    // @ts-ignore - Testing with null even though TypeScript doesn't allow it
    const result1 = highlightTermsInHtml(html, [null], true);
    expect(typeof result1).toBe("string");
    
    // @ts-ignore - Testing with undefined even though TypeScript doesn't allow it
    const result2 = highlightTermsInHtml(html, [undefined], true);
    expect(typeof result2).toBe("string");
  });
});
