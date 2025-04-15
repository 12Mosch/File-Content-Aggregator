import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import SearchForm from "./SearchForm";
import ResultsDisplay from "./ResultsDisplay";
import ProgressBar from "./ProgressBar";
import SettingsModal from "./SettingsModal";
import HistoryButton from "./HistoryButton";
import HistoryModal from "./HistoryModal";
import useDebounce from "./hooks/useDebounce";
import type {
  ProgressData,
  SearchResult,
  FileReadError,
  StructuredItem,
  SearchHistoryEntry,
  SearchParams,
  QueryStructure, // Import QueryStructure type
} from "./vite-env.d";
import { generateId } from "./queryBuilderUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

import "./index.css";

type GroupedErrors = { [reasonKey: string]: string[] };
interface ItemDisplayState {
  expanded: boolean;
  showFull: boolean;
}
type ItemDisplayStates = Map<string, ItemDisplayState>;
const FILTER_DEBOUNCE_DELAY = 300;

function App() {
  const { t } = useTranslation(["common", "errors", "results", "form"]);

  // State for the original, unfiltered results from the backend
  const [structuredResults, setStructuredResults] = useState<
    StructuredItem[] | null
  >(null);
  const [searchSummary, setSearchSummary] = useState<{
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  } | null>(null);
  const [pathErrors, setPathErrors] = useState<string[]>([]);
  const [fileReadErrors, setFileReadErrors] = useState<FileReadError[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<ProgressData | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [itemDisplayStates, setItemDisplayStates] = useState<ItemDisplayStates>(
    new Map()
  );
  const [itemDisplayVersion, setItemDisplayVersion] = useState(0);
  // State for the raw filter input
  const [resultsFilterTerm, setResultsFilterTerm] = useState<string>("");
  // State for filter case sensitivity
  const [resultsFilterCaseSensitive, setResultsFilterCaseSensitive] =
    useState<boolean>(false);
  // Debounced filter term to pass down to ResultsDisplay
  const debouncedFilterTerm = useDebounce(
    resultsFilterTerm,
    FILTER_DEBOUNCE_DELAY
  );
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>([]);
  const [historyEntryToLoad, setHistoryEntryToLoad] =
    useState<SearchHistoryEntry | null>(null);
  // State to store the query structure used for the last search
  const [lastSearchQueryStructure, setLastSearchQueryStructure] =
    useState<QueryStructure | null>(null);
  // State to store the case sensitivity used for the last search query
  const [lastSearchQueryCaseSensitive, setLastSearchQueryCaseSensitive] =
    useState<boolean>(false);
  // State to store the direct search terms for highlighting
  const [searchHighlightTerms, setSearchHighlightTerms] = useState<string[]>(
    []
  );

  const groupedFileReadErrors: GroupedErrors = useMemo(() => {
    return fileReadErrors.reduce((acc, error) => {
      const reasonKey = error.reason || "unknownError";
      if (!acc[reasonKey]) {
        acc[reasonKey] = [];
      }
      acc[reasonKey].push(error.filePath);
      return acc;
    }, {} as GroupedErrors);
  }, [fileReadErrors]);

  useEffect(() => {
    if (window.electronAPI?.onSearchProgress) {
      const unsubscribe = window.electronAPI.onSearchProgress(
        (data: ProgressData) => setProgress(data)
      );
      return unsubscribe;
    } else {
      setGeneralError(t("errors:connectError"));
    }
  }, [t]);

  const fetchHistory = useCallback(async () => {
    if (window.electronAPI?.getSearchHistory) {
      try {
        const history = await window.electronAPI.getSearchHistory();
        setSearchHistory(history);
        return history;
      } catch (err: unknown) {
        console.error(
          "UI: Failed to fetch search history:",
          err instanceof Error ? err.message : err
        );
        setGeneralError(t("errors:historyFetchFailed"));
        return [];
      }
    } else {
      console.warn("UI: getSearchHistory API not available.");
      setGeneralError(t("errors:historyApiNA"));
      return [];
    }
  }, [t]);

  const openHistoryModal = useCallback(async () => {
    await fetchHistory();
    setIsHistoryOpen(true);
  }, [fetchHistory]);

  const closeHistoryModal = () => setIsHistoryOpen(false);

  const handleLoadSearchFromHistory = useCallback(
    (entry: SearchHistoryEntry) => {
      setHistoryEntryToLoad(entry);
      closeHistoryModal();
    },
    []
  );

  const handleHistoryLoadComplete = useCallback(() => {
    setHistoryEntryToLoad(null);
  }, []);

  const handleDeleteHistoryEntry = useCallback(
    async (entryId: string) => {
      if (window.electronAPI?.deleteSearchHistoryEntry) {
        try {
          await window.electronAPI.deleteSearchHistoryEntry(entryId);
          setSearchHistory((prev) =>
            prev.filter((entry) => entry.id !== entryId)
          );
        } catch (err: unknown) {
          console.error(
            "UI: Failed to delete history entry:",
            err instanceof Error ? err.message : err
          );
          setGeneralError(t("errors:historyDeleteFailed"));
        }
      } else {
        setGeneralError(t("errors:historyApiNA"));
      }
    },
    [t]
  );

  const handleClearHistory = useCallback(async () => {
    if (window.electronAPI?.clearSearchHistory) {
      try {
        const success = await window.electronAPI.clearSearchHistory();
        if (success) {
          setSearchHistory([]);
          console.log("UI: History cleared successfully.");
        } else {
          console.log(
            "UI: History clear cancelled by user or failed in backend."
          );
        }
      } catch (err: unknown) {
        console.error(
          "UI: Failed to clear history:",
          err instanceof Error ? err.message : err
        );
        setGeneralError(t("errors:historyClearFailed"));
      }
    } else {
      setGeneralError(t("errors:historyApiNA"));
    }
  }, [t]);

  const handleUpdateHistoryEntry = useCallback(
    async (
      entryId: string,
      updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
    ) => {
      if (window.electronAPI?.updateSearchHistoryEntry) {
        try {
          const success = await window.electronAPI.updateSearchHistoryEntry(
            entryId,
            updates
          );
          if (success) {
            setSearchHistory((prev) =>
              prev.map((entry) =>
                entry.id === entryId ? { ...entry, ...updates } : entry
              )
            );
          } else {
            console.warn(
              `UI: Failed to update history entry ${entryId} in backend.`
            );
            setGeneralError(t("errors:historyUpdateFailed"));
          }
        } catch (err: unknown) {
          console.error(
            `UI: Error updating history entry ${entryId}:`,
            err instanceof Error ? err.message : err
          );
          setGeneralError(t("errors:historyUpdateFailed"));
        }
      } else {
        console.warn("UI: updateSearchHistoryEntry API not available.");
        setGeneralError(t("errors:historyApiNA"));
      }
    },
    [t]
  );

  const handleSearchSubmit = useCallback(
    async (params: SearchParams) => {
      setIsLoading(true);
      setStructuredResults(null);
      setSearchSummary(null);
      setPathErrors([]);
      setFileReadErrors([]);
      setItemDisplayStates(new Map());
      setItemDisplayVersion(0);
      setProgress({ processed: 0, total: 0, message: "Starting search..." });
      setGeneralError(null);
      setResultsFilterTerm(""); // Reset filter on new search

      // Store the query structure and case sensitivity used for this search
      setLastSearchQueryStructure(params.structuredQuery ?? null);
      setLastSearchQueryCaseSensitive(params.caseSensitive ?? false); // Store case sensitivity

      // Log the search parameters for debugging
      console.log("Search params:", params);

      // Extract search terms for highlighting
      const highlightTerms: string[] = [];

      // First try to get terms from contentSearchTerm
      if (params.contentSearchTerm) {
        console.log("Content search term:", params.contentSearchTerm);
        // If the content search term is a quoted string like "database", extract the term
        const quotedMatch = params.contentSearchTerm.match(/^"(.+)"$/);
        if (quotedMatch && quotedMatch[1]) {
          const extractedTerm = quotedMatch[1].trim();
          console.log(
            "Extracted content term from backend param:",
            extractedTerm
          );
          if (extractedTerm) {
            highlightTerms.push(extractedTerm);
          }
        } else {
          // If not quoted, use the raw term
          const rawTerm = params.contentSearchTerm.trim();
          if (rawTerm) {
            highlightTerms.push(rawTerm);
          }
        }
      }

      // Also try to extract terms from structured query if available
      if (params.structuredQuery) {
        try {
          // Extract terms from term conditions
          const extractTermsFromConditions = (conditions: any[]) => {
            conditions.forEach((cond) => {
              if (cond && typeof cond === "object") {
                if (
                  "type" in cond &&
                  cond.type === "term" &&
                  typeof cond.value === "string" &&
                  cond.value.trim()
                ) {
                  highlightTerms.push(cond.value.trim());
                } else if (
                  "conditions" in cond &&
                  Array.isArray(cond.conditions)
                ) {
                  extractTermsFromConditions(cond.conditions);
                }
              }
            });
          };

          if (
            params.structuredQuery.conditions &&
            Array.isArray(params.structuredQuery.conditions)
          ) {
            extractTermsFromConditions(params.structuredQuery.conditions);
          }
        } catch (err) {
          console.warn("Error extracting terms from structured query:", err);
        }
      }

      // Store the extracted terms for highlighting
      console.log("Setting search highlight terms:", highlightTerms);
      setSearchHighlightTerms(highlightTerms);

      if (
        window.electronAPI?.addSearchHistoryEntry &&
        params.searchPaths.length > 0
      ) {
        const historyEntry: SearchHistoryEntry = {
          id: generateId(),
          timestamp: new Date().toISOString(),
          searchParams: { ...params },
        };
        try {
          await window.electronAPI.addSearchHistoryEntry(historyEntry);
        } catch (err: unknown) {
          console.error(
            "UI: Failed to save search to history:",
            err instanceof Error ? err.message : err
          );
        }
      }

      try {
        if (!window.electronAPI?.invokeSearch)
          throw new Error(t("errors:searchFunctionNA"));
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { structuredQuery, ...backendParams } = params;
        const searchResult: SearchResult =
          await window.electronAPI.invokeSearch(backendParams);

        setStructuredResults(searchResult.structuredItems); // Set the original results
        setSearchSummary({
          filesFound: searchResult.filesFound,
          filesProcessed: searchResult.filesProcessed,
          errorsEncountered: searchResult.errorsEncountered,
        });
        const translatedPathErrors = searchResult.pathErrors.map((err) => {
          // Keep existing translations, add more if needed for new error types
          if (err.startsWith("Search path not found:"))
            return t("errors:pathNotFound", {
              path: err.substring("Search path not found:".length).trim(),
            });
          if (err.startsWith("Search path is not a directory:"))
            return t("errors:pathNotDir", {
              path: err
                .substring("Search path is not a directory:".length)
                .trim(),
            });
          if (err.startsWith("Permission denied for search path:"))
            return t("errors:pathPermissionDenied", {
              path: err
                .substring("Permission denied for search path:".length)
                .trim(),
            });
          if (err.startsWith("Invalid boolean query syntax:"))
            return t("errors:invalidBooleanQuery", {
              detail: err
                .substring("Invalid boolean query syntax:".length)
                .trim(),
            });
          if (err.startsWith("Invalid regular expression pattern:"))
            return t("errors:invalidRegexPattern", {
              pattern: err
                .substring("Invalid regular expression pattern:".length)
                .trim(),
            });
          // Add translation for the filtered traversal error
          if (err.startsWith("Traversal error in")) {
            const match = err.match(
              /Traversal error in "(.*?)": Permission denied for "(.*?)".*/
            );
            if (match) {
              return t("errors:pathTraversalPermissionDenied", {
                searchPath: match[1],
                errorPath: match[2],
              });
            }
          }
          return err; // Fallback for untranslated errors
        });
        setPathErrors(translatedPathErrors);
        setFileReadErrors(searchResult.fileReadErrors);
        setProgress((prev) => ({
          ...(prev ?? { processed: 0, total: 0 }),
          processed: searchResult.filesProcessed,
          total:
            searchResult.filesProcessed > 0
              ? searchResult.filesProcessed
              : (prev?.total ?? 0),
          message: `Search complete. Processed ${searchResult.filesProcessed} files.`,
        }));
      } catch (err: unknown) {
        console.error("UI: Search failed:", err);
        setGeneralError(
          t("errors:generalSearchFailed", {
            detail: err instanceof Error ? err.message : "Unknown error",
          })
        );
        setProgress(null);
      } finally {
        setIsLoading(false);
      }
    },
    [t]
  );

  const openSettings = () => setIsSettingsOpen(true);
  const closeSettings = () => setIsSettingsOpen(false);

  const updateItemDisplayState = useCallback(
    (updater: (prevMap: ItemDisplayStates) => ItemDisplayStates) => {
      setItemDisplayStates((prevMap) => {
        const newMap = updater(prevMap);
        if (newMap !== prevMap) {
          setItemDisplayVersion((v) => v + 1);
          return newMap;
        }
        return prevMap;
      });
    },
    []
  );

  const handleToggleExpand = useCallback(
    (filePath: string) => {
      updateItemDisplayState((prevMap) => {
        const newMap = new Map(prevMap);
        const currentState = newMap.get(filePath);
        if (currentState?.expanded) newMap.delete(filePath);
        else newMap.set(filePath, { expanded: true, showFull: false });
        return newMap;
      });
    },
    [updateItemDisplayState]
  );

  const handleShowFullContent = useCallback(
    (filePath: string) => {
      updateItemDisplayState((prevMap) => {
        const currentState = prevMap.get(filePath);
        if (currentState?.expanded && !currentState.showFull) {
          const newMap = new Map(prevMap);
          newMap.set(filePath, { ...currentState, showFull: true });
          return newMap;
        }
        return prevMap;
      });
    },
    [updateItemDisplayState]
  );

  // Determine if the filter input has content (used by ResultsDisplay)
  const isFilterActive = debouncedFilterTerm.trim().length > 0;

  // Removed: filteredStructuredResults useMemo hook is no longer needed here

  return (
    <div className="container mx-auto p-4 md:p-6 lg:p-8 max-w-screen-xl flex flex-col gap-6">
      <header className="flex justify-between items-center pb-4 border-b border-border">
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight">
          {t("common:appName")}
        </h1>
        <div className="flex items-center gap-2">
          <HistoryButton
            onClick={() => {
              void openHistoryModal();
            }}
            disabled={isLoading}
          />
          <Button
            variant="outline"
            size="icon"
            onClick={openSettings}
            aria-label={t("common:settings")}
            disabled={isLoading}
          >
            <span role="img" aria-hidden="true">
              ⚙️
            </span>
          </Button>
        </div>
      </header>

      <main className="flex flex-col gap-6">
        <SearchForm
          onSubmit={(params) => {
            void handleSearchSubmit(params);
          }}
          isLoading={isLoading}
          historyEntryToLoad={historyEntryToLoad}
          onLoadComplete={handleHistoryLoadComplete}
        />

        {generalError && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
            <p>
              <span className="font-medium">
                {t("errors:generalErrorPrefix")}
              </span>{" "}
              {generalError}
            </p>
          </div>
        )}
        {pathErrors.length > 0 && (
          <div className="p-4 rounded-md bg-yellow-900/10 border border-yellow-700/30 text-yellow-200">
            <h4 className="font-medium mb-2">
              {t("errors:pathErrorsHeading")}
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              {pathErrors.map((err, i) => (
                <li key={`path-err-${i}`}>{err}</li>
              ))}
            </ul>
          </div>
        )}
        {fileReadErrors.length > 0 && (
          <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
            <h4 className="font-medium mb-2">
              {t("errors:fileReadErrorsHeading", {
                count: fileReadErrors.length,
              })}
            </h4>
            {Object.entries(groupedFileReadErrors).map(([key, paths]) => (
              <div
                key={key}
                className="mt-2 pl-2 border-l-2 border-destructive/50"
              >
                <h5 className="font-medium text-sm mb-1">
                  {t(`errors:${key}`, {
                    defaultValue: key,
                    count: paths.length,
                  })}
                  :
                </h5>
                <ul className="list-disc list-inside space-y-1 text-xs break-all">
                  {paths.map((p, i) => (
                    <li key={`${key}-${i}`}>{p}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {isLoading && progress && <ProgressBar {...progress} />}

        {/* Filter controls are now part of the results section */}
        {!isLoading && structuredResults !== null && searchSummary && (
          <section className="flex flex-col gap-4 mt-4">
            {/* Filter Input Section */}
            <div className="flex flex-wrap items-center gap-4 p-3 bg-card border border-border rounded-lg">
              <Label
                htmlFor="resultsFilterInput"
                className="text-sm font-medium text-muted-foreground shrink-0"
              >
                {t("results:filterResultsLabel")}
              </Label>
              <Input
                type="text"
                id="resultsFilterInput"
                value={resultsFilterTerm} // Use the raw input value here
                onChange={(e) => setResultsFilterTerm(e.target.value)}
                placeholder={t("results:filterResultsPlaceholder")}
                className="flex-grow min-w-[200px] h-9"
              />
              <div className="flex items-center space-x-2 shrink-0">
                <Checkbox
                  id="resultsFilterCaseSensitive"
                  checked={resultsFilterCaseSensitive}
                  onCheckedChange={(checked) =>
                    setResultsFilterCaseSensitive(Boolean(checked))
                  }
                />
                <Label
                  htmlFor="resultsFilterCaseSensitive"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {t("results:filterCaseSensitiveLabel")}
                </Label>
              </div>
            </div>

            {/* Pass original results, debounced filter term, query structure, and case sensitivity */}
            <ResultsDisplay
              structuredItems={structuredResults}
              summary={searchSummary}
              viewMode="tree" // Hardcode to tree view
              itemDisplayStates={itemDisplayStates}
              itemDisplayVersion={itemDisplayVersion}
              onToggleExpand={handleToggleExpand}
              onShowFullContent={handleShowFullContent}
              isFilterActive={isFilterActive}
              filterTerm={debouncedFilterTerm} // Pass debounced term for path highlighting
              filterCaseSensitive={resultsFilterCaseSensitive} // Pass case sensitivity for path highlighting
              searchQueryStructure={lastSearchQueryStructure} // Pass the query structure for content highlighting
              searchQueryCaseSensitive={lastSearchQueryCaseSensitive} // Pass the query case sensitivity
              searchHighlightTerms={searchHighlightTerms} // Pass the direct search terms for highlighting
            />
          </section>
        )}
      </main>

      <SettingsModal isOpen={isSettingsOpen} onClose={closeSettings} />
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={closeHistoryModal}
        history={searchHistory}
        onLoad={handleLoadSearchFromHistory}
        onDelete={(id) => {
          void handleDeleteHistoryEntry(id);
        }}
        onClear={() => {
          void handleClearHistory();
        }}
        onUpdateEntry={(id, updates) => {
          void handleUpdateHistoryEntry(id, updates);
        }}
      />
    </div>
  );
}

export default App;
