import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useReducer,
} from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { VariableSizeList, ListChildComponentProps } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
// Correctly import Fuse class and IFuseOptions type
import Fuse, { type IFuseOptions } from "fuse.js";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type {
  StructuredItem,
  ExportFormat,
  QueryStructure, // Import QueryStructure
} from "./vite-env.d";
import { extractSearchTermsFromQuery } from "./queryBuilderUtils"; // Import the new utility
import { highlightTermsInHtml } from "./highlightHtmlUtils"; // Import the new HTML highlighting utility
import { getFileTypeIcon } from "./utils/fileTypeIcons"; // Import file type icons utility
import {
  Copy,
  AlertTriangle,
  Save,
  Loader2,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  FolderOpen,
  Check,
  X,
  Download,
  ClipboardCopy,
  Upload,
  ChevronDown,
} from "lucide-react";

// Constants
const TREE_ITEM_HEADER_HEIGHT = 32;
const TREE_ITEM_CONTENT_LINE_HEIGHT = 18;
const TREE_ITEM_PADDING_Y = 8;
const MAX_PREVIEW_LINES = 50;
const SHOW_MORE_BUTTON_HEIGHT = 30;
const LARGE_COPY_ITEMS_THRESHOLD = 5000;
// Fuse.js options for fuzzy filtering
// Use the imported IFuseOptions type directly
const FUSE_OPTIONS: IFuseOptions<StructuredItem> = {
  includeScore: false, // Don't need score for simple filtering
  // Search in `filePath` and `readError` fields
  keys: ["filePath", "readError"],
  threshold: 0.4, // Adjust threshold for fuzziness (0 = exact, 1 = match anything)
  // isCaseSensitive: false, // Default is false, controlled by checkbox
  minMatchCharLength: 2, // Minimum characters to trigger fuzzy search
  // ignoreLocation: true, // Search anywhere in the string
};

// Types
interface ItemDisplayState {
  expanded: boolean;
  showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;
type HighlightStatus = "idle" | "pending" | "done" | "error";
interface HighlightCacheEntry {
  status: HighlightStatus;
  html?: string;
  error?: string;
}
type HighlightCache = Map<string, HighlightCacheEntry>;

// Selection state types
type SelectionState = Set<string>; // Set of selected file paths
type SelectionAction =
  | { type: "select"; filePath: string }
  | { type: "deselect"; filePath: string }
  | { type: "toggle"; filePath: string }
  | { type: "selectAll"; filePaths: string[] }
  | { type: "deselectAll" };

// Selection reducer function
function selectionReducer(
  state: SelectionState,
  action: SelectionAction
): SelectionState {
  switch (action.type) {
    case "select":
      return new Set([...state, action.filePath]);
    case "deselect": {
      const newState = new Set(state);
      newState.delete(action.filePath);
      return newState;
    }
    case "toggle": {
      const newState = new Set(state);
      if (newState.has(action.filePath)) {
        newState.delete(action.filePath);
      } else {
        newState.add(action.filePath);
      }
      return newState;
    }
    case "selectAll":
      return new Set(action.filePaths);
    case "deselectAll":
      return new Set();
    default:
      return state;
  }
}

// Added state for on-demand content
interface ContentCacheEntry {
  status: "idle" | "loading" | "loaded" | "error";
  content?: string | null;
  error?: string; // Error key for translation
}
type ContentCache = Map<string, ContentCacheEntry>;

// --- Sorting Types ---
type SortKey = "filePath" | "size" | "mtime" | "matched";
type SortDirection = "asc" | "desc";
// ---------------------

interface ResultsDisplayProps {
  // Changed: Now receives the *original* unfiltered items
  structuredItems: StructuredItem[] | null;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  viewMode: "text" | "tree"; // Keep for now, but text view is non-functional
  itemDisplayStates: ItemDisplayStates;
  itemDisplayVersion: number;
  onToggleExpand: (filePath: string) => void;
  onShowFullContent: (filePath: string) => void;
  isFilterActive: boolean;
  filterTerm: string; // This is the debounced term passed from App.tsx for path highlighting
  filterCaseSensitive: boolean; // Case sensitivity for path highlighting
  searchQueryStructure: QueryStructure | null; // Added: The query structure used for the search
  searchQueryCaseSensitive: boolean; // Added: Case sensitivity used for the search query
  searchHighlightTerms?: string[]; // Added: Direct search terms for highlighting
  wholeWordMatching?: boolean; // Added: Whether to match whole words only
}

// --- Row Component for Tree View (Refactored with Tailwind) ---
interface TreeRowData {
  items: StructuredItem[]; // Now expects sorted items
  itemDisplayStates: ItemDisplayStates;
  toggleExpand: (filePath: string) => void;
  showFullContentHandler: (filePath: string) => void;
  t: TFunction<("results" | "errors")[], undefined>; // Use TFunction type
  pathFilterTerm: string; // Renamed: Term for highlighting the file path (fuzzy filter)
  pathFilterCaseSensitive: boolean; // Renamed: Case sensitivity for path highlighting
  contentHighlightTerms: (string | RegExp)[]; // Added: Terms for highlighting content
  contentHighlightCaseSensitive: boolean; // Added: Case sensitivity for content highlighting
  wholeWordMatching: boolean; // Added: Whether to match whole words only
  highlightCache: HighlightCache;
  requestHighlighting: (
    filePath: string,
    code: string,
    language: string,
    forceUpdate?: boolean
  ) => void;
  onCopyContent: (content: string) => void;
  contentCache: ContentCache; // Added content cache
  requestContent: (filePath: string) => void; // Added function to request content
  selectedFiles: SelectionState; // Added: Set of selected file paths
  toggleSelection: (filePath: string) => void; // Added: Function to toggle selection
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

// Define a default entry that matches the ContentCacheEntry type
const defaultContentEntry: ContentCacheEntry = { status: "idle" };

// Memoize the TreeRow component to prevent unnecessary re-renders
const TreeRow = React.memo(
  function TreeRow({
    index,
    style,
    data,
    isScrolling,
  }: ListChildComponentProps<TreeRowData>) {
    const {
      items,
      itemDisplayStates,
      toggleExpand,
      showFullContentHandler,
      t,
      pathFilterTerm, // Use renamed prop
      pathFilterCaseSensitive, // Use renamed prop
      contentHighlightTerms, // Use new prop for content highlighting
      contentHighlightCaseSensitive, // Use new prop for content highlighting case sensitivity
      wholeWordMatching, // Use whole word matching setting
      highlightCache,
      requestHighlighting,
      onCopyContent,
      contentCache, // Destructure new props
      requestContent, // Destructure new props
      selectedFiles, // Destructure selection state
      toggleSelection, // Destructure toggle selection function
    } = data;

    // --- Hooks moved to top level ---
    const item = items?.[index];
    const displayState = item
      ? itemDisplayStates.get(item.filePath)
      : undefined;
    const isExpanded = displayState?.expanded ?? false;
    const showFull = displayState?.showFull ?? false;
    const language = useMemo(
      () => (item ? getLanguageFromPath(item.filePath) : "plaintext"),
      [item]
    );
    const wasPreviewHighlightedRef = useRef(false);

    // Use the default entry when getting from cache to ensure consistent type
    const contentInfo: ContentCacheEntry = item
      ? (contentCache.get(item.filePath) ?? defaultContentEntry)
      : defaultContentEntry;

    // Effect to request content when expanded and not already loaded/loading
    useEffect(() => {
      if (
        item &&
        isExpanded &&
        !item.readError && // Don't request if there was a read error initially
        contentInfo.status === "idle"
      ) {
        requestContent(item.filePath);
      }
      // Only depend on item path, expansion state, and initial read error status
    }, [
      item?.filePath,
      isExpanded,
      item?.readError,
      contentInfo.status,
      requestContent,
      item,
    ]);

    const { contentPreview, totalContentLines, isContentLarge } =
      useMemo(() => {
        // Use content from the cache if available
        const currentContent = contentInfo.content; // Access is safe due to consistent type
        const lines = currentContent?.split("\n") ?? [];
        const totalLines = lines.length;
        const large = currentContent ? totalLines > MAX_PREVIEW_LINES : false;
        const preview =
          large && !showFull
            ? lines.slice(0, MAX_PREVIEW_LINES).join("\n")
            : currentContent;
        if (large && !showFull) {
          wasPreviewHighlightedRef.current = true;
        }
        return {
          contentPreview: preview,
          totalContentLines: totalLines,
          isContentLarge: large,
        };
        // Depend on cached content and showFull state
      }, [contentInfo.content, showFull]);

    const highlightInfo: HighlightCacheEntry = item
      ? (highlightCache.get(item.filePath) ?? {
          status: "idle",
          html: undefined,
          error: undefined,
        })
      : { status: "idle", html: undefined, error: undefined };

    // Effect for requesting highlighting (now depends on contentPreview)
    useEffect(() => {
      if (!item) return;
      const currentCacheEntry = highlightCache.get(item.filePath);
      let needsHighlighting = false;
      let forceUpdate = false;
      if (
        isExpanded &&
        typeof contentPreview === "string" && // Check if contentPreview is available
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
        requestHighlighting(
          item.filePath,
          contentPreview,
          language,
          forceUpdate
        );
      }
    }, [
      isExpanded,
      contentPreview, // Depend on the derived preview content
      language,
      item?.filePath,
      requestHighlighting,
      highlightCache,
      showFull,
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
      // Use cached content if available
      if (contentInfo.status === "loaded" && contentInfo.content) {
        onCopyContent(contentInfo.content);
      } else {
        // Optionally handle cases where content isn't loaded yet
        console.warn("Content not loaded for copying:", item.filePath);
      }
    };

    const handleOpenFileClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.electronAPI?.openFile) {
        console.log(`Requesting to open file: ${item.filePath}`);
        window.electronAPI
          .openFile(item.filePath)
          .then(({ success, error }) => {
            if (!success && error) {
              console.error(`Error opening file '${item.filePath}':`, error);
            }
          })
          .catch((err) => {
            console.error(`Failed to open file '${item.filePath}':`, err);
          });
      } else {
        console.warn("openFile API not available.");
      }
    };

    const handleOpenFileLocationClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (window.electronAPI?.openFileLocation) {
        console.log(`Requesting to show file location: ${item.filePath}`);
        window.electronAPI
          .openFileLocation(item.filePath)
          .then(({ success, error }) => {
            if (!success && error) {
              console.error(
                `Error showing file location for '${item.filePath}':`,
                error
              );
            }
          })
          .catch((err) => {
            console.error(
              `Failed to show file location for '${item.filePath}':`,
              err
            );
          });
      } else {
        console.warn("openFileLocation API not available.");
      }
    };

    // Handle checkbox click for selection
    const handleCheckboxClick = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent row toggle
      toggleSelection(item.filePath);
    };

    // Determine if content is available for the copy button
    const canCopy = contentInfo.status === "loaded" && !!contentInfo.content;

    // Determine if file is selected
    const isSelected = selectedFiles.has(item.filePath);

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
          {/* Checkbox for selection */}
          <div className="mr-1" onClick={handleCheckboxClick}>
            <Checkbox
              checked={isSelected}
              className="data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
              aria-label={
                isSelected ? t("results:deselectFile") : t("results:selectFile")
              }
            />
          </div>
          <span className="inline-block w-6 text-xs mr-1 text-center text-muted-foreground shrink-0">
            {isExpanded ? "▼" : "▶"}
          </span>
          {/* File type icon */}
          <span className="inline-flex items-center justify-center w-6 mr-1 text-muted-foreground shrink-0">
            {getFileTypeIcon(item.filePath)}
          </span>
          <span className="font-mono text-sm text-foreground whitespace-nowrap overflow-hidden text-ellipsis flex-grow text-left">
            {/* Use HighlightMatches for the file path with pathFilterTerm */}
            <HighlightMatches
              text={item.filePath}
              terms={
                pathFilterTerm && pathFilterTerm.trim() ? [pathFilterTerm] : []
              } // Only pass non-empty path filter term
              caseSensitive={pathFilterCaseSensitive} // Pass case sensitivity for path
              wholeWordMatching={false} // Don't use whole word matching for path filtering
            />
          </span>
          {/* Only show copy button if content is loadable (no initial read error) */}
          {!item.readError && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="ml-2 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleCopyClick}
                title={t("results:copyFileContentButton")}
                aria-label={t("results:copyFileContentButton")}
                disabled={!canCopy} // Disable if content not loaded
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleOpenFileClick}
                title={t("results:openFileButton")}
                aria-label={t("results:openFileButton")}
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="ml-1 h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={handleOpenFileLocationClick}
                title={t("results:openFileLocationButton")}
                aria-label={t("results:openFileLocationButton")}
              >
                <FolderOpen className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
        {/* Content Area */}
        {isExpanded && (
          <div className="pl-[2.1rem] pr-2 py-1 bg-background text-left box-border">
            {/* Skip complex content rendering during scrolling for better performance */}
            {isScrolling ? (
              <div className="font-mono text-xs text-muted-foreground italic py-2">
                {t("results:scrollingPlaceholder")}
              </div>
            ) : item.readError ? (
              <span className="block font-mono text-xs text-destructive italic whitespace-pre-wrap break-all">
                {/* Highlight error message if filter term matches */}
                <HighlightMatches
                  text={t(`errors:${item.readError}`, {
                    defaultValue: item.readError,
                  })}
                  terms={[pathFilterTerm]} // Use path filter term for error message
                  caseSensitive={pathFilterCaseSensitive} // Use path filter case sensitivity
                  wholeWordMatching={false} // Don't use whole word matching for error messages
                />
              </span>
            ) : // Handle content loading states
            contentInfo.status === "loading" ? (
              <span className="flex items-center font-mono text-xs text-muted-foreground italic">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                {t("results:loadingContent")}
              </span>
            ) : contentInfo.status === "error" ? (
              <span className="flex items-center font-mono text-xs text-destructive italic">
                <AlertTriangle className="h-3 w-3 mr-1 shrink-0" />
                {t("results:contentError")}:{" "}
                {t(`errors:${contentInfo.error}`, {
                  defaultValue: contentInfo.error ?? "Unknown error",
                })}
              </span>
            ) : contentInfo.status === "loaded" &&
              typeof contentPreview === "string" ? (
              // Content loaded, handle highlighting
              <>
                <pre className="m-0 text-left w-full font-mono text-xs leading-normal text-foreground whitespace-pre-wrap break-all">
                  {language === "plaintext" ? (
                    // For plaintext, use HighlightMatches with content terms
                    <code>
                      <HighlightMatches
                        text={contentPreview}
                        terms={
                          contentHighlightTerms &&
                          contentHighlightTerms.length > 0
                            ? contentHighlightTerms
                            : []
                        } // Use content terms if available
                        caseSensitive={contentHighlightCaseSensitive} // Use content case sensitivity
                        wholeWordMatching={wholeWordMatching} // Use whole word matching setting
                      />
                    </code>
                  ) : highlightInfo.status === "pending" ? (
                    <code className="hljs">{t("results:highlighting")}</code>
                  ) : highlightInfo.status === "error" ? (
                    // Show error and fallback to plaintext highlighting
                    <>
                      <span className="block text-destructive italic mb-1">
                        {t("results:highlightError")}: {highlightInfo.error}
                      </span>
                      <code>
                        <HighlightMatches
                          text={contentPreview}
                          terms={
                            contentHighlightTerms &&
                            contentHighlightTerms.length > 0
                              ? contentHighlightTerms
                              : []
                          } // Use content terms if available
                          caseSensitive={contentHighlightCaseSensitive} // Use content case sensitivity
                          wholeWordMatching={wholeWordMatching} // Use whole word matching setting
                        />
                      </code>
                    </>
                  ) : highlightInfo.status === "done" && highlightInfo.html ? (
                    // Syntax highlighted: Apply content term highlighting *after* syntax highlighting
                    // Use our new utility function to highlight search terms within the HTML
                    <code
                      className={`language-${language} hljs block`}
                      dangerouslySetInnerHTML={{
                        __html: highlightTermsInHtml(
                          highlightInfo.html,
                          contentHighlightTerms &&
                            contentHighlightTerms.length > 0
                            ? contentHighlightTerms
                            : [],
                          contentHighlightCaseSensitive,
                          wholeWordMatching
                        ),
                      }}
                    />
                  ) : (
                    // Fallback: Plaintext highlighting
                    <code>
                      <HighlightMatches
                        text={contentPreview}
                        terms={
                          contentHighlightTerms &&
                          contentHighlightTerms.length > 0
                            ? contentHighlightTerms
                            : []
                        } // Use content terms if available
                        caseSensitive={contentHighlightCaseSensitive} // Use content case sensitivity
                        wholeWordMatching={wholeWordMatching} // Use whole word matching setting
                      />
                    </code>
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
              // Fallback for idle state or null content after load
              <span className="block font-mono text-xs text-muted-foreground italic">
                {/* Display "Not Matched" only if a content query was active */}
                {contentHighlightTerms.length > 0
                  ? t("results:notMatched")
                  : t("results:noContentPreview")}
              </span>
            )}
          </div>
        )}
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom equality function to prevent unnecessary re-renders
    // Only re-render if the item, display state, or highlight/content cache has changed
    if (prevProps.index !== nextProps.index) return false;

    const prevItem = prevProps.data.items[prevProps.index];
    const nextItem = nextProps.data.items[nextProps.index];

    // Different items or no items
    if (!prevItem || !nextItem || prevItem.filePath !== nextItem.filePath)
      return false;

    // Check if display state changed
    const prevDisplayState = prevProps.data.itemDisplayStates.get(
      prevItem.filePath
    );
    const nextDisplayState = nextProps.data.itemDisplayStates.get(
      nextItem.filePath
    );
    if (
      prevDisplayState?.expanded !== nextDisplayState?.expanded ||
      prevDisplayState?.showFull !== nextDisplayState?.showFull
    )
      return false;

    // Check if content cache changed - compare content and status
    const prevContent = prevProps.data.contentCache.get(prevItem.filePath);
    const nextContent = nextProps.data.contentCache.get(nextItem.filePath);
    if (
      prevContent?.status !== nextContent?.status ||
      (prevContent?.status === "loaded" &&
        nextContent?.status === "loaded" &&
        prevContent?.content !== nextContent?.content)
    )
      return false;

    // Check if highlight cache changed - compare HTML and status
    const prevHighlight = prevProps.data.highlightCache.get(prevItem.filePath);
    const nextHighlight = nextProps.data.highlightCache.get(nextItem.filePath);
    if (
      prevHighlight?.status !== nextHighlight?.status ||
      (prevHighlight?.status === "done" &&
        nextHighlight?.status === "done" &&
        prevHighlight?.html !== nextHighlight?.html)
    )
      return false;

    // Check if selection state changed
    const prevSelected = prevProps.data.selectedFiles.has(prevItem.filePath);
    const nextSelected = nextProps.data.selectedFiles.has(nextItem.filePath);
    if (prevSelected !== nextSelected) return false;

    // Check if highlight terms changed - deep compare
    if (
      prevProps.data.contentHighlightTerms.length !==
      nextProps.data.contentHighlightTerms.length
    )
      return false;

    // Compare each highlight term
    for (let i = 0; i < prevProps.data.contentHighlightTerms.length; i++) {
      const prevTerm = prevProps.data.contentHighlightTerms[i];
      const nextTerm = nextProps.data.contentHighlightTerms[i];

      if (prevTerm instanceof RegExp && nextTerm instanceof RegExp) {
        if (prevTerm.toString() !== nextTerm.toString()) return false;
      } else if (prevTerm !== nextTerm) {
        return false;
      }
    }

    // Check if path filter term changed
    if (prevProps.data.pathFilterTerm !== nextProps.data.pathFilterTerm)
      return false;

    // Check if case sensitivity changed
    if (
      prevProps.data.pathFilterCaseSensitive !==
        nextProps.data.pathFilterCaseSensitive ||
      prevProps.data.contentHighlightCaseSensitive !==
        nextProps.data.contentHighlightCaseSensitive
    )
      return false;

    // If we got here, we can skip re-rendering
    return true;
  }
);

// --- Main ResultsDisplay Component ---
const ResultsDisplay: React.FC<ResultsDisplayProps> = ({
  structuredItems, // Original items from backend
  summary,
  viewMode, // Keep for potential future use or simplified display
  itemDisplayStates,
  itemDisplayVersion,
  onToggleExpand,
  onShowFullContent,
  isFilterActive,
  filterTerm, // This is the debounced term passed from App.tsx for path highlighting
  filterCaseSensitive, // Case sensitivity for path highlighting
  searchQueryStructure, // Added prop
  searchQueryCaseSensitive, // Added prop
  searchHighlightTerms = [], // Direct search terms for highlighting
  wholeWordMatching = false, // Default to false if not provided
}) => {
  const { t } = useTranslation(["results", "errors"]);
  const [copyStatus, setCopyStatus] = useState<string>("");
  const [exportStatus, setExportStatus] = useState<string>("");
  const [copyFileStatus, setCopyFileStatus] = useState<string>("");
  const [batchStatus, setBatchStatus] = useState<string>("");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("txt");
  const treeListRef = useRef<VariableSizeList<TreeRowData>>(null);
  const workerRef = useRef<Worker | null>(null);
  const highlightCacheRef = useRef<HighlightCache>(new Map());
  const [highlightUpdateCounter, setHighlightUpdateCounter] = useState(0);
  const contentCacheRef = useRef<ContentCache>(new Map()); // Added content cache ref
  const [contentUpdateCounter, setContentUpdateCounter] = useState(0); // State to trigger re-render on content cache update
  // Selection state using reducer
  const [selectedFiles, dispatchSelection] = useReducer(
    selectionReducer,
    new Set<string>()
  );
  // Removed fuseInstanceRef, instance is created within useMemo

  // --- Sorting State ---
  const [sortKey, setSortKey] = useState<SortKey>("filePath");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  // ---------------------

  // Extract search terms for content highlighting
  const contentHighlightTerms = useMemo(() => {
    // First, check if we have direct search terms from props
    if (searchHighlightTerms && searchHighlightTerms.length > 0) {
      console.log("Using direct search highlight terms:", searchHighlightTerms);
      return searchHighlightTerms;
    }

    // If no direct terms and no search query structure, return empty array
    if (!searchQueryStructure) {
      return [];
    }

    // Get terms from the query structure - the extraction function now handles quoted strings
    const terms = extractSearchTermsFromQuery(searchQueryStructure);
    console.log("Search terms for highlighting:", terms);

    // If we have terms, return them
    if (terms && terms.length > 0) {
      return terms;
    }

    // Debug: Check if terms array is empty
    console.warn(
      "No search terms extracted from query structure:",
      searchQueryStructure
    );

    // If we have a search query structure but no terms were extracted,
    // try to extract terms directly from the conditions
    if (
      searchQueryStructure.conditions &&
      searchQueryStructure.conditions.length > 0
    ) {
      // Look for term conditions and extract their values
      const fallbackTerms = searchQueryStructure.conditions
        .filter(
          (cond) =>
            cond &&
            "type" in cond &&
            cond.type === "term" &&
            typeof cond.value === "string" &&
            cond.value.trim().length > 0
        )
        .map((cond) => ("value" in cond ? cond.value.trim() : ""))
        .filter((term) => term.length > 0); // Filter out any empty strings

      if (fallbackTerms.length > 0) {
        console.log("Using fallback terms for highlighting:", fallbackTerms);
        return fallbackTerms;
      }
    }

    // If we still don't have any terms, try to use a default term
    if (
      searchQueryStructure.conditions &&
      searchQueryStructure.conditions.length > 0
    ) {
      // Just use a default term based on the operator
      const defaultTerm =
        searchQueryStructure.operator === "AND" ? "AND" : "OR";
      console.log("Using default term based on operator:", defaultTerm);
      return [defaultTerm];
    }

    // If all else fails, return empty array
    return [];
  }, [searchQueryStructure, searchHighlightTerms]);

  // --- Determine if a content query was active ---
  const hasContentQuery = useMemo(() => {
    return (
      searchQueryStructure !== null &&
      searchQueryStructure.conditions.length > 0
    );
  }, [searchQueryStructure]);
  // ---------------------------------------------

  // Fetch default export format on mount
  useEffect(() => {
    if (window.electronAPI?.getDefaultExportFormat) {
      void window.electronAPI
        .getDefaultExportFormat()
        .then((format) => setExportFormat(format))
        .catch((err) =>
          console.error("Error fetching default export format:", err)
        );
    }
  }, []);

  // --- Filter by Content Match ---
  // Apply content match filter *before* fuzzy filter and sorting
  const contentMatchedItems = useMemo(() => {
    if (!structuredItems) return null;
    // Filter if a content query was performed
    if (hasContentQuery) {
      const filtered = structuredItems.filter((item) => item.matched);
      return filtered;
    }
    // If no content query, show all items that passed initial filters
    return structuredItems;
  }, [structuredItems, hasContentQuery]); // Depend on hasContentQuery flag
  // -----------------------------

  // --- Fuzzy Filtering Logic ---
  // Now operates on contentMatchedItems
  const filteredItems = useMemo(() => {
    if (!contentMatchedItems) return null; // Use contentMatchedItems
    // Use the debounced filterTerm passed via props
    const currentFilterTerm = filterTerm.trim();
    if (
      !isFilterActive ||
      currentFilterTerm.length < FUSE_OPTIONS.minMatchCharLength!
    ) {
      // If filter is not active or too short, return contentMatchedItems
      return contentMatchedItems;
    }

    // Create a new Fuse instance whenever data or case sensitivity changes
    // console.log(`Creating Fuse instance for filtering (Term: "${currentFilterTerm}", Case Sensitive: ${filterCaseSensitive})`);
    // Use contentMatchedItems as the source for Fuse
    const fuse = new Fuse(contentMatchedItems, {
      ...FUSE_OPTIONS,
      isCaseSensitive: filterCaseSensitive, // Set case sensitivity
    });

    // Perform the fuzzy search using the debounced term
    const results = fuse.search(currentFilterTerm);
    // console.log(`Fuse search for "${currentFilterTerm}" found ${results.length} items.`);
    // Fuse returns results containing the original item, map back to StructuredItem[]
    return results.map((result) => result.item);
  }, [contentMatchedItems, isFilterActive, filterTerm, filterCaseSensitive]); // Depend on contentMatchedItems now
  // ---------------------------

  // Check if the number of items to copy is large (based on filtered items)
  const isCopyLarge = useMemo(
    () => (filteredItems?.length ?? 0) > LARGE_COPY_ITEMS_THRESHOLD,
    [filteredItems]
  );

  // Function to request content for a specific file
  const requestContent = useCallback(async (filePath: string) => {
    // Check if already loading or loaded
    const existing = contentCacheRef.current.get(filePath);
    if (existing?.status === "loading" || existing?.status === "loaded") {
      return;
    }

    // Set status to loading
    contentCacheRef.current.set(filePath, { status: "loading" });
    setContentUpdateCounter((prev) => prev + 1); // Trigger re-render

    try {
      if (!window.electronAPI?.invokeGetFileContent) {
        throw new Error("API function invokeGetFileContent not available.");
      }
      const result = await window.electronAPI.invokeGetFileContent(filePath);
      contentCacheRef.current.set(filePath, {
        status: result.error ? "error" : "loaded",
        content: result.content,
        error: result.error,
      });
    } catch (error) {
      console.error(`Failed to invoke getFileContent for ${filePath}:`, error);
      contentCacheRef.current.set(filePath, {
        status: "error",
        error: "ipcError",
      });
    } finally {
      setContentUpdateCounter((prev) => prev + 1);
    }
  }, []);

  const requestHighlighting = useCallback(
    (filePath: string, code: string, language: string, forceUpdate = false) => {
      const currentCache = highlightCacheRef.current.get(filePath);
      if (!forceUpdate && currentCache?.status === "done") return;
      if (currentCache?.status === "pending") return;

      if (workerRef.current) {
        highlightCacheRef.current.set(filePath, { status: "pending" });
        setHighlightUpdateCounter((prev) => prev + 1);
        // console.log(`[RequestHighlighting] Posting message for ${filePath} (Force: ${forceUpdate})`);
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

  // --- Sorting Logic ---
  const sortedItems = useMemo(() => {
    // Sort the *filtered* items (which are already content-matched if applicable)
    if (!filteredItems) return null;
    const itemsToSort = [...filteredItems];

    itemsToSort.sort((a, b) => {
      let compareA: string | number | boolean | undefined;
      let compareB: string | number | boolean | undefined;

      switch (sortKey) {
        case "filePath":
          compareA = a.filePath.toLowerCase();
          compareB = b.filePath.toLowerCase();
          break;
        case "size":
          compareA = a.size;
          compareB = b.size;
          break;
        case "mtime":
          compareA = a.mtime;
          compareB = b.mtime;
          break;
        case "matched":
          // Treat read errors as not matched for sorting purposes
          compareA = a.readError ? false : a.matched;
          compareB = b.readError ? false : b.matched;
          break;
        default:
          return 0;
      }

      // Handle undefined values (e.g., size/mtime if stats failed)
      // Place undefined values at the end when ascending, beginning when descending
      if (compareA === undefined && compareB === undefined) return 0;
      if (compareA === undefined) return sortDirection === "asc" ? 1 : -1;
      if (compareB === undefined) return sortDirection === "asc" ? -1 : 1;

      // Perform comparison
      let comparison = 0;
      if (compareA < compareB) {
        comparison = -1;
      } else if (compareA > compareB) {
        comparison = 1;
      }

      return sortDirection === "asc" ? comparison : comparison * -1;
    });

    return itemsToSort;
  }, [filteredItems, sortKey, sortDirection]); // Depend on filteredItems now
  // ---------------------

  const treeItemData: TreeRowData | null = useMemo(() => {
    if (!sortedItems) return null; // Use sortedItems here
    return {
      items: sortedItems, // Pass sorted items to the list
      itemDisplayStates: itemDisplayStates,
      toggleExpand: onToggleExpand,
      showFullContentHandler: onShowFullContent,
      t: t,
      pathFilterTerm: filterTerm, // Pass fuzzy filter term for path
      pathFilterCaseSensitive: filterCaseSensitive, // Pass case sensitivity for path
      contentHighlightTerms: contentHighlightTerms, // Pass extracted terms for content
      contentHighlightCaseSensitive: searchQueryCaseSensitive, // Pass query case sensitivity for content
      wholeWordMatching: wholeWordMatching, // Pass whole word matching setting
      highlightCache: highlightCacheRef.current,
      requestHighlighting: requestHighlighting,
      onCopyContent: handleCopyFileContent,
      contentCache: contentCacheRef.current,
      requestContent: requestContent,
      selectedFiles: selectedFiles, // Pass selection state
      toggleSelection: (filePath: string) =>
        dispatchSelection({ type: "toggle", filePath }), // Pass toggle function
    };
  }, [
    sortedItems, // Depend on sortedItems
    itemDisplayStates,
    onToggleExpand,
    onShowFullContent,
    t,
    filterTerm, // Keep for path highlighting (debounced)
    filterCaseSensitive, // Keep for path highlighting
    contentHighlightTerms, // Depend on extracted content terms
    searchQueryCaseSensitive, // Depend on query case sensitivity
    wholeWordMatching, // Depend on whole word matching setting
    requestHighlighting,
    handleCopyFileContent,
    requestContent,
    selectedFiles, // Depend on selection state
  ]);

  const getTreeItemSize = useCallback(
    (index: number): number => {
      if (!sortedItems) return TREE_ITEM_HEADER_HEIGHT; // Use sortedItems
      const item = sortedItems[index]; // Use sortedItems
      if (!item) return TREE_ITEM_HEADER_HEIGHT;

      const displayState = itemDisplayStates.get(item.filePath);
      const isExpanded = displayState?.expanded ?? false;

      // Always return just the header height for collapsed items
      if (!isExpanded) return TREE_ITEM_HEADER_HEIGHT;

      const showFull = displayState?.showFull ?? false;

      // Calculate size based on cached content or loading/error state
      const contentInfo =
        contentCacheRef.current.get(item.filePath) ?? defaultContentEntry;
      let contentLineCount = 0;

      if (item.readError) {
        contentLineCount = 1; // Space for the initial read error message
      } else if (contentInfo.status === "loading") {
        contentLineCount = 1; // Space for loading indicator
      } else if (contentInfo.status === "error") {
        contentLineCount = 1; // Space for error message
      } else if (
        contentInfo.status === "loaded" &&
        typeof contentInfo.content === "string"
      ) {
        const lines = contentInfo.content.split("\n").length;
        contentLineCount =
          lines > MAX_PREVIEW_LINES && !showFull ? MAX_PREVIEW_LINES : lines;
      } else {
        contentLineCount = 1; // Space for "Not Matched" or "No Content"
      }

      // Add extra line for highlight status if needed
      const highlightInfo = highlightCacheRef.current.get(item.filePath);
      if (
        highlightInfo?.status === "pending" ||
        highlightInfo?.status === "error"
      ) {
        contentLineCount += 1;
      }

      // Check if show more button is needed based on *actual* content length
      const showShowMoreButton =
        contentInfo.status === "loaded" &&
        typeof contentInfo.content === "string" &&
        contentInfo.content.split("\n").length > MAX_PREVIEW_LINES &&
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
    [sortedItems, itemDisplayStates] // Depend on sortedItems
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

  // Effect to clear highlight and content caches when results change
  useEffect(() => {
    highlightCacheRef.current.clear();
    contentCacheRef.current.clear(); // Clear content cache too
    setHighlightUpdateCounter(0);
    setContentUpdateCounter(0); // Reset content counter
    // No need to clear fuseInstanceRef here, it's handled in useMemo
  }, [structuredItems]); // Depend on the original results structure

  // Effect to reset list scroll/size when view mode, data, filter, or sort changes
  useEffect(() => {
    if (treeListRef.current) {
      // Force a complete recalculation of all item sizes
      treeListRef.current.resetAfterIndex(0, true);
    }
  }, [
    viewMode,
    itemDisplayVersion, // This changes when itemDisplayStates changes
    highlightUpdateCounter,
    contentUpdateCounter,
    isFilterActive,
    sortedItems, // Depend on sortedItems now
    sortKey, // Add sort dependencies
    sortDirection, // Add sort dependencies
  ]);

  // --- Handle Copy Results ---
  const handleCopyResults = useCallback(async () => {
    if (!sortedItems || sortedItems.length === 0) {
      // Use sortedItems
      setCopyStatus(t("exportButtonNoResults"));
      setTimeout(() => setCopyStatus(""), 3000);
      return;
    }
    if (!window.electronAPI?.invokeGenerateExportContent) {
      setCopyStatus(t("copyButtonFailed"));
      console.error("generate-export-content API not available.");
      setTimeout(() => setCopyStatus(""), 3000);
      return;
    }
    if (!window.electronAPI?.copyToClipboard) {
      setCopyStatus(t("copyButtonFailed"));
      console.error("copy-to-clipboard API not available.");
      setTimeout(() => setCopyStatus(""), 3000);
      return;
    }

    setCopyStatus(t("copyButtonCopying"));
    try {
      // Generate content in the selected format using sortedItems
      const { content, error } =
        await window.electronAPI.invokeGenerateExportContent(
          sortedItems,
          exportFormat
        );

      if (error || content === null) {
        throw new Error(error || "Failed to generate content for copying.");
      }

      // Copy the generated content to clipboard
      const success = await window.electronAPI.copyToClipboard(content);
      let statusKey = success ? "copyButtonSuccess" : "copyButtonFailed";
      if (success && isCopyLarge) {
        statusKey = "copyButtonTruncated";
      }
      setCopyStatus(t(statusKey));
    } catch (err) {
      console.error("Error during copy results:", err);
      setCopyStatus(t("copyButtonFailed"));
    } finally {
      setTimeout(() => setCopyStatus(""), 5000);
    }
  }, [sortedItems, exportFormat, t, isCopyLarge]); // Depend on sortedItems

  // --- Handle Export ---
  const handleExport = () => {
    if (!sortedItems || sortedItems.length === 0) {
      // Use sortedItems
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
    // Pass sorted items *without* content for export
    window.electronAPI
      .exportResults(sortedItems, exportFormat)
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

  // --- Batch Operations Handlers ---

  // Copy file paths to clipboard
  const handleCopyFilePaths = () => {
    if (!sortedItems || sortedItems.length === 0) {
      setBatchStatus(t("exportButtonNoResults"));
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    if (!window.electronAPI?.copyFilePaths) {
      setBatchStatus(t("copyPathsError"));
      console.error("Copy file paths API not available.");
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    setBatchStatus(t("batchOperationInProgress"));

    // Use selected files if any are selected, otherwise use all results
    const filePaths =
      selectedFiles.size > 0
        ? Array.from(selectedFiles)
        : sortedItems.map((item) => item.filePath);

    window.electronAPI
      .copyFilePaths(filePaths)
      .then(({ success, error }) => {
        if (success) {
          setBatchStatus(t("copyPathsSuccess"));
        } else {
          setBatchStatus(t("copyPathsError"));
          console.error("Copy file paths failed:", error);
        }
      })
      .catch((err: unknown) => {
        setBatchStatus(t("copyPathsError"));
        console.error(
          "Copy file paths failed:",
          err instanceof Error ? err.message : err
        );
      })
      .finally(() => {
        setTimeout(() => setBatchStatus(""), 5000);
      });
  };

  // Copy files to folder
  const handleCopyFilesToFolder = () => {
    if (!sortedItems || sortedItems.length === 0) {
      setBatchStatus(t("exportButtonNoResults"));
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    if (!window.electronAPI?.copyFilesToFolder) {
      setBatchStatus(t("copyFilesError"));
      console.error("Copy files to folder API not available.");
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    setBatchStatus(t("batchOperationInProgress"));

    // Use selected files if any are selected, otherwise use all results
    const filePaths =
      selectedFiles.size > 0
        ? Array.from(selectedFiles)
        : sortedItems.map((item) => item.filePath);

    window.electronAPI
      .copyFilesToFolder(filePaths)
      .then(({ success, error, destinationFolder: _destinationFolder }) => {
        if (success) {
          setBatchStatus(t("copyFilesSuccess"));
        } else {
          setBatchStatus(
            error === "Operation cancelled."
              ? t("batchOperationCancelled")
              : t("copyFilesError")
          );
          if (error) console.error("Copy files failed:", error);
        }
      })
      .catch((err: unknown) => {
        setBatchStatus(t("copyFilesError"));
        console.error(
          "Copy files failed:",
          err instanceof Error ? err.message : err
        );
      })
      .finally(() => {
        setTimeout(() => setBatchStatus(""), 5000);
      });
  };

  // Move files to folder
  const handleMoveFilesToFolder = () => {
    if (!sortedItems || sortedItems.length === 0) {
      setBatchStatus(t("exportButtonNoResults"));
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    if (!window.electronAPI?.moveFilesToFolder) {
      setBatchStatus(t("moveFilesError"));
      console.error("Move files to folder API not available.");
      setTimeout(() => setBatchStatus(""), 3000);
      return;
    }

    setBatchStatus(t("batchOperationInProgress"));

    // Use selected files if any are selected, otherwise use all results
    const filePaths =
      selectedFiles.size > 0
        ? Array.from(selectedFiles)
        : sortedItems.map((item) => item.filePath);

    window.electronAPI
      .moveFilesToFolder(filePaths)
      .then(({ success, error, destinationFolder: _destinationFolder }) => {
        if (success) {
          setBatchStatus(t("moveFilesSuccess"));

          // If files were successfully moved, we should update the UI
          // by removing them from the selection and potentially from the results
          dispatchSelection({ type: "deselectAll" });

          // Note: In a real implementation, you might want to refresh the results
          // or remove the moved files from the display
        } else {
          setBatchStatus(
            error === "Operation cancelled."
              ? t("batchOperationCancelled")
              : t("moveFilesError")
          );
          if (error) console.error("Move files failed:", error);
        }
      })
      .catch((err: unknown) => {
        setBatchStatus(t("moveFilesError"));
        console.error(
          "Move files failed:",
          err instanceof Error ? err.message : err
        );
      })
      .finally(() => {
        setTimeout(() => setBatchStatus(""), 5000);
      });
  };

  // Determine summary label based on whether a content query was active
  const getSummaryLabelKey = (): string => {
    const baseKey = hasContentQuery
      ? "summaryMatchedFiles" // Use specific key for matched files
      : "summaryTotalFiles"; // Use total files if no content query
    return isFilterActive ? `${baseKey}Filtered` : baseKey; // Append Filtered if fuzzy filter is active
  };
  // Use the length of the final list being displayed (sortedItems)
  const summaryCount = sortedItems?.length ?? 0;

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
        {/* Updated Summary Count Label */}
        <span>{t(getSummaryLabelKey(), { count: summaryCount })}</span>
        {copyFileStatus && (
          <span className="ml-auto text-xs text-primary">{copyFileStatus}</span>
        )}
      </div>
      {/* Re-added Clipboard warning */}
      {isCopyLarge && (
        <p
          className={cn(
            "p-3 rounded-md border text-sm mb-4 shrink-0 flex items-center",
            "bg-amber-100 border-amber-300 text-amber-800 dark:bg-amber-900/30 dark:border-amber-700/50 dark:text-amber-300"
          )}
        >
          <AlertTriangle className="inline h-4 w-4 mr-2 shrink-0" />
          <span>{t("clipboardWarning")}</span>
        </p>
      )}

      {/* --- Results List Container (Now includes Sorting) --- */}
      <div className="flex-grow flex flex-col border border-border rounded-md bg-background overflow-hidden min-h-[200px]">
        {/* --- Sorting Controls (Moved Inside) --- */}
        <div className="flex flex-wrap gap-4 items-center p-2 border-b border-border shrink-0 bg-muted/30">
          <div className="flex items-center gap-2">
            <Label htmlFor="sortKeySelect" className="text-sm shrink-0">
              {t("sortLabel")}
            </Label>
            <Select
              value={sortKey}
              onValueChange={(value) => setSortKey(value as SortKey)}
              disabled={!sortedItems || sortedItems.length === 0} // Disable if no items
            >
              <SelectTrigger id="sortKeySelect" className="w-[180px] h-9">
                <SelectValue placeholder={t("sortLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="filePath">{t("sortKeyFilePath")}</SelectItem>
                <SelectItem value="size">{t("sortKeyFileSize")}</SelectItem>
                <SelectItem value="mtime">
                  {t("sortKeyDateModified")}
                </SelectItem>
                <SelectItem value="matched">
                  {t("sortKeyMatchStatus")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="sortDirectionSelect" className="text-sm shrink-0">
              {t("sortDirectionLabel")}
            </Label>
            <Select
              value={sortDirection}
              onValueChange={(value) =>
                setSortDirection(value as SortDirection)
              }
              disabled={!sortedItems || sortedItems.length === 0} // Disable if no items
            >
              <SelectTrigger id="sortDirectionSelect" className="w-[120px] h-9">
                <SelectValue placeholder={t("sortDirectionLabel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="asc">
                  <ArrowUp className="inline h-4 w-4 mr-1" />
                  {t("sortAsc")}
                </SelectItem>
                <SelectItem value="desc">
                  <ArrowDown className="inline h-4 w-4 mr-1" />
                  {t("sortDesc")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {/* --- AutoSizer and List Wrapper --- */}
        <div className="flex-grow overflow-hidden">
          <AutoSizer>
            {({ height, width }) =>
              treeItemData && treeItemData.items.length > 0 ? ( // Check if items exist
                <VariableSizeList
                  ref={treeListRef}
                  height={height}
                  itemCount={treeItemData.items.length}
                  itemSize={getTreeItemSize}
                  width={width}
                  itemData={treeItemData}
                  overscanCount={10} // Increased overscan for smoother scrolling
                  estimatedItemSize={
                    TREE_ITEM_HEADER_HEIGHT + TREE_ITEM_CONTENT_LINE_HEIGHT * 10 // Increased estimated size for better initial rendering
                  }
                  // Optimized itemKey function to reduce string concatenation
                  itemKey={(index, data) => {
                    const item = data.items[index];
                    return item
                      ? `${item.filePath}-${itemDisplayVersion}-${highlightUpdateCounter}-${contentUpdateCounter}-${sortKey}-${sortDirection}`
                      : `index-${index}`;
                  }}
                  // Add useIsScrolling to optimize rendering during scrolling
                  useIsScrolling
                >
                  {TreeRow}
                </VariableSizeList>
              ) : structuredItems === null ? (
                // Loading skeleton when results are being fetched
                <div className="h-full w-full p-4 space-y-4">
                  {/* Skeleton items */}
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className="animate-pulse">
                      <div className="h-8 bg-muted/50 rounded-md mb-2 flex items-center">
                        <div className="w-4 h-4 ml-2 bg-muted rounded-sm"></div>
                        <div className="h-4 bg-muted rounded-md ml-4 w-3/4"></div>
                      </div>
                      {i % 3 === 0 && (
                        <div className="pl-10 space-y-2">
                          <div className="h-3 bg-muted/30 rounded-md w-full"></div>
                          <div className="h-3 bg-muted/30 rounded-md w-5/6"></div>
                          <div className="h-3 bg-muted/30 rounded-md w-4/6"></div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                // Display a message when no results match filters
                <div className="flex items-center justify-center h-full text-muted-foreground italic">
                  {/* Check if initial search yielded results before filtering */}
                  {structuredItems && structuredItems.length > 0
                    ? hasContentQuery
                      ? t("results:noContentMatches") // Content query ran, but no matches
                      : isFilterActive
                        ? t("results:noFilterMatches") // No content query, but fuzzy filter has no matches
                        : t("results:noResultsFound") // Should not happen if structuredItems has items and no filters active
                    : t("results:noResultsFound")}
                  {/* Initial search found nothing */}
                </div>
              )
            }
          </AutoSizer>
        </div>
      </div>
      {/* ---------------------------------------------------- */}

      {/* --- Selection Controls --- */}
      <div className="mt-4 flex flex-wrap gap-4 items-center shrink-0 border-b border-border pb-4">
        {/* Selection Count */}
        <div className="text-sm text-muted-foreground">
          {selectedFiles.size > 0
            ? t("selectedFilesCount", { count: selectedFiles.size })
            : ""}
        </div>
        {/* Select All Button */}
        <Button
          onClick={() => {
            if (sortedItems && sortedItems.length > 0) {
              dispatchSelection({
                type: "selectAll",
                filePaths: sortedItems.map((item) => item.filePath),
              });
            }
          }}
          disabled={!sortedItems || sortedItems.length === 0}
          variant="outline"
          size="sm"
        >
          <Check className="mr-2 h-4 w-4" />
          {t("selectAllLabel")}
        </Button>
        {/* Deselect All Button */}
        <Button
          onClick={() => dispatchSelection({ type: "deselectAll" })}
          disabled={selectedFiles.size === 0}
          variant="outline"
          size="sm"
        >
          <X className="mr-2 h-4 w-4" />
          {t("deselectAllLabel")}
        </Button>
      </div>

      {/* --- Export/Copy Area --- */}
      <div className="mt-4 flex flex-wrap gap-4 items-center shrink-0">
        {/* Format Select */}
        <div className="flex items-center gap-2">
          <Label htmlFor="exportFormatSelect" className="text-sm shrink-0">
            {t("exportFormatLabel")}
          </Label>
          <Select
            value={exportFormat}
            onValueChange={(value) => setExportFormat(value as ExportFormat)}
            disabled={
              !sortedItems ||
              sortedItems.length === 0 ||
              !!exportStatus ||
              !!copyStatus
            }
          >
            <SelectTrigger id="exportFormatSelect" className="w-[100px] h-9">
              <SelectValue placeholder={t("exportFormatLabel")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="txt">
                {t("results:exportFormatTXT")}
              </SelectItem>
              <SelectItem value="csv">
                {t("results:exportFormatCSV")}
              </SelectItem>
              <SelectItem value="json">
                {t("results:exportFormatJSON")}
              </SelectItem>
              <SelectItem value="md">{t("results:exportFormatMD")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* Copy Button */}
        <Button
          onClick={handleCopyResults}
          disabled={
            !sortedItems ||
            sortedItems.length === 0 ||
            !!copyStatus ||
            !!exportStatus
          }
          variant="outline"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copyStatus || t("copyButton")}
        </Button>
        {/* Save Button with Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              disabled={
                ((!sortedItems || sortedItems.length === 0) &&
                  selectedFiles.size === 0) ||
                !!exportStatus ||
                !!copyStatus ||
                !!batchStatus
              }
              variant="secondary"
            >
              {exportStatus || batchStatus || t("saveButtonLabel")}
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* Save All Results */}
            <DropdownMenuItem
              onClick={handleExport}
              disabled={
                !sortedItems ||
                sortedItems.length === 0 ||
                !!exportStatus ||
                !!copyStatus
              }
            >
              <Save className="mr-2 h-4 w-4" />
              {t("saveAllResultsLabel")}
            </DropdownMenuItem>

            {/* Export Selected/All */}
            <DropdownMenuItem
              onClick={() => {
                if (!sortedItems || sortedItems.length === 0) {
                  setExportStatus(t("exportButtonNoResults"));
                  setTimeout(() => setExportStatus(""), 3000);
                  return;
                }
                if (!window.electronAPI?.exportResults) {
                  setExportStatus(t("exportButtonError"));
                  setTimeout(() => setExportStatus(""), 3000);
                  return;
                }

                // Use selected files if any are selected, otherwise use all results
                const itemsToExport =
                  selectedFiles.size > 0
                    ? sortedItems.filter((item) =>
                        selectedFiles.has(item.filePath)
                      )
                    : sortedItems;

                setExportStatus(t("exportButtonExporting"));
                window.electronAPI
                  .exportResults(itemsToExport, exportFormat)
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
                  .catch((err) => {
                    setExportStatus(t("exportButtonError"));
                    console.error(
                      "Export failed:",
                      err instanceof Error ? err.message : err
                    );
                  })
                  .finally(() => {
                    setTimeout(() => setExportStatus(""), 5000);
                  });
              }}
              disabled={!sortedItems || sortedItems.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              {selectedFiles.size > 0
                ? t("exportSelectedLabel")
                : t("exportAllResultsLabel")}
            </DropdownMenuItem>

            {/* Copy Paths to Clipboard */}
            <DropdownMenuItem
              onClick={handleCopyFilePaths}
              disabled={!sortedItems || sortedItems.length === 0}
            >
              <ClipboardCopy className="mr-2 h-4 w-4" />
              {selectedFiles.size > 0
                ? t("copyPathsSelectedLabel")
                : t("copyPathsAllLabel")}
            </DropdownMenuItem>

            {/* Copy Files to Folder */}
            <DropdownMenuItem
              onClick={handleCopyFilesToFolder}
              disabled={!sortedItems || sortedItems.length === 0}
            >
              <Download className="mr-2 h-4 w-4" />
              {selectedFiles.size > 0
                ? t("copyFilesSelectedLabel")
                : t("copyFilesAllLabel")}
            </DropdownMenuItem>

            {/* Move Files to Folder */}
            <DropdownMenuItem
              onClick={handleMoveFilesToFolder}
              disabled={!sortedItems || sortedItems.length === 0}
            >
              <Upload className="mr-2 h-4 w-4" />
              {selectedFiles.size > 0
                ? t("moveFilesSelectedLabel")
                : t("moveFilesAllLabel")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {/* ----------------------------- */}
    </div>
  );
};

export default ResultsDisplay;
