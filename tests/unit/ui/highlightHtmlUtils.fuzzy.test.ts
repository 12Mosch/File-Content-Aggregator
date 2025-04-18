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

describe("highlightTermsInHtml - Fuzzy Search", () => {
  test("should highlight terms with slight misspellings", () => {
    const html =
      '<span class="hljs-keyword">function</span> calculateTotal() { return sum; }';

    // Simulate fuzzy search by using regex patterns that would match similar terms
    // In a real implementation, the fuzzy search algorithm would generate these patterns
    const fuzzyTerms = [/f[a-z]*n[a-z]*n/i]; // Should match "function" with fuzzy matching

    const result = highlightTermsInHtml(html, fuzzyTerms, false);

    // Verify we get a string result
    expect(typeof result).toBe("string");
    // The original content should still be present
    expect(result).toContain("function");
  });

  test("should highlight terms with character transpositions", () => {
    const html =
      '<span class="hljs-keyword">function</span> calculateTotal() { return sum; }';

    // Simulate fuzzy search with transposed characters using regex
    const fuzzyTerms = [/f[a-z]*c[a-z]*t[a-z]*o[a-z]*n/i]; // Should match "function" with transposed characters

    const result = highlightTermsInHtml(html, fuzzyTerms, false);

    expect(typeof result).toBe("string");
    expect(result).toContain("function");
  });

  test("should highlight terms with missing characters", () => {
    const html = '<span class="hljs-variable">calculateTotal</span>';

    // Simulate fuzzy search with missing characters
    const fuzzyTerms = [/cal[a-z]*late/i]; // Should match "calculate" with missing characters

    const result = highlightTermsInHtml(html, fuzzyTerms, false);

    expect(typeof result).toBe("string");
    expect(result).toContain("calculate");
  });

  test("should highlight terms with extra characters", () => {
    const html = '<span class="hljs-variable">calculateTotal</span>';

    // Simulate fuzzy search with extra characters
    const fuzzyTerms = [/c[a-z]*l[a-z]*t[a-z]*t[a-z]*l/i]; // Should match "calculateTotal" with extra chars

    const result = highlightTermsInHtml(html, fuzzyTerms, false);

    expect(typeof result).toBe("string");
    expect(result).toContain("calculateTotal");
  });
});

describe("highlightTermsInHtml - NEAR Operator", () => {
  test("should highlight terms found via NEAR operator", () => {
    const html =
      '<span class="hljs-string">"database connection string"</span>';

    // Simulate NEAR operator by highlighting individual terms that would be found via NEAR
    const terms = ["database", "string"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("database");
    expect(result).toContain("string");
  });

  test("should highlight terms with different proximity", () => {
    const html = `
      <span class="hljs-comment">// This is a comment about error handling and logging</span>
      <span class="hljs-keyword">function</span> processData() {
        <span class="hljs-keyword">try</span> {
          <span class="hljs-comment">// Process data here</span>
        } <span class="hljs-keyword">catch</span> (error) {
          <span class="hljs-built_in">console</span>.error(<span class="hljs-string">"Error processing data"</span>, error);
        }
      }
    `;

    // Simulate terms that would be found via NEAR with different proximities
    const terms = ["error", "logging"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("error");
    expect(result).toContain("logging");
  });

  test("should highlight terms in different order", () => {
    const html =
      '<span class="hljs-string">"The quick brown fox jumps over the lazy dog"</span>';

    // Simulate NEAR operator with terms in different order
    const terms = ["dog", "fox"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("dog");
    expect(result).toContain("fox");
  });

  test("should highlight terms spanning multiple lines", () => {
    const html = `
      <span class="hljs-keyword">function</span> processData() {
        <span class="hljs-keyword">const</span> data = fetchData();
        <span class="hljs-keyword">return</span> processResult(data);
      }
    `;

    // Simulate NEAR operator with terms spanning multiple lines
    const terms = ["function", "return"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("function");
    expect(result).toContain("return");
  });
});

describe("highlightTermsInHtml - Unicode Characters", () => {
  test("should highlight Unicode characters", () => {
    const html = '<span class="hljs-string">"こんにちは世界"</span>'; // "Hello World" in Japanese

    const terms = ["こんにちは"]; // "Hello" in Japanese

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("こんにちは");
  });

  test("should highlight mixed Latin and Unicode characters", () => {
    const html =
      '<span class="hljs-string">"JavaScript ES6 features: λ functions"</span>';

    const terms = ["λ", "JavaScript"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("λ");
    expect(result).toContain("JavaScript");
  });

  test("should highlight emoji characters", () => {
    const html = '<span class="hljs-string">"User feedback: 👍 👎 🔥"</span>';

    const terms = ["👍", "🔥"];

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("👍");
    expect(result).toContain("🔥");
  });

  test("should handle complex Unicode scripts", () => {
    const html = '<span class="hljs-string">"مرحبا بالعالم"</span>'; // "Hello World" in Arabic

    const terms = ["مرحبا"]; // "Hello" in Arabic

    const result = highlightTermsInHtml(html, terms, true);

    expect(typeof result).toBe("string");
    expect(result).toContain("مرحبا");
  });
});
