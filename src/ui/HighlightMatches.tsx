import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";

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
  const { t } = useTranslation();

  // All useMemo hooks are called unconditionally at the top level
  const validTerms = useMemo(() => {
    // Ensure terms is an array and filter out empty terms
    const termsArray = Array.isArray(terms) ? terms : [];
    return termsArray.filter((term) => {
      if (typeof term === "string") {
        const trimmed = term.trim();
        return trimmed.length > 0;
      }
      return term instanceof RegExp;
    });
  }, [terms]);

  const matches = useMemo(() => {
    // Early return for empty text or no valid terms
    if (!text || validTerms.length === 0) {
      return [];
    }

    const result: Match[] = [];

    // Find all matches for all terms
    validTerms.forEach((term) => {
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

          // Skip empty terms
          if (searchTerm.length === 0) {
            return;
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

        let matchResult;
        while ((matchResult = regex.exec(text)) !== null) {
          // Add match details
          result.push({
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

    // Sort matches by start index to process them in order
    return result.sort((a, b) => a.start - b.start);
  }, [validTerms, text, caseSensitive]);

  const resultElements = useMemo(() => {
    // Early return for empty text
    if (!text) {
      return [];
    }

    // If no valid terms or no matches, return the original text
    if (validTerms.length === 0 || matches.length === 0) {
      return [<React.Fragment key="original">{text}</React.Fragment>];
    }

    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    // Iterate through sorted matches and build the output array
    matches.forEach((match, i) => {
      // Add the text segment before the current match (if any)
      if (match.start > lastIndex) {
        elements.push(
          <React.Fragment key={`text-${lastIndex}`}>
            {text.substring(lastIndex, match.start)}
          </React.Fragment>
        );
      }

      // Add the highlighted match, ensuring not to double-highlight overlapping parts
      // Only add the mark if this match starts at or after the end of the previous one
      if (match.start >= lastIndex) {
        // Create tooltip text based on the match type
        let tooltipText = t("results:highlightingTerms");
        if (typeof match.term === "string" && match.term.match(/^"(.+)"$/)) {
          tooltipText += " - " + t("results:highlightingQuotedTerms");
        }

        elements.push(
          <mark
            key={`mark-${match.start}-${i}`}
            className="bg-primary/80 text-primary-foreground px-0.5 rounded-[0.2rem] font-medium cursor-help inline-block"
            title={tooltipText}
            style={{
              display: "inline-block",
              backgroundColor: "#8a2be2", // Violet color (user preference)
              color: "white",
              opacity: 0.9,
              fontWeight: "bold",
            }}
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
      elements.push(
        <React.Fragment key={`text-${lastIndex}`}>
          {text.substring(lastIndex)}
        </React.Fragment>
      );
    }

    return elements;
  }, [matches, text, t, validTerms]);

  // Early return for empty text
  if (!text) {
    return <>{""}</>;
  }

  return <>{resultElements}</>;
};

export default HighlightMatches;
