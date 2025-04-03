// D:/Code/Electron/src/ui/HighlightMatches.tsx
import React from 'react';

interface HighlightMatchesProps {
  text: string | null | undefined;
  term: string;
  caseSensitive: boolean;
  highlightClassName?: string; // Optional class name for styling
}

// Helper function to escape special characters for RegExp
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

const HighlightMatches: React.FC<HighlightMatchesProps> = ({
  text,
  term,
  caseSensitive,
  highlightClassName = 'highlight', // Default class name
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
          regex.test(part) && part.length === term.length ? ( // Check length to avoid partial matches causing issues
            <mark key={index} className={highlightClassName}>
              {part}
            </mark>
          ) : (
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
