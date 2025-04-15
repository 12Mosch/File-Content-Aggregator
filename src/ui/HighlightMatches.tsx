import React from "react";

interface HighlightMatchesProps {
  text: string | null | undefined;
  terms: (string | RegExp)[];
  caseSensitive: boolean; // Case sensitivity for simple string terms
}

// Helper function to escape special characters for RegExp (remains the same)
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

interface Match {
  start: number;
  end: number;
  term: string | RegExp; // Keep track of which term matched
}

const HighlightMatches: React.FC<HighlightMatchesProps> = ({
  text,
  terms,
  caseSensitive,
}) => {
  if (!text) {
    return <>{""}</>;
  }

  const validTerms = terms.filter((term) => {
    if (typeof term === "string") return term.trim().length > 0;
    return term instanceof RegExp;
  });

  if (validTerms.length === 0) {
    return <>{text}</>;
  }

  const matches: Match[] = [];

  // Find all matches for all terms
  validTerms.forEach((term) => {
    try {
      let regex: RegExp;
      if (typeof term === "string") {
        // Create regex for string term, respecting caseSensitive prop
        regex = new RegExp(escapeRegExp(term), caseSensitive ? "g" : "gi");
      } else {
        // Use the provided RegExp object, ensure it has the global flag
        regex = new RegExp(
          term.source,
          term.flags.includes("g") ? term.flags : term.flags + "g"
        );
      }

      let matchResult;
      while ((matchResult = regex.exec(text)) !== null) {
        // Add match details
        matches.push({
          start: matchResult.index,
          end: regex.lastIndex,
          term: term, // Store the original term (string or RegExp)
        });

        // Prevent infinite loops for zero-length matches (e.g., /a*?/g)
        if (matchResult.index === regex.lastIndex) {
          regex.lastIndex++;
        }
      }
    } catch (error) {
      console.error("Error executing RegExp for highlighting:", term, error);
      // Continue with other terms if one fails
    }
  });

  if (matches.length === 0) {
    return <>{text}</>; // No matches found
  }

  // Sort matches by start index to process them in order
  matches.sort((a, b) => a.start - b.start);

  const resultElements: React.ReactNode[] = [];
  let lastIndex = 0;

  // Iterate through sorted matches and build the output array
  matches.forEach((match, i) => {
    // Add the text segment before the current match (if any)
    if (match.start > lastIndex) {
      resultElements.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {text.substring(lastIndex, match.start)}
        </React.Fragment>
      );
    }

    // Add the highlighted match, ensuring not to double-highlight overlapping parts
    // Only add the mark if this match starts at or after the end of the previous one
    if (match.start >= lastIndex) {
      resultElements.push(
        <mark
          key={`mark-${match.start}-${i}`}
          className="bg-primary/80 text-primary-foreground px-0.5 rounded-[0.2rem] font-medium"
        >
          {text.substring(match.start, match.end)}
        </mark>
      );
      lastIndex = match.end; // Update lastIndex to the end of this match
    }
    // If a match overlaps a previous one (starts before the previous ended),
    // we skip adding it to avoid nested marks or broken text. The longer, earlier match takes precedence.
  });

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    resultElements.push(
      <React.Fragment key={`text-${lastIndex}`}>
        {text.substring(lastIndex)}
      </React.Fragment>
    );
  }

  return <>{resultElements}</>;
};

export default HighlightMatches;
