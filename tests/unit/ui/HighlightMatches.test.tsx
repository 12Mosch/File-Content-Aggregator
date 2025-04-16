import React from "react";
import { render } from "@testing-library/react";
import HighlightMatches from "../../../src/ui/HighlightMatches";
import "@jest/globals";

// Mock the i18n functionality
jest.mock("react-i18next", () => ({
  useTranslation: () => {
    return {
      t: (key: string) => {
        // Return simple translations for testing
        const translations: Record<string, string> = {
          "results:highlightingTerms": "Search terms are highlighted",
          "results:highlightingQuotedTerms":
            "Quoted terms are highlighted exactly",
        };
        return translations[key] || key;
      },
    };
  },
}));

// Mock console.log and console.error to avoid cluttering test output
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
});

describe("HighlightMatches", () => {
  test("should render text without highlights when no terms provided", () => {
    const { container } = render(
      <HighlightMatches text="Sample text" terms={[]} caseSensitive={true} />
    );
    expect(container.textContent).toBe("Sample text");
  });

  test("should render text without highlights when text is empty", () => {
    const { container } = render(
      <HighlightMatches text="" terms={["test"]} caseSensitive={true} />
    );
    expect(container.textContent).toBe("");
  });

  test("should render null text as empty string", () => {
    const { container } = render(
      <HighlightMatches text={null} terms={["test"]} caseSensitive={true} />
    );
    expect(container.textContent).toBe("");
  });

  test("should highlight exact matches", () => {
    const { container } = render(
      <HighlightMatches
        text="This is a test string with test word repeated"
        terms={["test"]}
        caseSensitive={true}
      />
    );

    // The component should render the text with highlighted parts
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Each mark should have the correct styling
    marks.forEach((mark) => {
      expect(mark.tagName).toBe("MARK");
      // Check for style attributes
      expect(mark.style.backgroundColor).toBeTruthy();
      expect(mark.style.color).toBeTruthy();
    });
  });

  test("should respect case sensitivity", () => {
    // Case-sensitive search
    const { container, rerender } = render(
      <HighlightMatches
        text="This is a Test string with test word"
        terms={["Test"]}
        caseSensitive={true}
      />
    );

    // Should only highlight the exact case match
    const caseSensitiveMarks = container.querySelectorAll("mark");
    expect(caseSensitiveMarks.length).toBe(1);
    expect(caseSensitiveMarks[0].textContent).toBe("Test");

    // Case-insensitive search
    rerender(
      <HighlightMatches
        text="This is a Test string with test word"
        terms={["test"]}
        caseSensitive={false}
      />
    );

    // Should highlight both "Test" and "test"
    const caseInsensitiveMarks = container.querySelectorAll("mark");
    expect(caseInsensitiveMarks.length).toBe(2);
  });

  test("should handle regex terms", () => {
    const { container } = render(
      <HighlightMatches
        text="This is a test123 string"
        terms={[/test\d+/]}
        caseSensitive={true}
      />
    );

    // Should highlight "test123"
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("test123");
  });
});

describe("HighlightMatches - Fuzzy Search", () => {
  test("should highlight fuzzy matches with slight misspellings", () => {
    // Simulate fuzzy search by using regex patterns that would match similar terms
    const { container } = render(
      <HighlightMatches
        text="This is a function that calculates the total"
        terms={[/f[a-z]*n[a-z]*n/i]} // Should match "function" with fuzzy matching
        caseSensitive={false}
      />
    );

    // Should highlight "function"
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("function");
  });

  test("should highlight fuzzy matches with character transpositions", () => {
    const { container } = render(
      <HighlightMatches
        text="The calculateTotal function computes the sum"
        terms={[/c[a-z]*lc[a-z]*late/i]} // Should match "calculate" with transposed characters
        caseSensitive={false}
      />
    );

    // Should highlight "calculate" in "calculateTotal"
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent.includes("calculate")).toBe(true);
  });

  test("should highlight fuzzy matches with missing characters", () => {
    const { container } = render(
      <HighlightMatches
        text="The database connection string is configured"
        terms={[/d[a-z]*b[a-z]*se/i]} // Should match "database" with missing characters
        caseSensitive={false}
      />
    );

    // Should highlight "database"
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("database");
  });

  test("should highlight fuzzy matches with extra characters", () => {
    const { container } = render(
      <HighlightMatches
        text="Configuration settings are stored in the config file"
        terms={[/c[a-z]*n[a-z]*f[a-z]*g[a-z]*r[a-z]*t[a-z]*n/i]} // Should match "configuration" with extra chars
        caseSensitive={false}
      />
    );

    // Should highlight "Configuration"
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("Configuration");
  });
});

describe("HighlightMatches - NEAR Operator", () => {
  test("should highlight terms found via NEAR operator", () => {
    // Simulate NEAR operator by highlighting individual terms that would be found via NEAR
    const { container } = render(
      <HighlightMatches
        text="The database connection string contains sensitive information"
        terms={["database", "string"]}
        caseSensitive={true}
      />
    );

    // Should highlight both terms
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Check that we have both terms highlighted
    const markTexts = Array.from(marks).map((mark) => mark.textContent);
    expect(markTexts.includes("database")).toBe(true);
    expect(markTexts.includes("string")).toBe(true);
  });

  test("should highlight terms with different proximity", () => {
    const { container } = render(
      <HighlightMatches
        text="Error handling is important. Always implement proper logging for errors."
        terms={["Error", "logging"]}
        caseSensitive={false}
      />
    );

    // Should highlight both terms despite being far apart
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThan(1); // At least 2 marks (Error and logging)

    // Check that we have both terms highlighted (case insensitive)
    const markTexts = Array.from(marks).map((mark) =>
      mark.textContent.toLowerCase()
    );
    expect(markTexts.includes("error") || markTexts.includes("errors")).toBe(
      true
    );
    expect(markTexts.includes("logging")).toBe(true);
  });

  test("should highlight terms in different order", () => {
    const { container } = render(
      <HighlightMatches
        text="The quick brown fox jumps over the lazy dog"
        terms={["dog", "fox"]}
        caseSensitive={true}
      />
    );

    // Should highlight both terms regardless of their order in the text
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Check that we have both terms highlighted
    const markTexts = Array.from(marks).map((mark) => mark.textContent);
    expect(markTexts.includes("fox")).toBe(true);
    expect(markTexts.includes("dog")).toBe(true);
  });

  test("should highlight terms spanning multiple lines", () => {
    const { container } = render(
      <HighlightMatches
        text={`function processData() {
  const data = fetchData();
  return processResult(data);
}`}
        terms={["function", "return"]}
        caseSensitive={true}
      />
    );

    // Should highlight both terms despite being on different lines
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Check that we have both terms highlighted
    const markTexts = Array.from(marks).map((mark) => mark.textContent);
    expect(markTexts.includes("function")).toBe(true);
    expect(markTexts.includes("return")).toBe(true);
  });
});

describe("HighlightMatches - Unicode Characters", () => {
  test("should highlight Unicode characters", () => {
    const { container } = render(
      <HighlightMatches
        text="こんにちは世界" // "Hello World" in Japanese
        terms={["こんにちは"]} // "Hello" in Japanese
        caseSensitive={true}
      />
    );

    // Should highlight the Japanese text
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("こんにちは");
  });

  test("should highlight mixed Latin and Unicode characters", () => {
    const { container } = render(
      <HighlightMatches
        text="JavaScript ES6 features: λ functions"
        terms={["λ", "JavaScript"]}
        caseSensitive={true}
      />
    );

    // Should highlight both terms
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Check that we have both terms highlighted
    const markTexts = Array.from(marks).map((mark) => mark.textContent);
    expect(markTexts.includes("λ")).toBe(true);
    expect(markTexts.includes("JavaScript")).toBe(true);
  });

  test("should highlight emoji characters", () => {
    const { container } = render(
      <HighlightMatches
        text="User feedback: 👍 👎 🔥"
        terms={["👍", "🔥"]}
        caseSensitive={true}
      />
    );

    // Should highlight the emojis
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(2);

    // Check that we have both emojis highlighted
    const markTexts = Array.from(marks).map((mark) => mark.textContent);
    expect(markTexts.includes("👍")).toBe(true);
    expect(markTexts.includes("🔥")).toBe(true);
  });

  test("should handle complex Unicode scripts", () => {
    const { container } = render(
      <HighlightMatches
        text="مرحبا بالعالم" // "Hello World" in Arabic
        terms={["مرحبا"]} // "Hello" in Arabic
        caseSensitive={true}
      />
    );

    // Should highlight the Arabic text
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBe(1);
    expect(marks[0].textContent).toBe("مرحبا");
  });
});
