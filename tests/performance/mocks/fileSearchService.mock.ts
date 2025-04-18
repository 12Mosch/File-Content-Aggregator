/**
 * Mock implementation of fileSearchService for performance tests
 * This avoids the need to import directly from the application code
 */

// Mock function for finding term indices
export function findTermIndices(
  content: string,
  term: string | RegExp,
  caseSensitive: boolean = false,
  isRegex: boolean = false,
  useWholeWordMatching: boolean = false
): number[] {
  const indices: number[] = [];
  
  if (isRegex && term instanceof RegExp) {
    // Ensure the regex has the global flag for iterative searching
    const regex = new RegExp(
      term.source,
      term.flags.includes("g") ? term.flags : term.flags + "g"
    );
    let match;
    while ((match = regex.exec(content)) !== null) {
      indices.push(match.index);
      // Prevent infinite loops with zero-width matches
      if (match.index === regex.lastIndex) {
        regex.lastIndex++;
      }
    }
  } else if (typeof term === "string") {
    if (useWholeWordMatching) {
      // Use regex with word boundaries for whole word matching
      const flags = caseSensitive ? "g" : "gi";
      const wordBoundaryRegex = new RegExp(
        `\\b${escapeRegExp(term)}\\b`,
        flags
      );
      let match;
      while ((match = wordBoundaryRegex.exec(content)) !== null) {
        indices.push(match.index);
        // Prevent infinite loops with zero-width matches
        if (match.index === wordBoundaryRegex.lastIndex) {
          wordBoundaryRegex.lastIndex++;
        }
      }
    } else {
      // Simple string search
      let startIndex = 0;
      let index;
      
      if (caseSensitive) {
        while ((index = content.indexOf(term, startIndex)) !== -1) {
          indices.push(index);
          startIndex = index + 1;
        }
      } else {
        const lowerContent = content.toLowerCase();
        const lowerTerm = term.toLowerCase();
        
        while ((index = lowerContent.indexOf(lowerTerm, startIndex)) !== -1) {
          indices.push(index);
          startIndex = index + 1;
        }
      }
    }
  }
  
  return indices;
}

// Helper function to escape special characters for RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Mock function for evaluating search expressions
export function evaluateSearchExpression(
  content: string,
  searchTerm: string,
  searchMode: string = "term",
  isRegex: boolean = false,
  fuzzySearchBooleanEnabled: boolean = false,
  fuzzySearchNearEnabled: boolean = false,
  caseSensitive: boolean = false,
  wholeWordMatchingEnabled: boolean = false
): boolean {
  // Simple implementation for performance testing
  switch (searchMode) {
    case "term":
      if (isRegex) {
        try {
          const flags = caseSensitive ? "" : "i";
          const regex = new RegExp(searchTerm, flags);
          return regex.test(content);
        } catch (error) {
          return false;
        }
      } else {
        if (wholeWordMatchingEnabled) {
          const flags = caseSensitive ? "g" : "gi";
          const wordBoundaryRegex = new RegExp(
            `\\b${escapeRegExp(searchTerm)}\\b`,
            flags
          );
          return wordBoundaryRegex.test(content);
        } else {
          if (caseSensitive) {
            return content.includes(searchTerm);
          } else {
            return content.toLowerCase().includes(searchTerm.toLowerCase());
          }
        }
      }
    
    case "boolean":
      // Simplified boolean evaluation for testing
      if (searchTerm.includes("AND")) {
        const terms = searchTerm.split("AND").map(t => t.trim());
        return terms.every(term => {
          if (term.startsWith("(") && term.endsWith(")")) {
            term = term.substring(1, term.length - 1).trim();
          }
          return evaluateSearchExpression(
            content, 
            term, 
            "term", 
            isRegex, 
            fuzzySearchBooleanEnabled,
            fuzzySearchNearEnabled,
            caseSensitive,
            wholeWordMatchingEnabled
          );
        });
      } else if (searchTerm.includes("OR")) {
        const terms = searchTerm.split("OR").map(t => t.trim());
        return terms.some(term => {
          if (term.startsWith("(") && term.endsWith(")")) {
            term = term.substring(1, term.length - 1).trim();
          }
          return evaluateSearchExpression(
            content, 
            term, 
            "term", 
            isRegex, 
            fuzzySearchBooleanEnabled,
            fuzzySearchNearEnabled,
            caseSensitive,
            wholeWordMatchingEnabled
          );
        });
      } else if (searchTerm.startsWith("NEAR(")) {
        // Very simplified NEAR implementation
        return true;
      }
      
      // Default to term search if no operators
      return evaluateSearchExpression(
        content, 
        searchTerm, 
        "term", 
        isRegex, 
        fuzzySearchBooleanEnabled,
        fuzzySearchNearEnabled,
        caseSensitive,
        wholeWordMatchingEnabled
      );
      
    default:
      return false;
  }
}
