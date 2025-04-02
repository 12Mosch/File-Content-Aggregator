import React, { useState } from "react";
import "./ResultsDisplay.css";

interface ResultsDisplayProps {
  results: string;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number; // File read errors
  };
  // pathErrors: string[]; // <-- Receive path errors as prop
  onCopy: () => Promise<boolean>;
  onSave: () => Promise<void>;
}

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  summary,
  // pathErrors, // <-- Destructure prop
  onCopy,
  onSave,
}) => {
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const handleCopy = async () => {
    setCopyStatus("Copying...");
    const success = await onCopy();
    setCopyStatus(success ? "Copied!" : "Copy Failed!");
    setTimeout(() => setCopyStatus(""), 3000);
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

      {/* Optional: Display path errors here instead of App.tsx */}
      {/* {pathErrors.length > 0 && (
        <div className="path-errors-container error-message">
          <h4>Path Errors Encountered:</h4>
          <ul>
            {pathErrors.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )} */}


      <div className="results-summary">
        <span>Files Found (Initial): {summary.filesFound}</span>
        <span>Files Processed: {summary.filesProcessed}</span>
        {summary.errorsEncountered > 0 && (
          <span className="summary-errors">
            File Read Errors: {summary.errorsEncountered}
          </span>
        )}
      </div>
      <textarea
        className="results-textarea"
        value={results}
        readOnly
        rows={15}
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
