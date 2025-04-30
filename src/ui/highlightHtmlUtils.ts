/**
 * Utility functions for highlighting search terms within HTML content
 * (particularly HTML that has already been syntax-highlighted by highlight.js)
 */

/**
 * Highlights search terms within HTML content that has already been syntax-highlighted.
 * This function parses the HTML, finds text nodes containing the search terms,
 * and wraps those terms in a span with a special class.
 *
 * @param html The HTML string (typically from highlight.js)
 * @param terms Array of search terms (strings or RegExp objects)
 * @param caseSensitive Whether the search should be case-sensitive
 * @param wholeWordMatching Whether to match whole words only
 * @returns New HTML string with search terms highlighted
 */
export function highlightTermsInHtml(
  html: string,
  terms: (string | RegExp)[],
  caseSensitive: boolean,
  wholeWordMatching: boolean = false
): string {
  // If empty HTML, return the original HTML
  if (!html) {
    return html;
  }

  // Ensure terms is an array and filter out empty terms
  const termsArray = Array.isArray(terms) ? terms : [];
  const validTerms = termsArray.filter((term) => {
    if (typeof term === "string") {
      const trimmed = term.trim();
      return trimmed.length > 0;
    }
    return term instanceof RegExp;
  });

  // Process the valid terms for highlighting
  if (!validTerms.length) {
    // No valid terms to highlight, just return the original HTML
    return html;
  }

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Helper function to escape special characters for RegExp
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // Process all text nodes in the DOM
  const walkTextNodes = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      const textContent = node.textContent;
      let modified = false;
      const fragments: (string | Node)[] = [];

      // Process each term
      for (const term of validTerms) {
        try {
          let regex: RegExp;
          if (typeof term === "string") {
            // Create regex for string term, respecting caseSensitive prop
            // Process the term to handle various formats
            let searchTerm = term.trim();

            // Check for "Term:" prefix
            const termMatch = searchTerm.match(/^Term:\s*(.+)$/i);
            if (termMatch && termMatch[1]) {
              searchTerm = termMatch[1].trim();
            }

            // Check for quoted strings like "database"
            const quotedMatch = searchTerm.match(/^"(.+)"$/);
            if (quotedMatch && quotedMatch[1]) {
              searchTerm = quotedMatch[1].trim();
            }

            // Apply whole word matching if enabled
            if (wholeWordMatching) {
              // Use word boundary markers for whole word matching
              regex = new RegExp(
                `\\b${escapeRegExp(searchTerm)}\\b`,
                caseSensitive ? "g" : "gi"
              );
            } else {
              regex = new RegExp(
                escapeRegExp(searchTerm),
                caseSensitive ? "g" : "gi"
              );
            }
          } else {
            // Use the provided RegExp object, ensure it has the global flag
            // For RegExp objects, we don't modify them for whole word matching
            // as they may already have their own boundary conditions
            regex = new RegExp(
              term.source,
              term.flags.includes("g") ? term.flags : term.flags + "g"
            );
          }

          // Reset regex state
          regex.lastIndex = 0;

          // Find all matches in this text node
          let match;
          const currentText = textContent;
          let currentLastIndex = 0;
          const currentFragments: (string | Node)[] = [];

          while ((match = regex.exec(currentText)) !== null) {
            // Add text before the match
            if (match.index > currentLastIndex) {
              currentFragments.push(
                currentText.substring(currentLastIndex, match.index)
              );
            }

            // Create a span for the matched text
            const span = document.createElement("span");
            span.className = "search-term-match";
            span.textContent = match[0];

            // Add inline styles for better visibility
            span.style.backgroundColor = "#8a2be2"; // Violet color
            span.style.color = "white";
            span.style.padding = "0 2px";
            span.style.borderRadius = "2px";
            span.style.fontWeight = "bold";
            span.style.boxShadow = "0 0 2px rgba(138, 43, 226, 0.5)"; // Subtle glow effect
            span.style.transition = "all 0.2s ease"; // Smooth transition for hover effects

            // Add title attribute for tooltip
            let tooltipText = "Search term match";
            if (wholeWordMatching) {
              tooltipText += " (whole word matching enabled)";
            }
            if (typeof term === "string" && term.match(/^"(.+)"$/)) {
              tooltipText += " - Quoted term highlighted without quotes";
            }
            span.setAttribute("title", tooltipText);
            currentFragments.push(span);

            currentLastIndex = regex.lastIndex;

            // Prevent infinite loops for zero-length matches
            if (match.index === regex.lastIndex) {
              regex.lastIndex++;
            }

            modified = true;
          }

          // Add remaining text
          if (currentLastIndex < currentText.length) {
            currentFragments.push(currentText.substring(currentLastIndex));
          }

          // If we found matches, update the text content for the next term
          if (modified) {
            // Reconstruct the text content for the next term
            const tempContainer = document.createElement("div");
            currentFragments.forEach((fragment) => {
              if (typeof fragment === "string") {
                tempContainer.appendChild(document.createTextNode(fragment));
              } else {
                tempContainer.appendChild(fragment);
              }
            });

            // For the next iteration, we'll only process text nodes
            const newFragments: (string | Node)[] = [];
            Array.from(tempContainer.childNodes).forEach((childNode) => {
              if (childNode.nodeType === Node.TEXT_NODE) {
                newFragments.push(childNode.textContent || "");
              } else {
                newFragments.push(childNode);
              }
            });

            fragments.push(...newFragments);
            break; // Process one term at a time to avoid complexity
          }
        } catch (error) {
          console.error("Error highlighting term in HTML:", term, error);
        }
      }

      // If we modified the text, replace the text node with our fragments
      if (modified) {
        const parent = node.parentNode;
        if (parent) {
          fragments.forEach((fragment) => {
            if (typeof fragment === "string") {
              parent.insertBefore(document.createTextNode(fragment), node);
            } else {
              parent.insertBefore(fragment, node);
            }
          });
          parent.removeChild(node);
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Recursively process child nodes
      Array.from(node.childNodes).forEach(walkTextNodes);
    }
  };

  // Process all text nodes in the DOM
  Array.from(tempDiv.childNodes).forEach(walkTextNodes);

  // Return the modified HTML
  return tempDiv.innerHTML;
}
