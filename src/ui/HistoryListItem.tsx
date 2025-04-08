import React, { useState, useRef, useEffect } from "react"; // Removed unused useCallback
import { useTranslation } from "react-i18next";
import type { SearchHistoryEntry } from "./vite-env.d";
import useDebounce from "./hooks/useDebounce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Star, Trash2, Pencil, Check, X, History } from "lucide-react";
import { cn } from "@/lib/utils";

interface HistoryListItemProps {
  entry: SearchHistoryEntry;
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onUpdate: (
    entryId: string,
    updates: Partial<Pick<SearchHistoryEntry, "name" | "isFavorite">>,
  ) => void;
}

const NAME_SAVE_DEBOUNCE = 750; // ms

// Helper to format timestamp (unchanged)
const formatTimestamp = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch (_e) { // Prefix unused 'e' with underscore
    return isoString;
  }
};

// Helper to create a concise summary string (unchanged)
const createSummary = (params: SearchHistoryEntry["searchParams"]): string => {
  let summary = params.searchPaths?.slice(0, 1).join(", ") ?? "No paths";
  if (params.searchPaths && params.searchPaths.length > 1)
    summary += ` (+${params.searchPaths.length - 1})`;
  if (params.contentSearchTerm) {
    const term =
      params.contentSearchTerm.length > 50
        ? params.contentSearchTerm.substring(0, 47) + "..."
        : params.contentSearchTerm;
    summary += ` | Query: "${term}"`;
  } else if (params.structuredQuery) summary += ` | Query: [Builder]`;
  return summary;
};

const HistoryListItem: React.FC<HistoryListItemProps> = ({
  entry,
  onLoad,
  onDelete,
  onUpdate,
}) => {
  const { t } = useTranslation(["common"]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [currentName, setCurrentName] = useState(entry.name ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Debounce the name before calling the update function (for auto-save feel)
  const debouncedName = useDebounce(currentName, NAME_SAVE_DEBOUNCE);

  // Effect to auto-save the debounced name while editing
  useEffect(() => {
    if (isEditingName && debouncedName !== (entry.name ?? "")) {
      // Auto-save without closing edit mode
      onUpdate(entry.id, { name: debouncedName });
    }
    // Only depend on debouncedName for auto-saving while editing
  }, [debouncedName, entry.id, entry.name, onUpdate, isEditingName]);

  // Effect to focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleLoadClick = () => onLoad(entry);
  const handleDeleteClick = () => onDelete(entry.id);

  const handleToggleFavorite = () => {
    onUpdate(entry.id, { isFavorite: !entry.isFavorite });
  };

  const handleEditNameClick = () => {
    if (!isEditingName) {
      setCurrentName(entry.name ?? ""); // Ensure currentName is fresh when starting edit
      setIsEditingName(true);
    }
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentName(e.target.value);
  };

  // Save changes explicitly (e.g., on Check button click or Enter key)
  const saveNameChange = () => {
    if (currentName !== (entry.name ?? "")) {
      onUpdate(entry.id, { name: currentName });
    }
    setIsEditingName(false);
  };

  // Cancel editing (e.g., on X button click or Escape key)
  const cancelNameEdit = () => {
    setCurrentName(entry.name ?? ""); // Revert to original name
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      saveNameChange();
    } else if (e.key === "Escape") {
      cancelNameEdit();
    }
  };

  const summaryText = createSummary(entry.searchParams);
  const displayName = entry.name || t("historyUntitled");

  return (
    // Apply Tailwind classes for list item layout, padding, border, and conditional favorite styling
    <li
      className={cn(
        "flex items-center gap-2 px-2 py-2 border-b border-border", // Base layout and border
        "hover:bg-muted/50 transition-colors duration-150", // Hover effect
        entry.isFavorite && "bg-primary/10 hover:bg-primary/20", // Favorite background
      )}
    >
      {/* Favorite Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleFavorite}
        className={cn(
          "h-7 w-7 shrink-0 text-muted-foreground hover:text-amber-500", // Base style
          entry.isFavorite && "text-amber-400 hover:text-amber-600", // Style when favorited
        )}
        title={entry.isFavorite ? t("historyUnfavorite") : t("historyFavorite")}
        aria-label={
          entry.isFavorite ? t("historyUnfavorite") : t("historyFavorite")
        }
      >
        <Star className={cn("h-4 w-4", entry.isFavorite && "fill-current")} />{" "}
        {/* Conditional fill */}
      </Button>

      {/* Main Content Area */}
      <div className="flex-grow flex flex-col gap-0.5 overflow-hidden">
        {/* Name Display/Input Area */}
        <div className="flex items-center gap-1">
          {isEditingName ? (
            <>
              <Input
                ref={nameInputRef}
                type="text"
                value={currentName}
                onChange={handleNameChange}
                onKeyDown={handleNameKeyDown}
                // Removed onBlur auto-save in favor of explicit actions
                className="h-6 px-1 py-0 text-sm font-medium flex-grow" // Compact input style
                placeholder={t("historyNamePlaceholder")}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={saveNameChange}
                className="h-6 w-6 text-green-500 hover:text-green-600"
                aria-label="Save name"
              >
                <Check className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={cancelNameEdit}
                className="h-6 w-6 text-destructive hover:text-destructive/80"
                aria-label="Cancel edit name"
              >
                <X className="h-4 w-4" />
              </Button>
            </>
          ) : (
            // Display Name (Clickable to edit)
            <span
              className={cn(
                "text-sm font-medium text-foreground truncate cursor-pointer hover:underline decoration-dotted", // Base style
                !entry.name && "italic text-muted-foreground", // Style for untitled
              )}
              onClick={handleEditNameClick}
              title={t("historyEditNameTooltip")}
            >
              {displayName}
            </span>
          )}
          {/* Edit Icon (only shown when not editing) */}
          {!isEditingName && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditNameClick}
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              aria-label="Edit name"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          )}
        </div>

        {/* Timestamp and Summary */}
        <span
          className="text-xs text-muted-foreground truncate"
          title={summaryText}
        >
          {formatTimestamp(entry.timestamp)} - {summaryText}
        </span>
      </div>

      {/* Action Buttons Area */}
      <div className="flex gap-1 shrink-0">
        {/* Load Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLoadClick}
          className="h-7 px-2"
          title={t("historyLoadButton")}
        >
          <History className="h-3.5 w-3.5 mr-1" /> {/* Load icon */}
          {t("historyLoadButton")}
        </Button>
        {/* Delete Button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDeleteClick}
          className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
          title={t("historyDeleteButton")}
          aria-label={t("historyDeleteButton")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </li>
  );
};

export default HistoryListItem;
