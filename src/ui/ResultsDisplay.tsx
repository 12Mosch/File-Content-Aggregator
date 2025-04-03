import React, { useState, useMemo, useRef, useEffect, useCallback } from "react"; // Import useRef, useEffect, useCallback
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList } from "react-window"; // Import VariableSizeList
import AutoSizer from "react-virtualized-auto-sizer";
import "./ResultsDisplay.css";
import type { FileReadError } from "./vite-env.d"; // Import type if needed

// --- Constants ---
const TEXT_BLOCK_LINE_HEIGHT = 21; // Height for simple text lines in Text View
const TREE_ITEM_HEADER_HEIGHT = 30; // Estimated height of the file path header row in Tree View
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18; // Estimated height for content lines in Tree View (adjust based on CSS)
const TREE_ITEM_PADDING = 10; // Top/Bottom padding for expanded content area
const MAX_PREVIEW_LINES = 50; // Max lines to show in preview before "Show More"
const SHOW_MORE_BUTTON_HEIGHT = 35; // Estimated height of the "Show More" button
const LARGE_RESULT_LINE_THRESHOLD = 100000; // Threshold for clipboard warning (re-added)

// --- New State Structure Type (from App.tsx) ---
interface ItemDisplayState {
    expanded: boolean;
    showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;
// -----------------------------------------

// --- Prop Types ---
interface ResultsDisplayProps {
  results: string; // Full text output (for Text View, Copy, Save)
  structuredResults: Array<{ filePath: string; content: string | null; readError?: string }> | null; // Data for Tree View
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  viewMode: 'text' | 'tree'; // Current view mode
  itemDisplayStates: ItemDisplayStates; // Map tracking expanded/showFull state for tree items
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>; // Callback for copy button
  onSave: () => Promise<void>; // Callback for save button
  onToggleExpand: (filePath: string) => void; // Callback to toggle tree item expansion
  onShowFullContent: (filePath: string) => void; // Callback to show full content for a tree item
}

// --- Row Component for Text View ---
const TextRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: string[] }) => (
  <div style={style} className="results-line">
    <pre className="results-line-content">
      {data[index] === "" ? "\u00A0" : data[index]}
    </pre>
  </div>
);

// --- Row Component for Tree View ---
// Defines the data structure passed to each TreeRow instance
interface TreeRowData {
  items: Array<{ filePath: string; content: string | null; readError?: string }>;
  itemDisplayStates: ItemDisplayStates; // Map of display states
  toggleExpand: (filePath: string) => void; // Function to toggle expansion
  showFullContentHandler: (filePath: string) => void; // Function to show full content
  t: (key: string, options?: any) => string; // Translation function
}

const TreeRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: TreeRowData }) => {
  const { items, itemDisplayStates, toggleExpand, showFullContentHandler, t } = data;
  const item = items[index]; // Get the specific item data for this row
  const displayState = itemDisplayStates.get(item.filePath); // Get display state from map
  const isExpanded = displayState?.expanded ?? false; // Default to collapsed
  const showFull = displayState?.showFull ?? false; // Default to not showing full content

  // Memoize calculation of content lines and preview
  const { contentLines, totalContentLines, isContentLarge, contentPreview } = useMemo(() => {
      const lines = item.content?.split('\n') ?? [];
      const totalLines = lines.length;
      const large = item.content ? totalLines > MAX_PREVIEW_LINES : false;
      const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content;
      return { contentLines: lines, totalContentLines: totalLines, isContentLarge: large, contentPreview: preview };
  }, [item.content, showFull]); // Dependencies: recalculate if content or showFull changes

  // Determine if the "Show More" button should be visible
  const showShowMoreButton = isExpanded && isContentLarge && !showFull;

  // Handlers specific to this row
  const handleToggle = () => toggleExpand(item.filePath);
  const handleShowMore = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent the header click/toggle when clicking the button
      showFullContentHandler(item.filePath); // Trigger showing full content
  };

  return (
    // Apply style from react-window for positioning and size
    <div style={style} className="tree-item">
      {/* Clickable header to toggle expansion */}
      <div className="tree-item-header" onClick={handleToggle} title={item.filePath}>
        <span className="tree-item-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="tree-item-path">{item.filePath}</span>
      </div>
      {/* Conditional rendering of content area when expanded */}
      {isExpanded && (
        <div className="tree-item-content">
          {item.readError ? (
            // Display translated read error if present
            <span className="tree-item-error">
              {t(`errors:${item.readError}`, { defaultValue: item.readError })}
            </span>
          ) : item.content !== null ? ( // Check if content exists (could be empty string)
            <>
              {/* Display preview or full content */}
              <pre>{contentPreview}</pre>
              {/* Display "Show More" button if needed */}
              {showShowMoreButton && (
                <button onClick={handleShowMore} className="show-more-button">
                  {t('results:showMore', { remaining: totalContentLines - MAX_PREVIEW_LINES })}
                </button>
              )}
            </>
          ) : (
            // Placeholder if content is null and no error (should be rare)
            <span className="tree-item-error">{/* No content available */}</span>
          )}
        </div>
      )}
    </div>
  );
};


// --- Main ResultsDisplay Component ---
const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  structuredResults,
  summary,
  viewMode,
  itemDisplayStates, // Use the map of item states
  onCopy,
  onSave,
  onToggleExpand,
  onShowFullContent, // Use the handler for showing full content
}) => {
  const { t } = useTranslation(['results', 'errors']);

  // State for button feedback
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  // Refs for the virtualized list components
  const textListRef = useRef<List>(null);
  const treeListRef = useRef<VariableSizeList>(null); // Ref for VariableSizeList

  // Memoize splitting the results string for text view line count
  const textLines = useMemo(() => results.split('\n'), [results]);
  // Memoize check if results are large (for clipboard warning)
  const isResultLarge = useMemo(() => textLines.length > LARGE_RESULT_LINE_THRESHOLD, [textLines]); // Use constant here

  // --- Effect to reset Tree List cache when item states change ---
  // This is crucial for VariableSizeList when item heights change dynamically
  useEffect(() => {
    if (viewMode === 'tree' && treeListRef.current) {
      // Reset cached sizes when the display states change (expand/collapse/showMore)
      // 'false' for shouldForceUpdate might provide a smoother visual update
      treeListRef.current.resetAfterIndex(0, false);
    }
    // Also reset if switching TO tree view (viewMode changes)
  }, [itemDisplayStates, viewMode]); // Dependencies: item states map and view mode

  // --- Calculate Tree Item Size for VariableSizeList ---
  // Use useCallback to memoize the function itself, preventing unnecessary recalculations if props haven't changed
  const getTreeItemSize = useCallback((index: number): number => {
    if (!structuredResults) return TREE_ITEM_HEADER_HEIGHT; // Default height if no data

    const item = structuredResults[index];
    const displayState = itemDisplayStates.get(item.filePath);
    const isExpanded = displayState?.expanded ?? false;
    const showFull = displayState?.showFull ?? false;

    if (!isExpanded) {
      return TREE_ITEM_HEADER_HEIGHT; // Height of collapsed item (header only)
    } else {
      // Calculate expanded height
      let contentLineCount = 0;
      if (item.readError) {
        contentLineCount = 2; // Estimate ~2 lines for error message display
      } else if (item.content) {
        const lines = item.content.split('\n').length;
        // Use preview line count if applicable and full content isn't shown
        if (lines > MAX_PREVIEW_LINES && !showFull) {
            contentLineCount = MAX_PREVIEW_LINES;
        } else {
            contentLineCount = lines; // Use actual line count for full content
        }
      } else {
        contentLineCount = 1; // Minimum 1 line height if expanded but no content/error
      }

      // Check if the "Show More" button will be visible for this item
      const showShowMoreButton = (item.content && item.content.split('\n').length > MAX_PREVIEW_LINES && !showFull);
      const showMoreButtonHeight = showShowMoreButton ? SHOW_MORE_BUTTON_HEIGHT : 0;

      // Calculate total height: Header + (Lines * Line Height) + Button Height + Padding
      const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT;
      return TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING;
    }
  }, [structuredResults, itemDisplayStates]); // Dependencies for the size calculation function

  // --- Event Handlers for Copy/Save --- (Operate on the full 'results' text)
  const handleCopy = async () => {
    setCopyStatus(t('copyButtonCopying'));
    const { success, potentiallyTruncated } = await onCopy();
    let statusKey = success ? 'copyButtonSuccess' : 'copyButtonFailed';
    if (success && potentiallyTruncated) statusKey = 'copyButtonTruncated';
    setCopyStatus(t(statusKey));
    setTimeout(() => setCopyStatus(""), 5000);
  };

  const handleSave = async () => {
    setSaveStatus(t('saveButtonSaving'));
    try {
      await onSave();
      setSaveStatus(t('saveButtonInitiated'));
      setTimeout(() => setSaveStatus(""), 5000);
    } catch (error) {
      setSaveStatus(t('saveButtonFailed'));
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  // --- Prepare itemData for the Tree List ---
  // Memoize this object to prevent unnecessary re-renders of TreeRow
  const treeItemData: TreeRowData | null = useMemo(() => {
      if (!structuredResults) return null;
      // Pass all necessary data and callbacks down to TreeRow
      return {
          items: structuredResults,
          itemDisplayStates: itemDisplayStates,
          toggleExpand: onToggleExpand,
          showFullContentHandler: onShowFullContent,
          t: t // Pass translation function
      };
  }, [structuredResults, itemDisplayStates, onToggleExpand, onShowFullContent, t]);


  // --- Render Logic ---
  return (
    <div className="results-display">
      <h3>{t('heading')}</h3>
      {/* Summary Section */}
      <div className="results-summary">
        <span>{t('summaryFound', { count: summary.filesFound })}</span>
        <span>{t('summaryProcessed', { count: summary.filesProcessed })}</span>
        {summary.errorsEncountered > 0 && (
          <span className="summary-errors">
            {t('summaryReadErrors', { count: summary.errorsEncountered })}
          </span>
        )}
        {/* Show different summary label based on view mode */}
        <span>
            {viewMode === 'text'
                ? t('summaryTotalLines', { count: textLines.length })
                : t('results:summaryTotalFiles', { count: structuredResults?.length ?? 0 })
            }
        </span>
      </div>
      {/* Clipboard Warning (only for text view) */}
      {isResultLarge && viewMode === 'text' && (
         <p className="clipboard-warning">{t('clipboardWarning')}</p>
      )}

      {/* Virtualized List Container */}
      <div className="results-virtualized-container">
        <AutoSizer>
          {({ height, width }) => (
            viewMode === 'text' ? (
              // Render Text Block View using FixedSizeList
              <List
                ref={textListRef}
                className="results-list-scrollbar"
                height={height}
                itemCount={textLines.length}
                itemSize={TEXT_BLOCK_LINE_HEIGHT}
                width={width}
                itemData={textLines}
                overscanCount={10}
              >
                {TextRow}
              </List>
            ) : treeItemData ? (
              // Render Tree View using VariableSizeList
              <VariableSizeList
                ref={treeListRef} // Assign ref
                className="results-list-scrollbar"
                height={height}
                itemCount={structuredResults?.length ?? 0}
                itemSize={getTreeItemSize} // Use function to get item size
                width={width}
                itemData={treeItemData} // Pass combined data object
                overscanCount={5} // Lower overscan might be ok for variable size
                // Provide an estimated size for initial render optimization
                estimatedItemSize={TREE_ITEM_HEADER_HEIGHT + (TREE_ITEM_CONTENT_LINE_HEIGHT * 5)}
              >
                {TreeRow}
              </VariableSizeList>
            ) : null // Render nothing if structuredResults aren't ready for tree view
          )}
        </AutoSizer>
      </div>

      {/* Action Buttons */}
      <div className="results-actions">
        {/* Copy/Save always operate on the full text block 'results' */}
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
