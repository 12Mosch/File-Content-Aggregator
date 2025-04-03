// D:/Code/Electron/src/ui/ResultsDisplay.tsx
import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches";
import "./ResultsDisplay.css";
import "./Highlight.css"; // Import highlight styles
import type { StructuredItem } from "./vite-env.d";

// --- highlight.js Imports ---
import hljs from 'highlight.js/lib/core';
// Import and register common languages
import javascript from 'highlight.js/lib/languages/javascript';
import typescript from 'highlight.js/lib/languages/typescript';
import json from 'highlight.js/lib/languages/json';
import css from 'highlight.js/lib/languages/css';
import xml from 'highlight.js/lib/languages/xml'; // For HTML too
import python from 'highlight.js/lib/languages/python';
import java from 'highlight.js/lib/languages/java';
import csharp from 'highlight.js/lib/languages/csharp';
import plaintext from 'highlight.js/lib/languages/plaintext';

// Register languages
hljs.registerLanguage('javascript', javascript);
hljs.registerLanguage('jsx', javascript); // Alias jsx to js
hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('tsx', typescript); // Alias tsx to ts
hljs.registerLanguage('json', json);
hljs.registerLanguage('css', css);
hljs.registerLanguage('html', xml); // Alias html to xml
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('python', python);
hljs.registerLanguage('java', java);
hljs.registerLanguage('csharp', csharp);
hljs.registerLanguage('log', plaintext); // Treat log as plaintext
hljs.registerLanguage('txt', plaintext); // Treat txt as plaintext
hljs.registerLanguage('plaintext', plaintext);
// ---------------------------

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
}

// Helper function to get language identifier from file path
const getLanguageFromPath = (filePath: string): string => {
    const extension = filePath.split('.').pop()?.toLowerCase() || 'plaintext';
    // Map extensions to highlight.js language identifiers
    switch (extension) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'json':
            return 'json';
        case 'css':
        case 'scss': // Add other CSS variants if needed
        case 'less':
            return 'css';
        case 'html':
        case 'htm':
            return 'html'; // Use 'xml' alias registered above
        case 'xml':
        case 'xaml':
        case 'csproj':
        case 'props':
            return 'xml';
        case 'py':
            return 'python';
        case 'java':
            return 'java';
        case 'cs':
            return 'csharp';
        case 'log':
            return 'log'; // Use 'plaintext' alias
        case 'txt':
        case 'md': // Treat markdown as plaintext for now
            return 'plaintext';
        default:
            // Attempt to guess based on registered languages, fallback to plaintext
            return hljs.getLanguage(extension) ? extension : 'plaintext';
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
  } = data;
  const item = items[index];
  const displayState = itemDisplayStates.get(item.filePath);
  const isExpanded = displayState?.expanded ?? false;
  const showFull = displayState?.showFull ?? false;

  // Ref for the code element to apply highlighting
  const codeRef = useRef<HTMLElement>(null);

  // Determine the language for highlighting
  const language = useMemo(() => getLanguageFromPath(item.filePath), [item.filePath]);

  // Memoize content preview calculation
  const { contentPreview, totalContentLines, isContentLarge } = useMemo(() => {
      const lines = item.content?.split('\n') ?? [];
      const totalLines = lines.length;
      const large = item.content ? totalLines > MAX_PREVIEW_LINES : false;
      // IMPORTANT: Use item.content directly if showFull is true for the effect to get the full content
      const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content;
      return { contentPreview: preview, totalContentLines: totalLines, isContentLarge: large };
  }, [item.content, showFull]);

  // Effect to apply highlighting when content/expansion changes
  useEffect(() => {
    // Only highlight if expanded, ref exists, content exists, and language is not plaintext
    if (isExpanded && codeRef.current && contentPreview && language !== 'plaintext') {
        try {
            // Apply highlighting to the element
            hljs.highlightElement(codeRef.current);
        } catch (error) {
            console.error(`Highlight.js error highlighting element for ${item.filePath}:`, error);
        }
    }
    // Dependencies: Run when expansion state changes, or the content being displayed changes
  }, [isExpanded, contentPreview, language, item.filePath]);

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
          ) : item.content !== null ? ( // Check content exists (could be empty string)
            <>
              {/* Wrap content in pre > code with ref and language class */}
              <pre>
                <code ref={codeRef} className={`language-${language}`}>
                  {/* Render contentPreview (which is full content if showFull is true) */}
                  {/* HighlightMatches is now applied *within* the code block by hljs.highlightElement */}
                  {contentPreview}
                </code>
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
  filterTerm,
  filterCaseSensitive,
}) => {
  const { t } = useTranslation(['results', 'errors']);

  const [copyStatus, setCopyStatus] = useState<string>("");
  const [saveStatus, setSaveStatus] = useState<string>("");

  const textListRef = useRef<List>(null);
  const treeListRef = useRef<VariableSizeList>(null);

  const isOriginalResultLarge = useMemo(() => results.split('\n').length > LARGE_RESULT_LINE_THRESHOLD, [results]);

  useEffect(() => {
    if (viewMode === 'tree' && treeListRef.current) {
      // Reset cache when filter/items change, or view mode switches to tree
      treeListRef.current.resetAfterIndex(0, false);
    }
    // Optionally reset text scroll on filter change
    // if (viewMode === 'text' && textListRef.current && filterTerm) {
    //   textListRef.current.scrollToItem(0);
    // }
  }, [itemDisplayStates, viewMode, filteredStructuredItems, filterTerm]);

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
      // Note: Syntax highlighting itself shouldn't change the line count or height significantly
      return TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING;
    }
  }, [filteredStructuredItems, itemDisplayStates]);

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
                itemSize={getTreeItemSize}
                width={width}
                itemData={treeItemData}
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
