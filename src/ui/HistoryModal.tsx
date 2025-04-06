import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import HistoryListItem from './HistoryListItem'; // Child component
import type { SearchHistoryEntry } from './vite-env.d';
import useDebounce from './hooks/useDebounce';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button";

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: SearchHistoryEntry[];
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
  onClear: () => void;
  onUpdateEntry: (entryId: string, updates: Partial<Pick<SearchHistoryEntry, 'name' | 'isFavorite'>>) => void;
}

const HISTORY_FILTER_DEBOUNCE = 300; // ms

// Helper to create a searchable string (remains the same)
const createSearchableString = (entry: SearchHistoryEntry): string => {
    const name = entry.name ?? '';
    const params = entry.searchParams;
    const searchableParams = [ name, params.searchPaths?.join(' ') ?? '', params.extensions?.join(' ') ?? '', params.excludeFiles?.join(' ') ?? '', params.excludeFolders?.join(' ') ?? '', params.contentSearchTerm ?? '', params.modifiedAfter ?? '', params.modifiedBefore ?? '', params.maxDepth?.toString() ?? '', ];
    return searchableParams.join(' ').toLowerCase();
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
  const { t } = useTranslation(['common']);
  const [filterTerm, setFilterTerm] = useState('');
  const debouncedFilterTerm = useDebounce(filterTerm, HISTORY_FILTER_DEBOUNCE);

  // Filter and sort history entries (remains the same logic)
  const filteredAndSortedHistory = useMemo(() => {
    const lowerCaseFilter = debouncedFilterTerm.toLowerCase().trim();
    const filtered = lowerCaseFilter
      ? history.filter(entry => createSearchableString(entry).includes(lowerCaseFilter))
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

  // Use the Dialog's controlled state handler
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose(); // Call the parent's close handler
      setFilterTerm(''); // Reset filter on close
    }
  };

  return (
    // Use shadcn Dialog component
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {/* DialogContent handles overlay, centering, and base styling */}
      {/* Increase max-width for history view */}
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        {/* DialogHeader */}
        <DialogHeader className="pr-12"> {/* Add padding to prevent overlap with default close button */}
          <DialogTitle>{t('historyTitle')}</DialogTitle>
          {/* Filter Input within the header area or just below */}
           <div className="pt-2"> {/* Add some spacing */}
             <Input
                  type="text"
                  placeholder={t('historyFilterPlaceholder')}
                  value={filterTerm}
                  onChange={handleFilterChange}
                  className="w-full" // Take full width available
              />
           </div>
        </DialogHeader>

        {/* Scrollable Body Area */}
        {/* Use Tailwind classes for layout and scrolling */}
        <div className="flex-grow overflow-y-auto py-4 px-1 -mx-1"> {/* Negative margin to counter padding */}
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm">{t('historyEmpty')}</p>
          ) : filteredAndSortedHistory.length === 0 ? (
             <p className="text-center text-muted-foreground text-sm">{t('historyNoResults')}</p>
          ) : (
            // Apply Tailwind list styling if needed, or rely on item styling
            <ul className="space-y-1"> {/* Vertical spacing between items */}
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

        {/* DialogFooter */}
        <DialogFooter className="sm:justify-between gap-2"> {/* Justify between on larger screens */}
          {/* Clear Button */}
          <Button
            variant="destructive" // Use destructive variant
            onClick={onClear}
            disabled={history.length === 0}
            size="sm" // Smaller size
          >
            {t('historyClearAllButton')}
          </Button>
          {/* Close Button (using DialogClose for automatic closing) */}
          <DialogClose asChild>
            <Button type="button" variant="secondary" size="sm">
              {t('closeButton')}
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default HistoryModal;
