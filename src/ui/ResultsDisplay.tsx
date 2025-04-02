import React, { useState } from "react";
import "./ResultsDisplay.css"; // We'll create this CSS file next

interface ResultsDisplayProps {
  results: string;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  onCopy: () => Promise<boolean>;
  onSave: () => Promise<void>; // Changed to void as success/failure handled internally
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  summary,
  onCopy,
  onSave,
}) => {
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const handleCopy = async () => {
    setCopyStatus("Copying...");
    const success = await onCopy();
    setCopyStatus(success ? "Copied!" : "Copy Failed!");
    // Clear status after a few seconds
    setTimeout(() => setCopyStatus(""), 3000);
  };

  const handleSave = async () => {
    setSaveStatus("Saving...");
    try {
        await onSave(); // onSave now handles showing dialog and writing
        setSaveStatus("Save initiated..."); // Dialog shown, actual save happens async
        // Consider a more robust status update if needed (e.g., via IPC event)
        setTimeout(() => setSaveStatus(""), 5000); // Clear status after a while
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
            Errors Reading: {summary.errorsEncountered}
          </span>
        )}
      </div>
      <textarea
        className="results-textarea"
        value={results}
        readOnly
        rows={15} // Adjust as needed
        aria-label="Search results content"
      />
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
