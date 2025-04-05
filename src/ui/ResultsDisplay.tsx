// D:/Code/Electron/src/ui/ResultsDisplay.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches";
import "./ResultsDisplay.css";
import "./Highlight.css";
import type { StructuredItem } from "./vite-env.d";

// Constants
const TEXT_BLOCK_LINE_HEIGHT = 21;
const TREE_ITEM_HEADER_HEIGHT = 30;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18;
const TREE_ITEM_PADDING = 10;
const MAX_PREVIEW_LINES = 50;
const SHOW_MORE_BUTTON_HEIGHT = 35;
const LARGE_RESULT_LINE_THRESHOLD = 100000;

// Types
interface ItemDisplayState { expanded: boolean; showFull: boolean; }
type ItemDisplayStates = Map<string, ItemDisplayState>;
type HighlightStatus = 'idle' | 'pending' | 'done' | 'error';
interface HighlightCacheEntry { status: HighlightStatus; html?: string; error?: string; }
type HighlightCache = Map<string, HighlightCacheEntry>;

interface ResultsDisplayProps {
  results: string;
  filteredTextLines: string[];
  filteredStructuredItems: StructuredItem[] | null;
  summary: { filesFound: number; filesProcessed: number; errorsEncountered: number; };
  viewMode: 'text' | 'tree';
  itemDisplayStates: ItemDisplayStates;
  itemDisplayVersion: number; // Receive the version counter
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
const TextRow: React.FC<ListChildComponentProps<TextRowData>> = ({ index, style, data }) => {
    const { lines, filterTerm, filterCaseSensitive } = data;
    const lineContent = lines?.[index] ?? '';

    return (
        <div style={style} className="results-line">
            <pre className="results-line-content">
                {lineContent === "" ? ( "\u00A0" ) : (
                    <HighlightMatches text={lineContent} term={filterTerm} caseSensitive={filterCaseSensitive} />
                )}
            </pre>
        </div>
    );
};


// --- Row Component for Tree View ---
// Revert TreeRowData to represent the shared context object
interface TreeRowData {
  items: StructuredItem[]; // The full array of items
  itemDisplayStates: ItemDisplayStates; // The full map of states
  toggleExpand: (filePath: string) => void;
  showFullContentHandler: (filePath: string) => void;
  t: (key: string, options?: any) => string;
  filterTerm: string;
  filterCaseSensitive: boolean;
  highlightCache: HighlightCache;
  requestHighlighting: (filePath: string, code: string, language: string) => void;
  // displayStateVersion is not needed inside itemData if itemKey handles it
}

const getLanguageFromPath = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || 'plaintext';
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
            const knownLangs = ['javascript', 'typescript', 'json', 'css', 'xml', 'python', 'java', 'csharp', 'plaintext'];
            return knownLangs.includes(extension) ? extension : 'plaintext';
    }
};

// TreeRow receives the shared context object and uses index
const TreeRow: React.FC<ListChildComponentProps<TreeRowData>> = ({ index, style, data }) => {
  const {
      items, // Get the full array
      itemDisplayStates, // Get the full map
      toggleExpand, showFullContentHandler, t,
      filterTerm, filterCaseSensitive, highlightCache, requestHighlighting,
  } = data; // data is the shared context object

  // Get the specific item for this row using the index
  const item = items?.[index];
  if (!item) {
      console.warn(`[TreeRow] Item at index ${index} is missing from data.items.`);
      return <div style={style} className="tree-item">Error: Item not found</div>;
  }

  // Look up the state for *this specific item* from the map
  const displayState = itemDisplayStates.get(item.filePath);
  const isExpanded = displayState?.expanded ?? false;
  const showFull = displayState?.showFull ?? false;

  // console.log(`[TreeRow ${index}] Render. Path: ${item.filePath}, Expanded: ${isExpanded}, ShowFull: ${showFull}`);

  const language = useMemo(() => getLanguageFromPath(item.filePath), [item.filePath]);

  // This recalculates based on showFull looked up from the map
  const { contentPreview, totalContentLines, isContentLarge } = useMemo(() => {
      const lines = item.content?.split('\n') ?? [];
      const totalLines = lines.length;
      const large = item.content ? totalLines > MAX_PREVIEW_LINES : false;
      const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content;
      // console.log(`[TreeRow ${index}] Recalculated contentPreview. ShowFull: ${showFull}, Preview length: ${preview?.length ?? 0}`);
      return { contentPreview: preview, totalContentLines: totalLines, isContentLarge: large };
  }, [item.content, showFull]); // Depends on showFull derived from map

  // Effect for requesting highlighting
  useEffect(() => {
    const cacheEntry = highlightCache.get(item.filePath);
    if (isExpanded && contentPreview && language !== 'plaintext' && (!cacheEntry || cacheEntry.status === 'idle')) {
      requestHighlighting(item.filePath, contentPreview, language);
    }
  }, [isExpanded, contentPreview, language, item.filePath, requestHighlighting, highlightCache]);

  const showShowMoreButton = isExpanded && isContentLarge && !showFull;
  const handleToggle = () => toggleExpand(item.filePath);
  const handleShowMore = (e: React.MouseEvent) => {
      e.stopPropagation();
      showFullContentHandler(item.filePath);
  };

  const highlightInfo = highlightCache.get(item.filePath) ?? { status: 'idle' };

  return (
    <div style={style} className="tree-item">
      <div className="tree-item-header" onClick={handleToggle} title={item.filePath}>
        <span className="tree-item-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className="tree-item-path">
            <HighlightMatches text={item.filePath} term={filterTerm} caseSensitive={filterCaseSensitive} />
        </span>
      </div>
      {isExpanded && (
        <div className="tree-item-content">
          {item.readError ? ( <span className="tree-item-error">{t(`errors:${item.readError}`, { defaultValue: item.readError })}</span> )
           : item.content !== null ? (
            <>
              {language === 'plaintext' ? ( <pre><code>{contentPreview}</code></pre> )
               : highlightInfo.status === 'pending' ? ( <pre><code className="hljs">{t('results:highlighting')}</code></pre> )
               : highlightInfo.status === 'error' ? ( <> <span className="tree-item-error">{t('results:highlightError')}: {highlightInfo.error}</span> <pre><code>{contentPreview}</code></pre> </> )
               : highlightInfo.status === 'done' && highlightInfo.html ? ( <pre><code className={`language-${language} hljs`} dangerouslySetInnerHTML={{ __html: highlightInfo.html }} /></pre> )
               : ( <pre><code>{contentPreview}</code></pre> )}

              {showShowMoreButton && (
                <button onClick={handleShowMore} className="show-more-button">
                  {t('results:showMore', { remaining: totalContentLines - MAX_PREVIEW_LINES })}
                </button>
              )}
            </>
          ) : ( <span className="tree-item-error">{/* No content */}</span> )}
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
  itemDisplayStates, // Needed for getTreeItemSize and creating itemData
  itemDisplayVersion, // Needed for triggering updates
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

  const textListRef = useRef<List<TextRowData>>(null);
  // Correct ref type for VariableSizeList using the shared context type
  const treeListRef = useRef<VariableSizeList<TreeRowData>>(null);

  const workerRef = useRef<Worker | null>(null);
  const highlightCacheRef = useRef<HighlightCache>(new Map());
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);

  // Worker setup/cleanup useEffect remains the same
  useEffect(() => {
    workerRef.current = new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' });
    const handleWorkerMessage = (event: MessageEvent) => {
        const { filePath, status, highlightedHtml, error } = event.data;
        if (filePath) {
            highlightCacheRef.current.set(filePath, { status, html: highlightedHtml, error });
            setHighlightUpdateCounter(prev => prev + 1);
        }
    };
    const handleWorkerError = (event: ErrorEvent) => { console.error("[Highlight Worker Error]", event.message, event); };
    workerRef.current.addEventListener('message', handleWorkerMessage);
    workerRef.current.addEventListener('error', handleWorkerError);
    return () => {
        if (workerRef.current) {
            console.log("[Highlight Worker] Terminating.");
            workerRef.current.removeEventListener('message', handleWorkerMessage);
            workerRef.current.removeEventListener('error', handleWorkerError);
            workerRef.current.terminate();
            workerRef.current = null;
            highlightCacheRef.current.clear();
        }
    };
  }, []);

  // requestHighlighting remains the same
  const requestHighlighting = useCallback((filePath: string, code: string, language: string) => {
    if (workerRef.current) {
        highlightCacheRef.current.set(filePath, { status: 'pending' });
        setHighlightUpdateCounter(prev => prev + 1);
        workerRef.current.postMessage({ filePath, code, language });
    } else {
        console.warn("Highlight worker not available to process request for:", filePath);
    }
  }, []);

  // Effect to clear cache remains the same
  useEffect(() => {
      highlightCacheRef.current.clear();
      setHighlightUpdateCounter(0);
  }, [results]);

  const isOriginalResultLarge = useMemo(() => results.split('\n').length > LARGE_RESULT_LINE_THRESHOLD, [results]);

  // Effect to reset list cache - depends on itemDisplayVersion from props
  useEffect(() => {
    if (viewMode === 'tree' && treeListRef.current) {
      // console.log(`[ResultsDisplay] Resetting tree list cache (forcing render) due to state/prop change. Version: ${itemDisplayVersion}`);
      treeListRef.current.resetAfterIndex(0, true); // Force re-render
    }
    // Also handle text list scroll reset
    if (viewMode === 'text' && textListRef.current && isFilterActive) {
        textListRef.current.scrollToItem(0);
    }
    // Depend on the version counter received from props
  }, [viewMode, itemDisplayVersion, highlightUpdateCounter, isFilterActive, filteredTextLines, filteredStructuredItems]);

  // getTreeItemSize still needs itemDisplayStates to look up the state for size calculation
  const getTreeItemSize = useCallback((index: number): number => {
    if (!filteredStructuredItems) return TREE_ITEM_HEADER_HEIGHT;
    const item = filteredStructuredItems[index];
    if (!item) return TREE_ITEM_HEADER_HEIGHT;

    // Look up state from the prop map for size calculation
    const displayState = itemDisplayStates.get(item.filePath);
    const isExpanded = displayState?.expanded ?? false;
    const showFull = displayState?.showFull ?? false;

    let size: number;
    if (!isExpanded) {
      size = TREE_ITEM_HEADER_HEIGHT;
    } else {
      let contentLineCount = 0;
      if (item.readError) { contentLineCount = 2; }
      else if (item.content) {
        const lines = item.content.split('\n').length;
        contentLineCount = (lines > MAX_PREVIEW_LINES && !showFull) ? MAX_PREVIEW_LINES : lines;
      } else { contentLineCount = 1; }

      const highlightInfo = highlightCacheRef.current.get(item.filePath);
      if (highlightInfo?.status === 'pending' || highlightInfo?.status === 'error') {
          contentLineCount += 1;
      }

      const showShowMoreButton = (item.content && item.content.split('\n').length > MAX_PREVIEW_LINES && !showFull);
      const showMoreButtonHeight = showShowMoreButton ? SHOW_MORE_BUTTON_HEIGHT : 0;
      const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT;
      size = TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING;
    }
    return size;
  }, [filteredStructuredItems, itemDisplayStates, highlightUpdateCounter]); // Keep itemDisplayStates dependency here

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

  // Ensure textItemData is correctly typed and populated
  const textItemData: TextRowData = useMemo(() => ({
      lines: filteredTextLines,
      filterTerm,
      filterCaseSensitive,
  }), [filteredTextLines, filterTerm, filterCaseSensitive]);

  // --- Revert treeItemData creation to the shared context object ---
  const treeItemData: TreeRowData | null = useMemo(() => {
      // Ensure items exist before creating data object
      if (!filteredStructuredItems) return null;

      return {
          items: filteredStructuredItems, // Pass the full array
          itemDisplayStates: itemDisplayStates, // Pass the full map
          // Pass other handlers and context
          toggleExpand: onToggleExpand,
          showFullContentHandler: onShowFullContent,
          t: t,
          filterTerm,
          filterCaseSensitive,
          highlightCache: highlightCacheRef.current,
          requestHighlighting: requestHighlighting,
      };
  // Depend on the items array, the state map, version counter, and other props
  }, [filteredStructuredItems, itemDisplayStates, itemDisplayVersion, onToggleExpand, onShowFullContent, t, filterTerm, filterCaseSensitive, requestHighlighting, highlightUpdateCounter]);
  // -----------------------------------------------------------------

  // Ensure getSummaryLabelKey always returns a string
  const getSummaryLabelKey = (): string => {
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
      {isOriginalResultLarge && ( <p className="clipboard-warning">{t('clipboardWarning')}</p> )}

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
            ) : treeItemData ? ( // Check if treeItemData (now the context object) is not null
              <VariableSizeList
                ref={treeListRef}
                className="results-list-scrollbar"
                height={height}
                itemCount={treeItemData.items.length} // Use length from items array inside itemData
                itemSize={getTreeItemSize}
                width={width}
                itemData={treeItemData} // Pass the shared context object
                overscanCount={5}
                estimatedItemSize={TREE_ITEM_HEADER_HEIGHT + (TREE_ITEM_CONTENT_LINE_HEIGHT * 5)}
                // Use itemDisplayVersion from props in the key to force update
                itemKey={(index, data) => `${data.items[index]?.filePath ?? index}-${itemDisplayVersion}`}
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
