import React, { useState, useMemo } from "react";
import { useTranslation } from "react-i18next"; // Import the hook
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import "./ResultsDisplay.css";

interface ResultsDisplayProps {
  results: string;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>;
  onSave: () => Promise<void>;
}

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

const LARGE_RESULT_LINE_THRESHOLD = 100000;

const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  summary,
  onCopy,
  onSave,
}) => {
  // Use the hook, specifying the 'results' namespace
  const { t } = useTranslation(['results']);

  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const lines = useMemo(() => results.split("\n"), [results]);
  const isResultLarge = useMemo(() => lines.length > LARGE_RESULT_LINE_THRESHOLD, [lines]);

  const handleCopy = async () => {
    setCopyStatus(t('copyButtonCopying')); // Translate status
    const { success, potentiallyTruncated } = await onCopy();

    let statusKey = success ? 'copyButtonSuccess' : 'copyButtonFailed';
    if (success && potentiallyTruncated) {
      statusKey = 'copyButtonTruncated';
    }
    setCopyStatus(t(statusKey)); // Translate final status

    setTimeout(() => setCopyStatus(""), 5000);
  };

  const handleSave = async () => {
    setSaveStatus(t('saveButtonSaving')); // Translate status
    try {
      await onSave();
      setSaveStatus(t('saveButtonInitiated')); // Translate status
      setTimeout(() => setSaveStatus(""), 5000);
    } catch (error) {
      console.error("Save process error:", error);
      setSaveStatus(t('saveButtonFailed')); // Translate status
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  return (
    <div className="results-display">
      {/* Translate heading */}
      <h3>{t('heading')}</h3>

      <div className="results-summary">
        {/* Translate summary labels with interpolation */}
        <span>{t('summaryFound', { count: summary.filesFound })}</span>
        <span>{t('summaryProcessed', { count: summary.filesProcessed })}</span>
        {summary.errorsEncountered > 0 && (
          <span className="summary-errors">
            {t('summaryReadErrors', { count: summary.errorsEncountered })}
          </span>
        )}
        <span>{t('summaryTotalLines', { count: lines.length })}</span>
      </div>

      {/* Translate clipboard warning */}
      {isResultLarge && (
         <p className="clipboard-warning">
            {t('clipboardWarning')}
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
        {/* Translate button text, using status if available */}
        <button onClick={handleCopy} disabled={!results || !!copyStatus}>
          {copyStatus || t('copyButton')}
        </button>
        <button onClick={handleSave} disabled={!results || !!saveStatus}>
          {saveStatus || t('saveButton')}
        </button>
      </div>
    </div>
  );
};

export default ResultsDisplay;