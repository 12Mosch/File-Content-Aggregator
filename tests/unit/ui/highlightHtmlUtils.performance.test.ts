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

describe("highlightTermsInHtml - Performance", () => {
  test("should handle large HTML documents", () => {
    // Create a large HTML document with repeated elements
    const repeatedElement = '<span class="hljs-keyword">const</span> x = 10;\n';
    const largeHtml = repeatedElement.repeat(1000);

    // This should not crash or timeout
    const result = highlightTermsInHtml(largeHtml, ["const"], true);
    expect(typeof result).toBe("string");
  });

  test("should handle many search terms", () => {
    const html =
      '<span class="hljs-keyword">const</span> x = 10; <span class="hljs-keyword">let</span> y = 20;';

    // Create an array with many search terms
    const manyTerms = Array.from({ length: 50 }, (_, i) => `term${i}`);

    // Add a few terms that will actually match
    manyTerms.push("const");
    manyTerms.push("let");

    // This should not crash or timeout
    const result = highlightTermsInHtml(html, manyTerms, true);
    expect(typeof result).toBe("string");
    expect(result).toContain("const");
    expect(result).toContain("let");
  });

  test("should handle many regex terms", () => {
    const html =
      '<span class="hljs-keyword">const</span> x = 10; <span class="hljs-keyword">let</span> y = 20;';

    // Create an array with many regex terms
    const manyRegexTerms = Array.from(
      { length: 20 },
      (_, i) => new RegExp(`term${i}`, "g")
    );

    // Add a few regex terms that will actually match
    manyRegexTerms.push(/const/g);
    manyRegexTerms.push(/let/g);

    // This should not crash or timeout
    const result = highlightTermsInHtml(html, manyRegexTerms, true);
    expect(typeof result).toBe("string");
  });

  // This test is marked as skip because it's meant to be run manually when needed
  // as it might take a long time to execute
  test.skip("stress test with large HTML and many terms", () => {
    // Create a very large HTML document
    const repeatedElement = '<span class="hljs-keyword">const</span> x = 10;\n';
    const veryLargeHtml = repeatedElement.repeat(5000);

    // Create many search terms
    const manyTerms = Array.from({ length: 100 }, (_, i) => `term${i}`);
    manyTerms.push("const"); // Add one that will match

    // Measure execution time
    const startTime = performance.now();
    const result = highlightTermsInHtml(veryLargeHtml, manyTerms, true);
    const endTime = performance.now();

    console.log(`Execution time: ${endTime - startTime} ms`);

    expect(typeof result).toBe("string");
  });
});
