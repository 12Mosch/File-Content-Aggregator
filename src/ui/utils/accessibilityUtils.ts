/**
 * Accessibility Utilities for Syntax Highlighting
 *
 * Provides functions to enhance syntax-highlighted content with proper
 * accessibility attributes and semantic markup.
 */

export interface AccessibilityOptions {
  language: string;
  theme?: string;
  lineNumbers?: boolean;
  fileName?: string;
  totalLines?: number;
  isCollapsible?: boolean;
  isExpanded?: boolean;
}

/**
 * Add comprehensive accessibility attributes to highlighted HTML
 */
export function enhanceWithAccessibility(
  html: string,
  options: AccessibilityOptions
): string {
  const {
    language,
    theme = "default",
    lineNumbers = false,
    fileName,
    totalLines,
    isCollapsible = false,
    isExpanded = true,
  } = options;

  // Create accessible wrapper
  const ariaLabel = createAriaLabel(language, fileName, totalLines);
  const roleAttributes = createRoleAttributes(isCollapsible, isExpanded);
  const themeClass = theme !== "default" ? ` hljs-theme-${theme}` : "";

  let accessibleHtml = `<div ${roleAttributes} aria-label="${ariaLabel}" class="hljs-enhanced${themeClass}" tabindex="0">`;

  // Add screen reader description
  accessibleHtml += createScreenReaderDescription(options);

  // Add line numbers if requested
  if (lineNumbers && totalLines) {
    accessibleHtml += createLineNumbers(totalLines);
  }

  // Wrap the main content
  accessibleHtml += `<code role="code" aria-describedby="hljs-desc-${generateId()}" class="hljs-content">`;
  accessibleHtml += enhanceTokensWithAccessibility(html, language);
  accessibleHtml += "</code>";

  // Add keyboard navigation hints
  accessibleHtml += createKeyboardHints();

  accessibleHtml += "</div>";

  return accessibleHtml;
}

/**
 * Create appropriate ARIA label for the code block
 */
function createAriaLabel(
  language: string,
  fileName?: string,
  totalLines?: number
): string {
  let label = `Code block in ${language}`;

  if (fileName) {
    label += ` from file ${fileName}`;
  }

  if (totalLines) {
    label += `, ${totalLines} line${totalLines !== 1 ? "s" : ""}`;
  }

  return label;
}

/**
 * Create role attributes for collapsible content
 */
function createRoleAttributes(
  isCollapsible: boolean,
  isExpanded: boolean
): string {
  if (isCollapsible) {
    return `role="region" aria-expanded="${isExpanded}" aria-controls="hljs-content-${generateId()}"`;
  }
  return 'role="region"';
}

/**
 * Create screen reader description
 */
function createScreenReaderDescription(options: AccessibilityOptions): string {
  const id = generateId();
  const { language, totalLines, fileName } = options;

  let description = `This is a ${language} code block`;
  if (fileName) {
    description += ` from ${fileName}`;
  }
  if (totalLines) {
    description += ` with ${totalLines} lines`;
  }
  description += ". Use arrow keys to navigate through the code.";

  return `<div id="hljs-desc-${id}" class="sr-only">${description}</div>`;
}

/**
 * Create line numbers with accessibility support
 */
function createLineNumbers(totalLines: number): string {
  let lineNumbersHtml =
    '<div class="hljs-line-numbers" aria-label="Line numbers" role="presentation">';

  for (let i = 1; i <= totalLines; i++) {
    lineNumbersHtml += `<span class="hljs-line-number" aria-label="Line ${i}">${i}</span>`;
  }

  lineNumbersHtml += "</div>";
  return lineNumbersHtml;
}

/**
 * Enhance syntax tokens with accessibility information
 */
function enhanceTokensWithAccessibility(
  html: string,
  _language: string
): string {
  // Map of highlight.js classes to semantic descriptions
  const tokenDescriptions: Record<string, string> = {
    "hljs-keyword": "keyword",
    "hljs-string": "string literal",
    "hljs-number": "number",
    "hljs-comment": "comment",
    "hljs-function": "function",
    "hljs-class": "class",
    "hljs-variable": "variable",
    "hljs-type": "type",
    "hljs-built_in": "built-in function",
    "hljs-literal": "literal value",
    "hljs-tag": "HTML tag",
    "hljs-attribute": "attribute",
    "hljs-selector-tag": "CSS selector",
    "hljs-property": "CSS property",
    "hljs-title": "title or name",
    "hljs-meta": "metadata",
    "hljs-doctag": "documentation tag",
    "hljs-section": "section header",
    "hljs-name": "name",
    "hljs-symbol": "symbol",
    "hljs-bullet": "list bullet",
    "hljs-subst": "substitution",
    "hljs-template-variable": "template variable",
    "hljs-template-tag": "template tag",
    "hljs-addition": "added line",
    "hljs-deletion": "deleted line",
    "hljs-link": "link",
    "hljs-quote": "quote",
    "hljs-regexp": "regular expression",
  };

  // Add aria-label to significant tokens
  let enhancedHtml = html;

  Object.entries(tokenDescriptions).forEach(([className, description]) => {
    const regex = new RegExp(
      `<span class="([^"]*${className}[^"]*)"([^>]*)>`,
      "g"
    );
    enhancedHtml = enhancedHtml.replace(
      regex,
      (match: string, classes: string, attributes: string) => {
        // Only add aria-label if it doesn't already exist
        if (
          typeof attributes === "string" &&
          !attributes.includes("aria-label")
        ) {
          return `<span class="${classes}" aria-label="${description}"${attributes}>`;
        }
        return match;
      }
    );
  });

  return enhancedHtml;
}

/**
 * Create keyboard navigation hints
 */
function createKeyboardHints(): string {
  return `
    <div class="hljs-keyboard-hints sr-only" role="note">
      <p>Keyboard navigation: Use Tab to focus, arrow keys to scroll, Escape to exit focus.</p>
    </div>
  `;
}

/**
 * Generate unique ID for accessibility elements
 */
function generateId(): string {
  return Math.random().toString(36).substr(2, 9);
}

/**
 * Create skip link for long code blocks
 */
export function createSkipLink(targetId: string, totalLines?: number): string {
  if (!totalLines || totalLines < 20) {
    return "";
  }

  return `
    <a href="#${targetId}-end" class="hljs-skip-link sr-only-focusable">
      Skip code block (${totalLines} lines)
    </a>
  `;
}

/**
 * Create end marker for skip links
 */
export function createSkipTarget(targetId: string): string {
  return `<div id="${targetId}-end" class="hljs-skip-target" tabindex="-1"></div>`;
}

/**
 * Validate and sanitize accessibility options
 */
export function validateAccessibilityOptions(
  options: Partial<AccessibilityOptions>
): AccessibilityOptions {
  const validLanguages = [
    "javascript",
    "typescript",
    "python",
    "java",
    "csharp",
    "rust",
    "go",
    "php",
    "ruby",
    "swift",
    "kotlin",
    "scala",
    "cpp",
    "c",
    "html",
    "css",
    "json",
    "xml",
    "yaml",
    "sql",
    "shell",
    "bash",
    "powershell",
    "plaintext",
  ];

  const validThemes = ["light", "dark", "high-contrast"];

  return {
    language: validLanguages.includes(options.language || "")
      ? options.language!
      : "plaintext",
    theme: validThemes.includes(options.theme || "")
      ? options.theme
      : undefined,
    lineNumbers: Boolean(options.lineNumbers),
    fileName:
      typeof options.fileName === "string" ? options.fileName : undefined,
    totalLines:
      typeof options.totalLines === "number" && options.totalLines > 0
        ? options.totalLines
        : undefined,
    isCollapsible: Boolean(options.isCollapsible),
    isExpanded: options.isExpanded !== false, // Default to true
  };
}

/**
 * Screen reader only CSS class utility
 */
export const srOnlyStyles = `
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
  
  .sr-only-focusable:focus {
    position: static;
    width: auto;
    height: auto;
    padding: 0.25rem 0.5rem;
    margin: 0;
    overflow: visible;
    clip: auto;
    white-space: normal;
    background: #007acc;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
  }
  
  .hljs-skip-link {
    display: block;
    padding: 0.5rem;
    background: #007acc;
    color: white;
    text-decoration: none;
    border-radius: 0.25rem;
    margin-bottom: 0.5rem;
  }
  
  .hljs-skip-target {
    position: absolute;
    top: -1px;
    left: -1px;
    width: 1px;
    height: 1px;
  }
`;
