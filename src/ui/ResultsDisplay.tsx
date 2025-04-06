import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FixedSizeList as List, VariableSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { StructuredItem } from "./vite-env.d";

// Constants (adjust if needed based on Tailwind's line-height/font-size)
const TEXT_BLOCK_LINE_HEIGHT = 22;
const TREE_ITEM_HEADER_HEIGHT = 32;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18;
const TREE_ITEM_PADDING_Y = 8;
const MAX_PREVIEW_LINES = 50;
const SHOW_MORE_BUTTON_HEIGHT = 30;
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
  itemDisplayVersion: number;
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>;
  onSave: () => Promise<void>;
  onToggleExpand: (filePath: string) => void;
  onShowFullContent: (filePath: string) => void;
  isFilterActive: boolean;
  filterTerm: string;
  filterCaseSensitive: boolean;
}

// --- Row Component for Text View (Refactored with Tailwind) ---
interface TextRowData { lines: string[]; filterTerm: string; filterCaseSensitive: boolean; }
const TextRow: React.FC<ListChildComponentProps<TextRowData>> = ({ index, style, data }) => { const { lines, filterTerm, filterCaseSensitive } = data; const lineContent = lines?.[index] ?? ''; return ( <div style={style} className="px-3 overflow-hidden box-border flex items-center"> <pre className="font-mono text-sm leading-snug text-foreground whitespace-pre-wrap break-words m-0 select-text w-full"> {lineContent === "" ? ( "\u00A0" ) : ( <HighlightMatches text={lineContent} term={filterTerm} caseSensitive={filterCaseSensitive} /> )} </pre> </div> ); };

// --- Row Component for Tree View (Refactored with Tailwind) ---
interface TreeRowData { items: StructuredItem[]; itemDisplayStates: ItemDisplayStates; toggleExpand: (filePath: string) => void; showFullContentHandler: (filePath: string) => void; t: (key: string, options?: any) => string; filterTerm: string; filterCaseSensitive: boolean; highlightCache: HighlightCache; requestHighlighting: (filePath: string, code: string, language: string) => void; }
const getLanguageFromPath = (filePath: string): string => { const extension = filePath.split('.').pop()?.toLowerCase() || 'plaintext'; switch (extension) { case 'js': case 'jsx': return 'javascript'; case 'ts': case 'tsx': return 'typescript'; case 'json': return 'json'; case 'css': case 'scss': case 'less': return 'css'; case 'html': case 'htm': return 'html'; case 'xml': case 'xaml': case 'csproj': case 'props': return 'xml'; case 'py': return 'python'; case 'java': return 'java'; case 'cs': return 'csharp'; case 'log': return 'log'; case 'txt': case 'md': return 'plaintext'; default: const knownLangs = ['javascript', 'typescript', 'json', 'css', 'xml', 'python', 'java', 'csharp', 'plaintext']; return knownLangs.includes(extension) ? extension : 'plaintext'; } };
const TreeRow: React.FC<ListChildComponentProps<TreeRowData>> = ({ index, style, data }) => { const { items, itemDisplayStates, toggleExpand, showFullContentHandler, t, filterTerm, filterCaseSensitive, highlightCache, requestHighlighting, } = data; const item = items?.[index]; if (!item) return <div style={style} className="p-2 text-destructive">Error: Item not found</div>; const displayState = itemDisplayStates.get(item.filePath); const isExpanded = displayState?.expanded ?? false; const showFull = displayState?.showFull ?? false; const language = useMemo(() => getLanguageFromPath(item.filePath), [item.filePath]); const { contentPreview, totalContentLines, isContentLarge } = useMemo(() => { const lines = item.content?.split('\n') ?? []; const totalLines = lines.length; const large = item.content ? totalLines > MAX_PREVIEW_LINES : false; const preview = (large && !showFull) ? lines.slice(0, MAX_PREVIEW_LINES).join('\n') : item.content; return { contentPreview: preview, totalContentLines: totalLines, isContentLarge: large }; }, [item.content, showFull]); useEffect(() => { const cacheEntry = highlightCache.get(item.filePath); if (isExpanded && contentPreview && language !== 'plaintext' && (!cacheEntry || cacheEntry.status === 'idle')) { requestHighlighting(item.filePath, contentPreview, language); } }, [isExpanded, contentPreview, language, item.filePath, requestHighlighting, highlightCache]); const showShowMoreButton = isExpanded && isContentLarge && !showFull; const handleToggle = () => toggleExpand(item.filePath); const handleShowMore = (e: React.MouseEvent) => { e.stopPropagation(); showFullContentHandler(item.filePath); }; const highlightInfo = highlightCache.get(item.filePath) ?? { status: 'idle' }; return ( <div style={style} className="border-b border-border overflow-hidden box-border"> <div className="flex items-center px-2 py-1 cursor-pointer bg-muted/50 hover:bg-muted h-[32px] box-border transition-colors" onClick={handleToggle} title={item.filePath}> <span className="inline-block w-6 text-xs mr-1 text-center text-muted-foreground shrink-0"> {isExpanded ? '▼' : '▶'} </span> <span className="font-mono text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis flex-grow text-left"> <HighlightMatches text={item.filePath} term={filterTerm} caseSensitive={filterCaseSensitive} /> </span> </div> {isExpanded && ( <div className="pl-[2.1rem] pr-2 py-1 bg-background text-left box-border"> {item.readError ? ( <span className="block font-mono text-xs text-destructive italic whitespace-pre-wrap break-all"> {t(`errors:${item.readError}`, { defaultValue: item.readError })}</span> ) : item.content !== null ? ( <> <pre className="m-0 text-left w-full font-mono text-xs leading-normal text-foreground whitespace-pre-wrap break-all"> {language === 'plaintext' ? ( <code>{contentPreview}</code> ) : highlightInfo.status === 'pending' ? ( <code className="hljs">{t('results:highlighting')}</code> ) : highlightInfo.status === 'error' ? ( <> <span className="block text-destructive italic mb-1">{t('results:highlightError')}: {highlightInfo.error}</span> <code>{contentPreview}</code> </> ) : highlightInfo.status === 'done' && highlightInfo.html ? ( <code className={`language-${language} hljs block`} dangerouslySetInnerHTML={{ __html: highlightInfo.html }} /> ) : ( <code>{contentPreview}</code> )} </pre> {showShowMoreButton && ( <Button onClick={handleShowMore} variant="ghost" size="sm" className="mt-1 h-auto px-2 py-0.5"> {t('results:showMore', { remaining: totalContentLines - MAX_PREVIEW_LINES })} </Button> )} </> ) : ( <span className="block font-mono text-xs text-muted-foreground italic">{/* No content */}</span> )} </div> )} </div> ); };


// --- Main ResultsDisplay Component ---
const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  results,
  filteredTextLines,
  filteredStructuredItems,
  summary,
  viewMode,
  itemDisplayStates,
  itemDisplayVersion,
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
  const treeListRef = useRef<VariableSizeList<TreeRowData>>(null);

  // Worker and highlighting logic (remains the same)
  const workerRef = useRef<Worker | null>(null);
  const highlightCacheRef = useRef<HighlightCache>(new Map());
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);
  useEffect(() => { workerRef.current = new Worker(new URL('./highlight.worker.ts', import.meta.url), { type: 'module' }); const handleWorkerMessage = (event: MessageEvent) => { const { filePath, status, highlightedHtml, error } = event.data; if (filePath) { highlightCacheRef.current.set(filePath, { status, html: highlightedHtml, error }); setHighlightUpdateCounter(prev => prev + 1); } }; const handleWorkerError = (event: ErrorEvent) => { console.error("[Highlight Worker Error]", event.message, event); }; workerRef.current.addEventListener('message', handleWorkerMessage); workerRef.current.addEventListener('error', handleWorkerError); return () => { if (workerRef.current) { console.log("[Highlight Worker] Terminating."); workerRef.current.removeEventListener('message', handleWorkerMessage); workerRef.current.removeEventListener('error', handleWorkerError); workerRef.current.terminate(); workerRef.current = null; highlightCacheRef.current.clear(); } }; }, []);
  const requestHighlighting = useCallback((filePath: string, code: string, language: string) => { if (workerRef.current) { highlightCacheRef.current.set(filePath, { status: 'pending' }); setHighlightUpdateCounter(prev => prev + 1); workerRef.current.postMessage({ filePath, code, language }); } else { console.warn("Highlight worker not available for:", filePath); } }, []);
  useEffect(() => { highlightCacheRef.current.clear(); setHighlightUpdateCounter(0); }, [results]);

  const isOriginalResultLarge = useMemo(() => results.split('\n').length > LARGE_RESULT_LINE_THRESHOLD, [results]);

  // Effect to reset list cache (remains the same logic)
  useEffect(() => { if (viewMode === 'tree' && treeListRef.current) { treeListRef.current.resetAfterIndex(0, true); } if (viewMode === 'text' && textListRef.current && isFilterActive) { textListRef.current.scrollToItem(0); } }, [viewMode, itemDisplayVersion, highlightUpdateCounter, isFilterActive, filteredTextLines, filteredStructuredItems]);

  // Calculate tree item size (logic remains similar, constants adjusted)
  const getTreeItemSize = useCallback((index: number): number => { if (!filteredStructuredItems) return TREE_ITEM_HEADER_HEIGHT; const item = filteredStructuredItems[index]; if (!item) return TREE_ITEM_HEADER_HEIGHT; const displayState = itemDisplayStates.get(item.filePath); const isExpanded = displayState?.expanded ?? false; const showFull = displayState?.showFull ?? false; if (!isExpanded) return TREE_ITEM_HEADER_HEIGHT; let contentLineCount = 0; if (item.readError) { contentLineCount = 2; } else if (item.content) { const lines = item.content.split('\n').length; contentLineCount = (lines > MAX_PREVIEW_LINES && !showFull) ? MAX_PREVIEW_LINES : lines; } else { contentLineCount = 1; } const highlightInfo = highlightCacheRef.current.get(item.filePath); if (highlightInfo?.status === 'pending' || highlightInfo?.status === 'error') contentLineCount += 1; const showShowMoreButton = (item.content && item.content.split('\n').length > MAX_PREVIEW_LINES && !showFull); const showMoreButtonHeight = showShowMoreButton ? SHOW_MORE_BUTTON_HEIGHT : 0; const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT; return TREE_ITEM_HEADER_HEIGHT + contentHeight + showMoreButtonHeight + TREE_ITEM_PADDING_Y; }, [filteredStructuredItems, itemDisplayStates, highlightUpdateCounter]);

  // Action button handlers (logic remains the same)
  const handleCopy = async () => { setCopyStatus(t('copyButtonCopying')); const { success, potentiallyTruncated } = await onCopy(); let statusKey = success ? 'copyButtonSuccess' : 'copyButtonFailed'; if (success && isOriginalResultLarge) statusKey = 'copyButtonTruncated'; setCopyStatus(t(statusKey)); setTimeout(() => setCopyStatus(""), 5000); };
  const handleSave = async () => { setSaveStatus(t('saveButtonSaving')); try { await onSave(); setSaveStatus(t('saveButtonInitiated')); setTimeout(() => setSaveStatus(""), 5000); } catch (error) { setSaveStatus(t('saveButtonFailed')); setTimeout(() => setSaveStatus(""), 3000); } };

  // Prepare itemData for virtualized lists (logic remains the same)
  const textItemData: TextRowData = useMemo(() => ({ lines: filteredTextLines, filterTerm, filterCaseSensitive }), [filteredTextLines, filterTerm, filterCaseSensitive]);
  const treeItemData: TreeRowData | null = useMemo(() => { if (!filteredStructuredItems) return null; return { items: filteredStructuredItems, itemDisplayStates: itemDisplayStates, toggleExpand: onToggleExpand, showFullContentHandler: onShowFullContent, t: t, filterTerm, filterCaseSensitive, highlightCache: highlightCacheRef.current, requestHighlighting: requestHighlighting }; }, [filteredStructuredItems, itemDisplayStates, itemDisplayVersion, onToggleExpand, onShowFullContent, t, filterTerm, filterCaseSensitive, requestHighlighting, highlightUpdateCounter]);

  // Determine summary label (logic remains the same)
  const getSummaryLabelKey = (): string => { if (viewMode === 'text') return isFilterActive ? 'summaryTotalLinesFiltered' : 'summaryTotalLines'; else return isFilterActive ? 'summaryTotalFilesFiltered' : 'summaryTotalFiles'; };
  const summaryCount = viewMode === 'text' ? filteredTextLines.length : (filteredStructuredItems?.length ?? 0);

  return (
    <div className="mt-6 p-4 border border-border rounded-lg bg-card flex flex-col flex-grow min-h-[300px] overflow-hidden">
      <h3 className="mt-0 mb-4 text-xl font-semibold text-card-foreground shrink-0">
        {t('heading')}
      </h3>
      <div className="flex gap-x-6 gap-y-1 mb-4 text-sm text-muted-foreground flex-wrap shrink-0">
        <span>{t('summaryFound', { count: summary.filesFound })}</span>
        <span>{t('summaryProcessed', { count: summary.filesProcessed })}</span>
        {summary.errorsEncountered > 0 && (
          <span className="text-destructive font-semibold">
            {t('summaryReadErrors', { count: summary.errorsEncountered })}
          </span>
        )}
        <span>{t(getSummaryLabelKey(), { count: summaryCount })}</span>
      </div>

      {/* Clipboard Warning - Updated Styling */}
      {isOriginalResultLarge && (
        <p className={cn(
            "p-3 rounded-md border text-sm mb-4 shrink-0",
            "bg-amber-100 border-amber-300 text-amber-800"
         )}
        >
          {t('clipboardWarning')}
        </p>
       )}
      {/* End Clipboard Warning */}

      <div className="flex-grow border border-border rounded-md bg-background overflow-hidden min-h-[200px]">
        <AutoSizer>
          {({ height, width }) => (
            viewMode === 'text' ? (
              <List ref={textListRef} height={height} itemCount={filteredTextLines.length} itemSize={TEXT_BLOCK_LINE_HEIGHT} width={width} itemData={textItemData} overscanCount={10}>
                {TextRow}
              </List>
            ) : treeItemData ? (
              <VariableSizeList ref={treeListRef} height={height} itemCount={treeItemData.items.length} itemSize={getTreeItemSize} width={width} itemData={treeItemData} overscanCount={5} estimatedItemSize={TREE_ITEM_HEADER_HEIGHT + (TREE_ITEM_CONTENT_LINE_HEIGHT * 5)} itemKey={(index, data) => `${data.items[index]?.filePath ?? index}-${itemDisplayVersion}`}>
                {TreeRow}
              </VariableSizeList>
            ) : null
          )}
        </AutoSizer>
      </div>

      <div className="mt-4 flex gap-4 shrink-0">
        <Button onClick={handleCopy} disabled={!results || !!copyStatus}>
          {copyStatus || t('copyButton')}
        </Button>
        <Button onClick={handleSave} disabled={!results || !!saveStatus} variant="secondary">
          {saveStatus || t('saveButton')}
        </Button>
      </div>
    </div>
  );
};

export default ResultsDisplay;
