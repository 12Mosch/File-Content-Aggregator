import React, { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import "./ResultsDisplay.css";

interface ResultsDisplayProps {
  results: string;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number; // File read errors
  };
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>; // Modified return type
  onSave: () => Promise<void>;
}

// --- ADJUST THIS VALUE ---
// Estimate line height based on your font-size and line-height in CSS.
const LINE_HEIGHT = 22; // Adjust based on inspection

// Component to render each line in the virtualized list
const Row = ({
  index,
  style,
  data,
}: {
  index: number;
  style: React.CSSProperties;
  data: string[];
}) => (
  <div style={style} className="results-line">
    <pre className="results-line-content">
      {data[index] === "" ? "\u00A0" : data[index]}
    </pre>
  </div>
);

// Threshold for showing clipboard warning (adjust as needed)
const LARGE_RESULT_LINE_THRESHOLD = 100000; // e.g., 100k lines

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  summary,
  onCopy,
  onSave,
}) => {
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Memoize splitting the results string into lines only when 'results' changes
  const lines = useMemo(() => results.split("\n"), [results]);
  const isResultLarge = useMemo(() => lines.length > LARGE_RESULT_LINE_THRESHOLD, [lines]);

  const handleCopy = async () => {
    setCopyStatus("Copying...");
    const { success, potentiallyTruncated } = await onCopy(); // Get status object

    let statusMessage = success ? "Copied!" : "Copy Failed!";
    if (success && potentiallyTruncated) {
      statusMessage = "Copied! (May be truncated due to size)";
    }
    setCopyStatus(statusMessage);

    // Clear status after a few seconds
    setTimeout(() => setCopyStatus(""), 5000); // Longer timeout for warning
  };

  const handleSave = async () => {
    setSaveStatus("Saving...");
    try {
      await onSave();
      setSaveStatus("Save initiated...");
      setTimeout(() => setSaveStatus(""), 5000);
    } catch (error) {
      console.error("Save process error:", error);
      setSaveStatus("Save Failed/Cancelled!");
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  return (
    <div className="results-display">
      <h3>Search Results</h3>

      <div className="results-summary">
        <span>Files Found (Initial): {summary.filesFound}</span>
        <span>Files Processed: {summary.filesProcessed}</span>
        {summary.errorsEncountered > 0 && (
          <span className="summary-errors">
            File Read Errors: {summary.errorsEncountered}
          </span>
        )}
        <span>Total Lines: {lines.length}</span>
      </div>

      {/* Display warning for large results regarding clipboard */}
      {isResultLarge && (
         <p className="clipboard-warning">
            Note: Results are very large. Copying to clipboard may be truncated by system limits. Use "Save to File" for guaranteed full content.
         </p>
      )}

      <div className="results-virtualized-container">
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="results-list-scrollbar"
              height={height}
              itemCount={lines.length}
              itemSize={LINE_HEIGHT}
              width={width}
              itemData={lines}
              overscanCount={10}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
      </div>

      <div className="results-actions">
        <button onClick={handleCopy} disabled={!results || !!copyStatus}>
          {copyStatus || "Copy to Clipboard"}
        </button>
        <button onClick={handleSave} disabled={!results || !!saveStatus}>
          {saveStatus || "Save to File..."}
        </button>
      </div>
    </div>
  );
};

export default ResultsDisplay;
