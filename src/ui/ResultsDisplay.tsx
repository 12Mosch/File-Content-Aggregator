// D:/Code/Electron/src/ui/ResultsDisplay.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches";
import "./ResultsDisplay.css";
import "./Highlight.css"; // Import highlight styles
import type { StructuredItem } from "./vite-env.d";

// --- REMOVE highlight.js imports from here ---
// import hljs from 'highlight.js/lib/core';
// ... language imports ...
// hljs.registerLanguage(...) calls removed

// --- Constants ---
const TEXT_BLOCK_LINE_HEIGHT = 21;
const TREE_ITEM_HEADER_HEIGHT = 30;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18; // Base height for calculation
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

// --- Type for Highlight Cache ---
type HighlightStatus = 'idle' | 'pending' | 'done' | 'error';
interface HighlightCacheEntry {
    status: HighlightStatus;
    html?: string; // Store highlighted HTML if status is 'done'
    error?: string; // Store error message if status is 'error'
}
type HighlightCache = Map<string, HighlightCacheEntry>;

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
  filterTerm: string;
  filterCaseSensitive: boolean;
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
  filterTerm: string;
  filterCaseSensitive: boolean;
  // --- NEW: Props for highlighting ---
  highlightCache: HighlightCache;
  requestHighlighting: (filePath: string, code: string, language: string) => void;
  // ---------------------------------
}

// Helper function to get language identifier from file path (remains the same)
const getLanguageFromPath = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || 'plaintext';
    // Map extensions to highlight.js language identifiers
    // (This list should ideally match the languages registered in the worker)
    switch (extension) {
        case 'js': case 'jsx': return 'javascript';
        case 'ts': case 'tsx': return 'typescript';
        case 'json': return 'json';
        case 'css': case 'scss': case 'less': return 'css';
        case 'html': case 'htm': return 'html';
        case 'xml': case 'xaml': case 'csproj': case 'props': return 'xml';
        case 'py': return 'python';
        case 'java': return 'java';
        case 'cs': return 'csharp';
        case 'log': return 'log';
        case 'txt': case 'md': return 'plaintext';
        default:
            // Use a simplified check or rely on worker's default
            const knownLangs = ['javascript', 'typescript', 'json', 'css', 'xml', 'python', 'java', 'csharp', 'plaintext'];
            return knownLangs.includes(extension) ? extension : 'plaintext';
    }
};


const TreeRow = ({ index, style, data }: { index: number; style: React.CSSProperties; data: TreeRowData }) => {
  const {
      items,
      itemDisplayStates,
      toggleExpand,
      showFullContentHandler,
      t,
      filterTerm,
      filterCaseSensitive,
      // --- NEW: Destructure highlighting props ---
      highlightCache,
      requestHighlighting,
      // -----------------------------------------
  } = data;
  const item = items[index];
  const displayState = itemDisplayStates.get(item.filePath);
  const isExpanded = displayState?.expanded ?? false;
  const showFull = displayState?.showFull ?? false;

  // --- REMOVE codeRef and highlight.js useEffect ---
  // const codeRef = useRef<HTMLElement>(null);

  // Determine the language for highlighting
  const language = useMemo(() => getLanguageFromPath(item.filePath), [item.filePath]);

  // Memoize content preview calculation
  const { contentPreview, totalContentLines, isContentLarge } = useMemo(() => {
      const lines = item.content?.split('\n') ?? [];
      const totalLines = lines.length;
      const large = item.content ? totalLines > MAX_PREVIEW_LINES : false;
      // Use item.content directly if showFull is true
      const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content;
      return { contentPreview: preview, totalContentLines: totalLines, isContentLarge: large };
  }, [item.content, showFull]);

  // --- NEW: Effect to request highlighting when expanded ---
  useEffect(() => {
    // Request highlighting if:
    // - Item is expanded
    // - Content exists
    // - Language is not plaintext (no need to highlight)
    // - Highlighting is not already pending or done for this item
    const cacheEntry = highlightCache.get(item.filePath);
    if (isExpanded && contentPreview && language !== 'plaintext' && (!cacheEntry || cacheEntry.status === 'idle')) {
      requestHighlighting(item.filePath, contentPreview, language);
    }
    // Dependencies: expansion state, the content to highlight, language, and the request function reference
  }, [isExpanded, contentPreview, language, item.filePath, requestHighlighting, highlightCache]);
  // -------------------------------------------------------

  const showShowMoreButton = isExpanded && isContentLarge && !showFull;

  const handleToggle = () => toggleExpand(item.filePath);
  const handleShowMore = (e: React.MouseEvent) => {
      e.stopPropagation();
      showFullContentHandler(item.filePath);
  };

  // --- NEW: Get highlight status and content from cache ---
  const highlightInfo = highlightCache.get(item.filePath) ?? { status: 'idle' };
  // ------------------------------------------------------

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
          ) : item.content !== null ? ( // Check content exists
            <>
              {/* --- NEW: Conditional rendering based on highlight status --- */}
              {language === 'plaintext' ? (
                // Render plaintext directly without highlighting
                <pre><code>{contentPreview}</code></pre>
              ) : highlightInfo.status === 'pending' ? (
                // Show loading indicator while highlighting
                <pre><code className="hljs">{t('results:highlighting')}</code></pre>
              ) : highlightInfo.status === 'error' ? (
                // Show error and fallback to plain text
                <>
                  <span className="tree-item-error">{t('results:highlightError')}: {highlightInfo.error}</span>
                  <pre><code>{contentPreview}</code></pre>
                </>
              ) : highlightInfo.status === 'done' && highlightInfo.html ? (
                // Render the HTML received from the worker
                // Use dangerouslySetInnerHTML for the highlighted content
                <pre>
                    <code
                        className={`language-${language} hljs`} // Add hljs class for potential theme styling
                        dangerouslySetInnerHTML={{ __html: highlightInfo.html }}
                    />
                </pre>
              ) : (
                // Fallback: Render plain text if status is idle or unexpected
                <pre><code>{contentPreview}</code></pre>
              )}
              {/* ---------------------------------------------------------- */}

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
  filterTerm,
  filterCaseSensitive,
}) => {
  const { t } = useTranslation(['results', 'errors']);

  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const textListRef = useRef<List>(null);
  const treeListRef = useRef<VariableSizeList>(null);

  // --- NEW: Worker and Highlight Cache Management ---
  const workerRef = useRef<Worker | null>(null);
  const highlightCacheRef = useRef<HighlightCache>(new Map());
  // State to trigger re-renders when cache updates
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);

  // Effect to initialize and terminate the worker
  useEffect(() => {
    // Create the worker instance using the special URL constructor
    // Vite handles bundling the worker correctly with this syntax
    workerRef.current = new Worker(new URL('./highlight.worker.ts', import.meta.url), {
        type: 'module' // Important for Vite workers using ES modules
    });

    // Handler for messages received FROM the worker
    const handleWorkerMessage = (event: MessageEvent) => {
      const { filePath, status, highlightedHtml, error } = event.data;
      if (filePath) {
        highlightCacheRef.current.set(filePath, { status, html: highlightedHtml, error });
        // Force a re-render by updating state
        setHighlightUpdateCounter(prev => prev + 1);
      }
    };

    // Handler for errors originating FROM the worker itself
    const handleWorkerError = (event: ErrorEvent) => {
        console.error("[Highlight Worker Error]", event.message, event);
        // Optionally, update UI to show a general worker error
    };

    workerRef.current.addEventListener('message', handleWorkerMessage);
    workerRef.current.addEventListener('error', handleWorkerError);

    // Cleanup function: terminate worker when component unmounts
    return () => {
      if (workerRef.current) {
        console.log("[Highlight Worker] Terminating.");
        workerRef.current.removeEventListener('message', handleWorkerMessage);
        workerRef.current.removeEventListener('error', handleWorkerError);
        workerRef.current.terminate();
        workerRef.current = null;
        highlightCacheRef.current.clear(); // Clear cache on unmount/results clear
      }
    };
  }, []); // Run only once on mount

  // Function to request highlighting from the worker
  const requestHighlighting = useCallback((filePath: string, code: string, language: string) => {
    if (workerRef.current) {
      // Mark as pending in the cache immediately
      highlightCacheRef.current.set(filePath, { status: 'pending' });
      // Force UI update to show "pending" state
      setHighlightUpdateCounter(prev => prev + 1);
      // Send message to worker
      workerRef.current.postMessage({ filePath, code, language });
    } else {
        console.warn("Highlight worker not available to process request for:", filePath);
    }
  }, []); // Worker ref doesn't change, so no dependencies needed

  // Effect to clear cache when results change (new search)
  useEffect(() => {
      highlightCacheRef.current.clear();
      setHighlightUpdateCounter(0); // Reset counter
  }, [results]); // Dependency on the raw results string

  // ---------------------------------------------

  const isOriginalResultLarge = useMemo(() => results.split('\n').length > LARGE_RESULT_LINE_THRESHOLD, [results]);

  useEffect(() => {
    if (viewMode === 'tree' && treeListRef.current) {
      // Reset cache when filter/items change, or view mode switches to tree
      treeListRef.current.resetAfterIndex(0, false);
    }
  }, [itemDisplayStates, viewMode, filteredStructuredItems, filterTerm, highlightUpdateCounter]); // Add counter as dependency

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
        contentLineCount = 2; // Approximate height for error message
      } else if (item.content) {
        const lines = item.content.split('\n').length;
        if (lines > MAX_PREVIEW_LINES && !showFull) {
            contentLineCount = MAX_PREVIEW_LINES;
        } else {
            contentLineCount = lines;
        }
      } else {
        contentLineCount = 1; // For "no content" message
      }

      // Add extra lines for highlighting status/error messages if needed
      const highlightInfo = highlightCacheRef.current.get(item.filePath);
      if (highlightInfo?.status === 'pending' || highlightInfo?.status === 'error') {
          contentLineCount += 1; // Add space for the status message
      }

      const showShowMoreButton = (item.content && item.content.split('\n').length > MAX_PREVIEW_LINES && !showFull);
      const showMoreButtonHeight = showShowMoreButton ? SHOW_MORE_BUTTON_HEIGHT : 0;

      // Calculate height based on lines, padding, and button
      const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT;
      return TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING;
    }
    // Depend on itemDisplayStates and the update counter to recalculate when highlight status changes
  }, [filteredStructuredItems, itemDisplayStates, highlightUpdateCounter]);

  const handleCopy = async () => {
    setCopyStatus(t('copyButtonCopying'));
    const { success, potentiallyTruncated } = await onCopy();
    let statusKey = success ? 'copyButtonSuccess' : 'copyButtonFailed';
    if (success && isOriginalResultLarge) {
        statusKey = 'copyButtonTruncated';
    }
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

  const textItemData: TextRowData = useMemo(() => ({
      lines: filteredTextLines,
      filterTerm,
      filterCaseSensitive,
  }), [filteredTextLines, filterTerm, filterCaseSensitive]);

  // --- Pass highlight cache and request function to TreeRowData ---
  const treeItemData: TreeRowData | null = useMemo(() => {
      if (!filteredStructuredItems) return null;
      return {
          items: filteredStructuredItems,
          itemDisplayStates: itemDisplayStates,
          toggleExpand: onToggleExpand,
          showFullContentHandler: onShowFullContent,
          t: t,
          filterTerm,
          filterCaseSensitive,
          highlightCache: highlightCacheRef.current, // Pass the current cache map
          requestHighlighting: requestHighlighting, // Pass the request function
      };
  // Depend on the update counter to ensure TreeRow gets the latest cache reference
  }, [filteredStructuredItems, itemDisplayStates, onToggleExpand, onShowFullContent, t, filterTerm, filterCaseSensitive, requestHighlighting, highlightUpdateCounter]);
  // -----------------------------------------------------------------


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
      {isOriginalResultLarge && (
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
                itemData={textItemData}
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
                itemSize={getTreeItemSize} // Recalculated based on highlight status
                width={width}
                itemData={treeItemData} // Contains updated cache reference
                overscanCount={5}
                estimatedItemSize={TREE_ITEM_HEADER_HEIGHT + (TREE_ITEM_CONTENT_LINE_HEIGHT * 5)}
                // Add highlightUpdateCounter to itemKey or as extra data if needed
                // to force re-render of rows when cache updates globally
                itemKey={(index, data) => data.items[index].filePath + highlightUpdateCounter}
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
