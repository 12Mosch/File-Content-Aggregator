import React from "react";
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

  // Debug: Log the terms being used for highlighting
  console.log(
    "HighlightMatches received terms:",
    terms,
    "caseSensitive:",
    caseSensitive
  );

  if (!text) {
    return <>{""}</>;
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

  // Debug: Log the valid terms after filtering
  console.log(
    "Valid terms after filtering:",
    validTerms.map((t) => (typeof t === "string" ? t : t.toString()))
  );

  if (validTerms.length === 0) {
    // No valid terms to highlight, just return the text
    return <>{text}</>;
  }

  console.log("Valid terms for HighlightMatches:", validTerms);

  const matches: Match[] = [];

  // Find all matches for all terms
  validTerms.forEach((term) => {
    try {
      let regex: RegExp;
      if (typeof term === "string") {
        // Create regex for string term, respecting caseSensitive prop
        // Process the term to handle various formats
        let searchTerm = term.trim();

        console.log(`[HighlightMatches] Processing term: "${searchTerm}"`);

        // Check for "Term:" prefix
        const termMatch = searchTerm.match(/^Term:\s*(.+)$/i);
        if (termMatch && termMatch[1]) {
          searchTerm = termMatch[1].trim();
          console.log(
            `[HighlightMatches] Extracted term from Term: prefix: "${searchTerm}"`
          );
        }

        // Check for quoted strings like "database"
        const quotedMatch = searchTerm.match(/^"(.+)"$/);
        if (quotedMatch && quotedMatch[1]) {
          searchTerm = quotedMatch[1].trim();
          console.log(
            `[HighlightMatches] Extracted term from quotes: "${searchTerm}"`
          );
        }

        // Skip empty terms
        if (searchTerm.length === 0) {
          console.log(`[HighlightMatches] Skipping empty term`);
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
      // Create tooltip text based on the match type
      let tooltipText = t("results:highlightingTerms");
      if (typeof match.term === "string" && match.term.match(/^"(.+)"$/)) {
        tooltipText += " - " + t("results:highlightingQuotedTerms");
      }

      resultElements.push(
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
    resultElements.push(
      <React.Fragment key={`text-${lastIndex}`}>
        {text.substring(lastIndex)}
      </React.Fragment>
    );
  }

  return <>{resultElements}</>;
};

export default HighlightMatches;
