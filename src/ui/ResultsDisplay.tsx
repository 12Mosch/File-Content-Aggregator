import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  FixedSizeList as List,
  VariableSizeList,
  ListChildComponentProps,
} from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
import HighlightMatches from "./HighlightMatches";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { StructuredItem, ExportFormat } from "./vite-env.d";
import { Copy, AlertTriangle, Save } from "lucide-react";

// Constants
const TEXT_BLOCK_LINE_HEIGHT = 22;
const TREE_ITEM_HEADER_HEIGHT = 32;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18;
const TREE_ITEM_PADDING_Y = 8;
const MAX_PREVIEW_LINES = 50;
const SHOW_MORE_BUTTON_HEIGHT = 30;
const LARGE_RESULT_LINE_THRESHOLD = 100000;

// Types
interface ItemDisplayState {
  expanded: boolean;
  showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;
type HighlightStatus = "idle" | "pending" | "done" | "error";
interface HighlightCacheEntry {
  status: HighlightStatus;
  html?: string; // Optional
  error?: string; // Optional
}
type HighlightCache = Map<string, HighlightCacheEntry>;

interface ResultsDisplayProps {
  results: string;
  filteredTextLines: string[];
  filteredStructuredItems: StructuredItem[] | null;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  viewMode: "text" | "tree";
  itemDisplayStates: ItemDisplayStates;
  itemDisplayVersion: number;
  onCopy: () => Promise<{ success: boolean; potentiallyTruncated: boolean }>;
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
const TextRow: React.FC<ListChildComponentProps<TextRowData>> = ({
  index,
  style,
  data,
}) => {
  const { lines, filterTerm, filterCaseSensitive } = data;
  const lineContent = lines?.[index] ?? "";
  return (
    <div
      style={style}
      className="px-3 overflow-hidden box-border flex items-center"
    >
      <pre className="font-mono text-sm leading-snug text-foreground whitespace-pre-wrap break-words m-0 select-text w-full">
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

// --- Row Component for Tree View (Refactored with Tailwind) ---
interface TreeRowData {
  items: StructuredItem[];
  itemDisplayStates: ItemDisplayStates;
  toggleExpand: (filePath: string) => void;
  showFullContentHandler: (filePath: string) => void;
  t: TFunction<("results" | "errors")[], undefined>; // Use TFunction type
  filterTerm: string;
  filterCaseSensitive: boolean;
  highlightCache: HighlightCache;
  requestHighlighting: (
    filePath: string,
    code: string,
    language: string,
    forceUpdate?: boolean
  ) => void;
  onCopyContent: (content: string) => void;
}
const getLanguageFromPath = (filePath: string): string => {
  const extension = filePath.split(".").pop()?.toLowerCase() || "plaintext";
  switch (extension) {
    case "js":
    case "jsx": {
      return "javascript";
    }
    case "ts":
    case "tsx": {
      return "typescript";
    }
    case "json": {
      return "json";
    }
    case "css":
    case "scss":
    case "less": {
      return "css";
    }
    case "html":
    case "htm": {
      return "html";
    }
    case "xml":
    case "xaml":
    case "csproj":
    case "props": {
      return "xml";
    }
    case "py": {
      return "python";
    }
    case "java": {
      return "java";
    }
    case "cs": {
      return "csharp";
    }
    case "log": {
      return "log";
    }
    case "txt":
    case "md": {
      return "plaintext";
    }
    default: {
      const knownLangs = [
        "javascript",
        "typescript",
        "json",
        "css",
        "xml",
        "python",
        "java",
        "csharp",
        "plaintext",
      ];
      return knownLangs.includes(extension) ? extension : "plaintext";
    }
  }
};

const TreeRow: React.FC<ListChildComponentProps<TreeRowData>> = ({
  index,
  style,
  data,
}) => {
  const {
    items,
    itemDisplayStates,
    toggleExpand,
    showFullContentHandler,
    t,
    filterTerm,
    filterCaseSensitive,
    highlightCache,
    requestHighlighting,
    onCopyContent,
  } = data;

  // --- Hooks moved to top level ---
  const item = items?.[index];
  const displayState = item ? itemDisplayStates.get(item.filePath) : undefined;
  const isExpanded = displayState?.expanded ?? false;
  const showFull = displayState?.showFull ?? false;
  const language = useMemo(
    () => (item ? getLanguageFromPath(item.filePath) : "plaintext"),
    [item]
  );
  const wasPreviewHighlightedRef = useRef(false);

  const { contentPreview, totalContentLines, isContentLarge } = useMemo(() => {
    const lines = item?.content?.split("\n") ?? [];
    const totalLines = lines.length;
    const large = item?.content ? totalLines > MAX_PREVIEW_LINES : false;
    const preview =
      large && !showFull
        ? lines.slice(0, MAX_PREVIEW_LINES).join("\n")
        : item?.content;
    if (large && !showFull) {
      wasPreviewHighlightedRef.current = true;
    }
    return {
      contentPreview: preview,
      totalContentLines: totalLines,
      isContentLarge: large,
    };
  }, [item?.content, showFull]);

  const highlightInfo: HighlightCacheEntry = item
    ? (highlightCache.get(item.filePath) ?? {
        status: "idle",
        html: undefined,
        error: undefined,
      })
    : { status: "idle", html: undefined, error: undefined };

  // Effect for requesting highlighting
  useEffect(() => {
    if (!item) return;
    const currentCacheEntry = highlightCache.get(item.filePath);
    let needsHighlighting = false;
    let forceUpdate = false;
    if (
      isExpanded &&
      typeof contentPreview === "string" &&
      language !== "plaintext"
    ) {
      if (!currentCacheEntry || currentCacheEntry.status === "idle") {
        needsHighlighting = true;
      } else if (
        showFull &&
        wasPreviewHighlightedRef.current &&
        currentCacheEntry.status === "done"
      ) {
        needsHighlighting = true;
        forceUpdate = true;
        wasPreviewHighlightedRef.current = false;
      }
    }
    if (needsHighlighting && typeof contentPreview === "string") {
      requestHighlighting(item.filePath, contentPreview, language, forceUpdate);
    }
  }, [
    isExpanded,
    contentPreview,
    language,
    item?.filePath,
    requestHighlighting,
    highlightCache,
    showFull,
    index,
    item,
  ]);

  if (!item)
    return (
      <div style={style} className="p-2 text-destructive">
        Error: Item not found
      </div>
    );

  const showShowMoreButton = isExpanded && isContentLarge && !showFull;
  const handleToggle = () => toggleExpand(item.filePath);
  const handleShowMore = (e: React.MouseEvent) => {
    e.stopPropagation();
    showFullContentHandler(item.filePath);
  };

  const handleCopyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.content) {
      onCopyContent(item.content);
    }
  };

  return (
    <div
      style={style}
      className="border-b border-border overflow-hidden box-border"
    >
      {/* Header */}
      <div
        className="flex items-center px-2 py-1 cursor-pointer bg-muted/50 hover:bg-muted h-[32px] box-border transition-colors"
        onClick={handleToggle}
        title={item.filePath}
      >
        <span className="inline-block w-6 text-xs mr-1 text-center text-muted-foreground shrink-0">
          {isExpanded ? "▼" : "▶"}
        </span>
        <span className="font-mono text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis flex-grow text-left">
          <HighlightMatches
            text={item.filePath}
            term={filterTerm}
            caseSensitive={filterCaseSensitive}
          />
        </span>
        {item.content && (
          <Button
            variant="ghost"
            size="icon"
            className="ml-2 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={handleCopyClick}
            title={t("results:copyFileContentButton")}
            aria-label={t("results:copyFileContentButton")}
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {/* Content Area */}
      {isExpanded && (
        <div className="pl-[2.1rem] pr-2 py-1 bg-background text-left box-border">
          {item.readError ? (
            <span className="block font-mono text-xs text-destructive italic whitespace-pre-wrap break-all">
              {t(`errors:${item.readError}`, { defaultValue: item.readError })}
            </span>
          ) : typeof contentPreview === "string" ? (
            <>
              <pre className="m-0 text-left w-full font-mono text-xs leading-normal text-foreground whitespace-pre-wrap break-all">
                {language === "plaintext" ? (
                  <code>{contentPreview}</code>
                ) : highlightInfo.status === "pending" ? (
                  <code className="hljs">{t("results:highlighting")}</code>
                ) : highlightInfo.status === "error" ? (
                  <>
                    <span className="block text-destructive italic mb-1">
                      {t("results:highlightError")}: {highlightInfo.error}
                    </span>
                    <code>{contentPreview}</code>
                  </>
                ) : highlightInfo.status === "done" && highlightInfo.html ? (
                  <code
                    className={`language-${language} hljs block`}
                    dangerouslySetInnerHTML={{ __html: highlightInfo.html }}
                  />
                ) : (
                  <code>{contentPreview}</code>
                )}
              </pre>
              {showShowMoreButton && (
                <Button
                  onClick={handleShowMore}
                  variant="ghost"
                  size="sm"
                  className="mt-1 h-auto px-2 py-0.5"
                >
                  {t("results:showMore", {
                    remaining: totalContentLines - MAX_PREVIEW_LINES,
                  })}
                </Button>
              )}
            </>
          ) : (
            <span className="block font-mono text-xs text-muted-foreground italic">
              {/* No content */}
            </span>
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
  itemDisplayVersion,
  onCopy,
  onToggleExpand,
  onShowFullContent,
  isFilterActive,
  filterTerm,
  filterCaseSensitive,
}) => {
  const { t } = useTranslation(["results", "errors"]);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [exportStatus, setExportStatus] = useState<string>("");
  const [copyFileStatus, setCopyFileStatus] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("csv");
  const textListRef = useRef<List<TextRowData>>(null);
  const treeListRef = useRef<VariableSizeList<TreeRowData>>(null);
  const workerRef = useRef<Worker | null>(null);
  const highlightCacheRef = useRef<HighlightCache>(new Map());
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);

  const isOriginalResultLarge = useMemo(
    () => results.split("\n").length > LARGE_RESULT_LINE_THRESHOLD,
    [results]
  );

  const textItemData: TextRowData = useMemo(
    () => ({ lines: filteredTextLines, filterTerm, filterCaseSensitive }),
    [filteredTextLines, filterTerm, filterCaseSensitive]
  );

  const requestHighlighting = useCallback(
    (filePath: string, code: string, language: string, forceUpdate = false) => {
      const currentCache = highlightCacheRef.current.get(filePath);
      if (!forceUpdate && currentCache?.status === "done") return;
      if (currentCache?.status === "pending") return;

      if (workerRef.current) {
        highlightCacheRef.current.set(filePath, { status: "pending" });
        setHighlightUpdateCounter((prev) => prev + 1);
        console.log(
          `[RequestHighlighting] Posting message for ${filePath} (Force: ${forceUpdate})`
        );
        workerRef.current.postMessage({ filePath, code, language });
      } else {
        console.warn(
          "Highlight worker not available to process request for:",
          filePath
        );
        highlightCacheRef.current.set(filePath, {
          status: "error",
          error: "Worker not available",
        });
        setHighlightUpdateCounter((prev) => prev + 1);
      }
    },
    []
  );

  const handleCopyFileContent = useCallback(
    async (content: string) => {
      setCopyFileStatus(t("copyButtonCopying"));
      if (window.electronAPI?.copyToClipboard) {
        try {
          const success = await window.electronAPI.copyToClipboard(content);
          setCopyFileStatus(
            success ? t("copyButtonSuccess") : t("copyButtonFailed")
          );
        } catch (err: unknown) {
          console.error(
            "Failed to copy file content:",
            err instanceof Error ? err.message : err
          );
          setCopyFileStatus(t("copyButtonFailed"));
        } finally {
          setTimeout(() => setCopyFileStatus(""), 3000);
        }
      } else {
        setCopyFileStatus(t("copyButtonFailed"));
        setTimeout(() => setCopyFileStatus(""), 3000);
      }
    },
    [t]
  );

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
      highlightCache: highlightCacheRef.current,
      requestHighlighting: requestHighlighting,
      onCopyContent: handleCopyFileContent,
    };
  }, [
    filteredStructuredItems,
    itemDisplayStates,
    onToggleExpand,
    onShowFullContent,
    t,
    filterTerm,
    filterCaseSensitive,
    requestHighlighting,
    handleCopyFileContent,
  ]);

  const getTreeItemSize = useCallback(
    (index: number): number => {
      if (!filteredStructuredItems) return TREE_ITEM_HEADER_HEIGHT;
      const item = filteredStructuredItems[index];
      if (!item) return TREE_ITEM_HEADER_HEIGHT;

      const displayState = itemDisplayStates.get(item.filePath);
      const isExpanded = displayState?.expanded ?? false;
      const showFull = displayState?.showFull ?? false;

      if (!isExpanded) return TREE_ITEM_HEADER_HEIGHT;

      let contentLineCount = 0;
      if (item.readError) {
        contentLineCount = 2;
      } else if (item.content) {
        const lines = item.content.split("\n").length;
        contentLineCount =
          lines > MAX_PREVIEW_LINES && !showFull ? MAX_PREVIEW_LINES : lines;
      } else {
        contentLineCount = 1;
      }

      const highlightInfo = highlightCacheRef.current.get(item.filePath);
      if (
        highlightInfo?.status === "pending" ||
        highlightInfo?.status === "error"
      ) {
        contentLineCount += 1;
      }

      const showShowMoreButton =
        item.content &&
        item.content.split("\n").length > MAX_PREVIEW_LINES &&
        !showFull;
      const showMoreButtonHeight = showShowMoreButton
        ? SHOW_MORE_BUTTON_HEIGHT
        : 0;

      const contentHeight = contentLineCount * TREE_ITEM_CONTENT_LINE_HEIGHT;
      return (
        TREE_ITEM_HEADER_HEIGHT +
        contentHeight +
        showMoreButtonHeight +
        TREE_ITEM_PADDING_Y
      );
    },
    [filteredStructuredItems, itemDisplayStates]
  );

  // Effect for initializing and terminating the worker
  useEffect(() => {
    workerRef.current = new Worker(
      new URL("./highlight.worker.ts", import.meta.url),
      {
        type: "module",
      }
    );

    const handleWorkerMessage = (event: MessageEvent) => {
      // Type the expected structure of event.data
      const data = event.data as {
        filePath: string;
        status: HighlightStatus;
        highlightedHtml?: string;
        error?: string;
      };

      if (data.filePath) {
        highlightCacheRef.current.set(data.filePath, {
          status: data.status,
          html: data.highlightedHtml,
          error: data.error,
        });
        setHighlightUpdateCounter((prev) => prev + 1);
      }
    };

    const handleWorkerError = (event: ErrorEvent) => {
      console.error("[Highlight Worker Error]", event.message, event);
    };

    const currentWorker = workerRef.current;
    currentWorker.addEventListener("message", handleWorkerMessage);
    currentWorker.addEventListener("error", handleWorkerError);

    // Capture the ref's current value *inside* the effect for cleanup
    const cacheRefForCleanup = highlightCacheRef.current;
    return () => {
      console.log("[Highlight Worker] Terminating.");
      currentWorker.removeEventListener("message", handleWorkerMessage);
      currentWorker.removeEventListener("error", handleWorkerError);
      currentWorker.terminate();
      workerRef.current = null;
      // Use the captured cache ref value here
      cacheRefForCleanup.clear();
    };
  }, []); // Empty dependency array ensures this runs only on mount and unmount

  // Effect to clear highlight cache when results change
  useEffect(() => {
    highlightCacheRef.current.clear();
    setHighlightUpdateCounter(0);
  }, [results]);

  // Effect to reset list scroll/size when view mode or data changes significantly
  useEffect(() => {
    if (viewMode === "tree" && treeListRef.current) {
      treeListRef.current.resetAfterIndex(0, true);
    }
    if (viewMode === "text" && textListRef.current && isFilterActive) {
      textListRef.current.scrollToItem(0);
    }
  }, [
    viewMode,
    itemDisplayVersion,
    highlightUpdateCounter,
    isFilterActive,
    filteredTextLines,
    filteredStructuredItems,
  ]);

  // Wrapper functions for promise-based onClick handlers
  const handleCopyAllResults = () => {
    setCopyStatus(t("copyButtonCopying"));
    onCopy()
      .then(({ success }) => {
        let statusKey = success ? "copyButtonSuccess" : "copyButtonFailed";
        if (success && isOriginalResultLarge) {
          statusKey = "copyButtonTruncated";
        }
        setCopyStatus(t(statusKey));
      })
      .catch(() => {
        setCopyStatus(t("copyButtonFailed"));
      })
      .finally(() => {
        setTimeout(() => setCopyStatus(""), 5000);
      });
  };

  // --- Handle Export ---
  const handleExport = () => {
    if (!filteredStructuredItems || filteredStructuredItems.length === 0) {
      setExportStatus(t("exportButtonNoResults"));
      setTimeout(() => setExportStatus(""), 3000);
      return;
    }
    if (!window.electronAPI?.exportResults) {
      setExportStatus(t("exportButtonError"));
      console.error("Export API not available.");
      setTimeout(() => setExportStatus(""), 3000);
      return;
    }

    setExportStatus(t("exportButtonExporting"));
    window.electronAPI
      .exportResults(filteredStructuredItems, exportFormat)
      .then(({ success, error }) => {
        if (success) {
          setExportStatus(t("exportButtonSuccess"));
        } else {
          setExportStatus(
            error === "Export cancelled."
              ? t("exportButtonCancelled")
              : t("exportButtonError")
          );
          console.error("Export failed:", error);
        }
      })
      .catch((err: unknown) => {
        setExportStatus(t("exportButtonError"));
        console.error(
          "Export failed:",
          err instanceof Error ? err.message : err
        );
      })
      .finally(() => {
        setTimeout(() => setExportStatus(""), 5000);
      });
  };

  const getSummaryLabelKey = (): string => {
    if (viewMode === "text")
      return isFilterActive ? "summaryTotalLinesFiltered" : "summaryTotalLines";
    else
      return isFilterActive ? "summaryTotalFilesFiltered" : "summaryTotalFiles";
  };
  const summaryCount =
    viewMode === "text"
      ? filteredTextLines.length
      : (filteredStructuredItems?.length ?? 0);

  return (
    <div className="mt-6 p-4 border border-border rounded-lg bg-card flex flex-col flex-grow min-h-[300px] overflow-hidden">
      <h3 className="mt-0 mb-4 text-xl font-semibold text-card-foreground shrink-0">
        {t("heading")}
      </h3>
      <div className="flex gap-x-6 gap-y-1 mb-4 text-sm text-muted-foreground flex-wrap shrink-0">
        <span>{t("summaryFound", { count: summary.filesFound })}</span>
        <span>{t("summaryProcessed", { count: summary.filesProcessed })}</span>
        {summary.errorsEncountered > 0 && (
          <span className="text-destructive font-semibold">
            {t("summaryReadErrors", { count: summary.errorsEncountered })}
          </span>
        )}
        <span>{t(getSummaryLabelKey(), { count: summaryCount })}</span>
        {copyFileStatus && (
          <span className="ml-auto text-xs text-primary">{copyFileStatus}</span>
        )}
      </div>
      {isOriginalResultLarge && (
        <p
          className={cn(
            "p-3 rounded-md border text-sm mb-4 shrink-0 flex items-center",
            "bg-amber-100 border-amber-300 text-amber-800"
          )}
        >
          <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0" />
          <span>{t("clipboardWarning")}</span>
        </p>
      )}
      <div className="flex-grow border border-border rounded-md bg-background overflow-hidden min-h-[200px]">
        <AutoSizer>
          {({ height, width }) =>
            viewMode === "text" ? (
              <List
                ref={textListRef}
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
                height={height}
                itemCount={treeItemData.items.length}
                itemSize={getTreeItemSize}
                width={width}
                itemData={treeItemData}
                overscanCount={5}
                estimatedItemSize={
                  TREE_ITEM_HEADER_HEIGHT + TREE_ITEM_CONTENT_LINE_HEIGHT * 5
                }
                itemKey={(index, data) =>
                  `${data.items[index]?.filePath ?? index}-${itemDisplayVersion}`
                }
              >
                {TreeRow}
              </VariableSizeList>
            ) : null
          }
        </AutoSizer>
      </div>
      {/* --- Export/Copy Area --- */}
      <div className="mt-4 flex flex-wrap gap-4 items-center shrink-0">
        <Button
          onClick={handleCopyAllResults}
          disabled={!results || !!copyStatus}
          variant="outline"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copyStatus || t("copyButton")}
        </Button>
        <div className="flex items-center gap-2">
          <Label htmlFor="exportFormatSelect" className="text-sm shrink-0">
            {t("exportFormatLabel")}
          </Label>
          <Select
            value={exportFormat}
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
            disabled={!filteredStructuredItems || !!exportStatus}
          >
            <SelectTrigger
              id="exportFormatSelect"
              className="w-[100px] h-9"
            >
              <SelectValue placeholder={t("exportFormatLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="csv">{t("exportFormatCSV")}</SelectItem>
              <SelectItem value="json">{t("exportFormatJSON")}</SelectItem>
              <SelectItem value="md">{t("exportFormatMD")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={handleExport}
          disabled={!filteredStructuredItems || !!exportStatus}
          variant="secondary"
        >
          <Save className="mr-2 h-4 w-4" />
          {exportStatus || t("saveButtonLabel")}
        </Button>
      </div>
      {/* ----------------------------- */}
    </div>
  );
};

export default ResultsDisplay;
