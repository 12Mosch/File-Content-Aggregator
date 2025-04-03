// D:/Code/Electron/src/ui/ResultsDisplay.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches"; // Import the highlighting component
import "./ResultsDisplay.css";
import "./Highlight.css"; // Import the new highlight CSS file
import type { StructuredItem } from "./vite-env.d";

// --- Constants ---
const TEXT_BLOCK_LINE_HEIGHT = 21;
const TREE_ITEM_HEADER_HEIGHT = 30;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18;
const TREE_ITEM_PADDING = 10;
const MAX_PREVIEW_LINES = 50;
const SHOW_MORE_BUTTON_HEIGHT = 35;
const LARGE_RESULT_LINE_THRESHOLD = 100000;

// --- Item Display State Type ---
interface ItemDisplayState {
    expanded: boolean;
    showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;

// --- Prop Types ---
interface ResultsDisplayProps {
  results: string;
  filteredTextLines: string[];
  filteredStructuredItems: StructuredItem[] | null;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  viewMode: 'text' | 'tree';
  itemDisplayStates: ItemDisplayStates;
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>;
  onSave: () => Promise<void>;
  onToggleExpand: (filePath: string) => void;
  onShowFullContent: (filePath: string) => void;
  isFilterActive: boolean;
  filterTerm: string; // Receive debounced filter term
  filterCaseSensitive: boolean; // Receive case sensitivity setting
}

// --- Row Component for Text View ---
interface TextRowData {
    lines: string[];
    filterTerm: string;
    filterCaseSensitive: boolean;
}
const TextRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: TextRowData }) => {
    const { lines, filterTerm, filterCaseSensitive } = data;
    const lineContent = lines[index];
    return (
        <div style={style} className="results-line">
            <pre className="results-line-content">
                {lineContent === "" ? (
                    "\u00A0"
                ) : (
                    // Use HighlightMatches component
                    <HighlightMatches
                        text={lineContent}
                        term={filterTerm}
                        caseSensitive={filterCaseSensitive}
                    />
                )}
            </pre>
        </div>
    );
};


// --- Row Component for Tree View ---
interface TreeRowData {
  items: StructuredItem[];
  itemDisplayStates: ItemDisplayStates;
  toggleExpand: (filePath: string) => void;
  showFullContentHandler: (filePath: string) => void;
  t: (key: string, options?: any) => string;
  filterTerm: string; // Pass down for highlighting
  filterCaseSensitive: boolean; // Pass down for highlighting
}

const TreeRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: TreeRowData }) => {
  const {
      items,
      itemDisplayStates,
      toggleExpand,
      showFullContentHandler,
      t,
      filterTerm, // Get filter props
      filterCaseSensitive, // Get filter props
  } = data;
  const item = items[index];
  const displayState = itemDisplayStates.get(item.filePath);
  const isExpanded = displayState?.expanded ?? false;
  const showFull = displayState?.showFull ?? false;

  const { contentLines, totalContentLines, isContentLarge, contentPreview } = useMemo(() => {
      const lines = item.content?.split('\n') ?? [];
      const totalLines = lines.length;
      const large = item.content ? totalLines > MAX_PREVIEW_LINES : false;
      const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content;
      return { contentLines: lines, totalContentLines: totalLines, isContentLarge: large, contentPreview: preview };
  }, [item.content, showFull]);

  const showShowMoreButton = isExpanded && isContentLarge && !showFull;

  const handleToggle = () => toggleExpand(item.filePath);
  const handleShowMore = (e: React.MouseEvent) => {
      e.stopPropagation();
      showFullContentHandler(item.filePath);
  };

  return (
    <div style={style} className="tree-item">
      {/* Highlight file path */}
      <div className="tree-item-header" onClick={handleToggle} title={item.filePath}>
        <span className="tree-item-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="tree-item-path">
            <HighlightMatches
                text={item.filePath}
                term={filterTerm}
                caseSensitive={filterCaseSensitive}
            />
        </span>
      </div>
      {isExpanded && (
        <div className="tree-item-content">
          {item.readError ? (
            <span className="tree-item-error">
              {t(`errors:${item.readError}`, { defaultValue: item.readError })}
            </span>
          ) : item.content !== null ? (
            <>
              {/* Highlight content preview */}
              <pre>
                <HighlightMatches
                    text={contentPreview}
                    term={filterTerm}
                    caseSensitive={filterCaseSensitive}
                />
              </pre>
              {showShowMoreButton && (
                <button onClick={handleShowMore} className="show-more-button">
                  {t('results:showMore', { remaining: totalContentLines - MAX_PREVIEW_LINES })}
                </button>
              )}
            </>
          ) : (
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
  filteredTextLines,
  filteredStructuredItems,
  summary,
  viewMode,
  itemDisplayStates,
  onCopy,
  onSave,
  onToggleExpand,
  onShowFullContent,
  isFilterActive,
  filterTerm, // Use received filter term
  filterCaseSensitive, // Use received case sensitivity
}) => {
  const { t } = useTranslation(['results', 'errors']);

  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const textListRef = useRef<List>(null);
  const treeListRef = useRef<VariableSizeList>(null);

  // Check original result size for large warning
  const isOriginalResultLarge = useMemo(() => results.split('\n').length > LARGE_RESULT_LINE_THRESHOLD, [results]);

  useEffect(() => {
    if (viewMode === 'tree' && treeListRef.current) {
      treeListRef.current.resetAfterIndex(0, false);
    }
    // Reset text list scroll on filter change? Optional.
    // if (viewMode === 'text' && textListRef.current) {
    //   textListRef.current.scrollToItem(0);
    // }
  }, [itemDisplayStates, viewMode, filteredStructuredItems, filterTerm]); // Add filterTerm dependency

  const getTreeItemSize = useCallback((index: number): number => {
    if (!filteredStructuredItems) return TREE_ITEM_HEADER_HEIGHT;

    const item = filteredStructuredItems[index];
    const displayState = itemDisplayStates.get(item.filePath);
    const isExpanded = displayState?.expanded ?? false;
    const showFull = displayState?.showFull ?? false;

    if (!isExpanded) {
      return TREE_ITEM_HEADER_HEIGHT;
    } else {
      let contentLineCount = 0;
      if (item.readError) {
        contentLineCount = 2;
      } else if (item.content) {
        const lines = item.content.split('\n').length;
        if (lines > MAX_PREVIEW_LINES && !showFull) {
            contentLineCount = MAX_PREVIEW_LINES;
        } else {
            contentLineCount = lines;
        }
      } else {
        contentLineCount = 1;
      }

      const showShowMoreButton = (item.content && item.content.split('\n').length > MAX_PREVIEW_LINES && !showFull);
      const showMoreButtonHeight = showShowMoreButton ? SHOW_MORE_BUTTON_HEIGHT : 0;

      const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT;
      return TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING;
    }
  }, [filteredStructuredItems, itemDisplayStates]);

  const handleCopy = async () => {
    setCopyStatus(t('copyButtonCopying'));
    const { success, potentiallyTruncated } = await onCopy(); // Uses original results via callback
    let statusKey = success ? 'copyButtonSuccess' : 'copyButtonFailed';
    if (success && isOriginalResultLarge) { // Check original size
        statusKey = 'copyButtonTruncated';
    }
    setCopyStatus(t(statusKey));
    setTimeout(() => setCopyStatus(""), 5000);
  };

  const handleSave = async () => {
    setSaveStatus(t('saveButtonSaving'));
    try {
      await onSave(); // Uses original results via callback
      setSaveStatus(t('saveButtonInitiated'));
      setTimeout(() => setSaveStatus(""), 5000);
    } catch (error) {
      setSaveStatus(t('saveButtonFailed'));
      setTimeout(() => setSaveStatus(""), 3000);
    }
  };

  // Prepare itemData for the Text List
  const textItemData: TextRowData = useMemo(() => ({
      lines: filteredTextLines,
      filterTerm,
      filterCaseSensitive,
  }), [filteredTextLines, filterTerm, filterCaseSensitive]);

  // Prepare itemData for the Tree List
  const treeItemData: TreeRowData | null = useMemo(() => {
      if (!filteredStructuredItems) return null;
      return {
          items: filteredStructuredItems,
          itemDisplayStates: itemDisplayStates,
          toggleExpand: onToggleExpand,
          showFullContentHandler: onShowFullContent,
          t: t,
          filterTerm, // Pass filter props
          filterCaseSensitive, // Pass filter props
      };
  }, [filteredStructuredItems, itemDisplayStates, onToggleExpand, onShowFullContent, t, filterTerm, filterCaseSensitive]);


  const getSummaryLabelKey = () => {
      if (viewMode === 'text') {
          return isFilterActive ? 'summaryTotalLinesFiltered' : 'summaryTotalLines';
      } else {
          return isFilterActive ? 'summaryTotalFilesFiltered' : 'summaryTotalFiles';
      }
  };
  const summaryCount = viewMode === 'text' ? filteredTextLines.length : (filteredStructuredItems?.length ?? 0);

  return (
    <div className="results-display">
      <h3>{t('heading')}</h3>
      <div className="results-summary">
        <span>{t('summaryFound', { count: summary.filesFound })}</span>
        <span>{t('summaryProcessed', { count: summary.filesProcessed })}</span>
        {summary.errorsEncountered > 0 && (
          <span className="summary-errors">
            {t('summaryReadErrors', { count: summary.errorsEncountered })}
          </span>
        )}
        <span>{t(getSummaryLabelKey(), { count: summaryCount })}</span>
      </div>
      {isOriginalResultLarge && ( // Show warning based on original size
         <p className="clipboard-warning">{t('clipboardWarning')}</p>
      )}

      <div className="results-virtualized-container">
        <AutoSizer>
          {({ height, width }) => (
            viewMode === 'text' ? (
              <List
                ref={textListRef}
                className="results-list-scrollbar"
                height={height}
                itemCount={filteredTextLines.length}
                itemSize={TEXT_BLOCK_LINE_HEIGHT}
                width={width}
                itemData={textItemData} // Pass combined data object
                overscanCount={10}
              >
                {TextRow}
              </List>
            ) : treeItemData ? (
              <VariableSizeList
                ref={treeListRef}
                className="results-list-scrollbar"
                height={height}
                itemCount={filteredStructuredItems?.length ?? 0}
                itemSize={getTreeItemSize}
                width={width}
                itemData={treeItemData} // Pass combined data object
                overscanCount={5}
                estimatedItemSize={TREE_ITEM_HEADER_HEIGHT + (TREE_ITEM_CONTENT_LINE_HEIGHT * 5)}
              >
                {TreeRow}
              </VariableSizeList>
            ) : null
          )}
        </AutoSizer>
      </div>

      <div className="results-actions">
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
