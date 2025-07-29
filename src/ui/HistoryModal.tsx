import React, { useState, useMemo /*, useCallback */ } from "react"; // Removed unused useCallback
import { useTranslation } from "react-i18next";
import HistoryListItem from "./HistoryListItem";
import type { SearchHistoryEntry } from "./vite-env.d";
import useDebounce from "./hooks/useDebounce";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription, // <-- Import DialogDescription
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription as AlertDialogDesc, // Alias if needed, but usually fine
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryEntry[];
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onClear: () => void;
  onUpdateEntry: (
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>
  ) => void;
}

const HISTORY_FILTER_DEBOUNCE = 300;

// Helper to create a searchable string (remains the same)
const createSearchableString = (entry: SearchHistoryEntry): string => {
  const name = entry.name ?? "";
  const params = entry.searchParams;
  const searchableParams = [
    name,
    params.searchPaths?.join(" ") ?? "",
    params.extensions?.join(" ") ?? "",
    params.excludeFiles?.join(" ") ?? "",
    params.excludeFolders?.join(" ") ?? "",
    params.contentSearchTerm ?? "",
    params.modifiedAfter ?? "",
    params.modifiedBefore ?? "",
    params.maxDepth?.toString() ?? "",
  ];
  return searchableParams.join(" ").toLowerCase();
};

const HistoryModal: React.FC<HistoryModalProps> = ({
  isOpen,
  onClose,
  history,
  onLoad,
  onDelete,
  onClear,
  onUpdateEntry,
}) => {
  const { t } = useTranslation(["common"]);
  const [filterTerm, setFilterTerm] = useState("");
  const debouncedFilterTerm = useDebounce(filterTerm, HISTORY_FILTER_DEBOUNCE);

  // Filter and sort history entries (remains the same logic)
  const filteredAndSortedHistory = useMemo(() => {
    /* ... */ const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim();
    const filtered = lowerCaseFilter
      ? history.filter((entry) =>
          createSearchableString(entry).includes(lowerCaseFilter)
        )
      : history;
    return filtered.sort((a, b) => {
      if (a.isFavorite && !b.isFavorite) return -1;
      if (!a.isFavorite && b.isFavorite) return 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [history, debouncedFilterTerm]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterTerm(e.target.value);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
      setFilterTerm("");
    }
  };

  const handleConfirmClear = () => {
    console.log("Clear confirmed in modal, calling onClear prop");
    onClear();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col sm:max-w-3xl">
        {/* Add DialogDescription inside DialogHeader */}
        <DialogHeader className="pr-12">
          <DialogTitle>{t("historyTitle")}</DialogTitle>
          {/* Add the description here */}
          <DialogDescription>{t("historyDescription")}</DialogDescription>
          {/* Filter Input remains below description */}
          <div className="pt-2">
            <Input
              type="text"
              placeholder={t("historyFilterPlaceholder")}
              value={filterTerm}
              onChange={handleFilterChange}
              className="w-full"
            />
          </div>
        </DialogHeader>

        {/* Scrollable Body Area */}
        <div className="-mx-1 flex-grow overflow-y-auto px-1 py-4">
          {history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("historyEmpty")}
            </p>
          ) : filteredAndSortedHistory.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("historyNoResults")}
            </p>
          ) : (
            <ul className="space-y-1">
              {filteredAndSortedHistory.map((entry) => (
                <HistoryListItem
                  key={entry.id}
                  entry={entry}
                  onLoad={onLoad}
                  onDelete={onDelete}
                  onUpdate={onUpdateEntry}
                />
              ))}
            </ul>
          )}
        </div>

        {/* DialogFooter with AlertDialog */}
        <DialogFooter className="gap-2 sm:justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                disabled={history.length === 0}
                size="sm"
              >
                {t("historyClearAllButton")}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("historyClearConfirmTitle")}
                </AlertDialogTitle>
                {/* Use the specific AlertDialogDesc component here */}
                <AlertDialogDesc>
                  {t("historyClearConfirmMessage")} <br />
                  <span className="font-medium text-destructive">
                    This action{" "}
                    <strong className="text-lg font-bold tracking-tight uppercase">
                      cannot
                    </strong>{" "}
                    be undone.
                  </span>
                </AlertDialogDesc>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel asChild>
                  <Button variant="outline" size="sm">
                    {t("dialogCancel")}
                  </Button>
                </AlertDialogCancel>
                <AlertDialogAction asChild>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleConfirmClear}
                  >
                    {t("dialogConfirm")}
                  </Button>
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DialogClose asChild>
            <Button type="button" variant="secondary" size="sm">
              {t("closeButton")}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryModal;
