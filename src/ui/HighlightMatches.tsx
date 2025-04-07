import React from 'react';

interface HighlightMatchesProps {
  text: string | null | undefined;
  term: string;
  caseSensitive: boolean;
  // Removed highlightClassName prop
}

// Helper function to escape special characters for RegExp (remains the same)
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const HighlightMatches: React.FC<HighlightMatchesProps> = ({
  text,
  term,
  caseSensitive,
}) => {
  if (!text) {
    return <>{''}</>; // Return empty fragment if text is null/undefined/empty
  }
  if (!term.trim()) {
    return <>{text}</>; // Return original text if term is empty
  }

  try {
    // Create RegExp safely escaping the term
    const regex = new RegExp(
      `(${escapeRegExp(term)})`, // Capture the term itself
      caseSensitive ? 'g' : 'gi', // Global, case-insensitive optional
    );

    const parts = text.split(regex);

    return (
      <>
        {parts.map((part, index) =>
          // Check if the part matches the term (case-insensitively if needed)
          // Added length check to avoid partial matches causing issues with split regex
          regex.test(part) && part.length === term.length ? (
            <mark
              key={index}
              // Apply Tailwind classes directly
              // Using primary background/foreground for good contrast based on theme
              // Added slight padding and rounding for visual separation
              className="bg-primary/80 text-primary-foreground px-0.5 rounded-[0.2rem] font-medium"
            >
              {part}
            </mark>
          ) : (
            // Use React.Fragment for non-highlighted parts
            <React.Fragment key={index}>{part}</React.Fragment>
          ),
        )}
      </>
    );
  } catch (error) {
    console.error("Error creating RegExp for highlighting:", error);
    return <>{text}</>; // Fallback to original text on error
  }
};

export default HighlightMatches;
