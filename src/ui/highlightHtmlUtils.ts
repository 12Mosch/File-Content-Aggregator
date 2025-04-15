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
 * @returns New HTML string with search terms highlighted
 */
export function highlightTermsInHtml(
  html: string,
  terms: (string | RegExp)[],
  caseSensitive: boolean
): string {
  // If empty HTML, return the original HTML
  if (!html) {
    return html;
  }

  // Debug: Log the terms being used for highlighting
  console.log(
    "Highlighting HTML with terms:",
    terms,
    "caseSensitive:",
    caseSensitive
  );

  // Ensure terms is an array and filter out empty terms
  const termsArray = Array.isArray(terms) ? terms : [];
  const validTerms = termsArray.filter((term) => {
    if (typeof term === "string") {
      const trimmed = term.trim();
      return trimmed.length > 0;
    }
    return term instanceof RegExp;
  });

  // Debug: Log the valid terms after filtering
  console.log(
    "highlightTermsInHtml - Valid terms after filtering:",
    validTerms.map((t) => (typeof t === "string" ? t : t.toString()))
  );

  // Process the valid terms for highlighting
  if (!validTerms.length) {
    // No valid terms to highlight, just return the original HTML
    return html;
  }

  console.log("Valid terms for highlighting:", validTerms);

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = html;

  // Helper function to escape special characters for RegExp
  const escapeRegExp = (string: string): string => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  };

  // Process all text nodes in the DOM
  const walkTextNodes = (node: Node) => {
    // Debug: Log the node type and content
    console.log(
      `Processing node: type=${node.nodeType}, content=${node.nodeType === Node.TEXT_NODE ? node.textContent : "non-text node"}`
    );
    if (node.nodeType === Node.TEXT_NODE && node.textContent) {
      let textContent = node.textContent;
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
              // Term extracted successfully
            }

            // Check for quoted strings like "database"
            const quotedMatch = searchTerm.match(/^"(.+)"$/);
            if (quotedMatch && quotedMatch[1]) {
              searchTerm = quotedMatch[1].trim();
              // Quoted term extracted successfully
            }
            regex = new RegExp(
              escapeRegExp(searchTerm),
              caseSensitive ? "g" : "gi"
            );
          } else {
            // Use the provided RegExp object, ensure it has the global flag
            regex = new RegExp(
              term.source,
              term.flags.includes("g") ? term.flags : term.flags + "g"
            );
          }

          // Reset regex state
          regex.lastIndex = 0;

          // Find all matches in this text node
          let match;
          let currentText = textContent;
          let currentLastIndex = 0;
          const currentFragments: (string | Node)[] = [];

          while ((match = regex.exec(currentText)) !== null) {
            console.log(`Found match: '${match[0]}' at index ${match.index}`);
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

            // Add title attribute for tooltip
            let tooltipText =
              "Search terms are highlighted in content previews";
            if (typeof term === "string" && term.match(/^"(.+)"$/)) {
              tooltipText +=
                ' - Quoted terms like "database" are automatically highlighted without quotes';
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
        console.log("Node was modified, replacing with fragments", fragments);
        const parent = node.parentNode;
        if (parent) {
          fragments.forEach((fragment) => {
            if (typeof fragment === "string") {
              parent.insertBefore(document.createTextNode(fragment), node);
            } else {
              console.log(
                "Inserting span with class:",
                (fragment as Element).className
              );
              parent.insertBefore(fragment, node);
            }
          });
          parent.removeChild(node);
        }
      } else {
        console.log("No modifications made to this text node");
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // Recursively process child nodes
      Array.from(node.childNodes).forEach(walkTextNodes);
    }
  };

  // Process all text nodes in the DOM
  Array.from(tempDiv.childNodes).forEach(walkTextNodes);

  // Debug: Log the modified HTML
  const modifiedHtml = tempDiv.innerHTML;
  console.log(
    "Modified HTML with highlighted terms:",
    modifiedHtml.includes("search-term-match")
      ? "Contains search-term-match class"
      : "No search-term-match class found"
  );

  // Return the modified HTML
  return modifiedHtml;
}
