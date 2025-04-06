import React from 'react';
import { useTranslation } from 'react-i18next';
import type { SearchHistoryEntry } from './vite-env.d';
import './HistoryModal.css'; // Share CSS with modal

interface HistoryListItemProps {
  entry: SearchHistoryEntry;
  onLoad: (entry: SearchHistoryEntry) => void;
  onDelete: (entryId: string) => void;
}

// Helper to format timestamp
const formatTimestamp = (isoString: string): string => {
  try {
    return new Date(isoString).toLocaleString();
  } catch (e) {
    return isoString; // Fallback
  }
};

// Helper to create a concise summary string
const createSummary = (params: SearchHistoryEntry['searchParams']): string => {
    let summary = params.searchPaths?.slice(0, 1).join(', ') ?? 'No paths';
    if (params.searchPaths && params.searchPaths.length > 1) {
        summary += ` (+${params.searchPaths.length - 1})`;
    }
    if (params.contentSearchTerm) {
        const term = params.contentSearchTerm.length > 50
            ? params.contentSearchTerm.substring(0, 47) + '...'
            : params.contentSearchTerm;
        summary += ` | Query: "${term}"`;
    } else if (params.structuredQuery) {
         summary += ` | Query: [Builder]`; // Indicate builder was used
    }
    return summary;
};

const HistoryListItem: React.FC<HistoryListItemProps> = ({ entry, onLoad, onDelete }) => {
  const { t } = useTranslation(['common']);

  const handleLoadClick = () => {
    onLoad(entry);
  };

  const handleDeleteClick = () => {
    onDelete(entry.id);
  };

  const summaryText = createSummary(entry.searchParams);

  return (
    <li className="history-list-item">
      <div className="history-item-summary" title={summaryText}>
        <span className="history-item-text">{summaryText}</span>
        <span className="history-item-timestamp">{formatTimestamp(entry.timestamp)}</span>
      </div>
      <div className="history-item-actions">
        <button onClick={handleLoadClick} className="history-item-button load">
          {t('historyLoadButton')}
        </button>
        <button onClick={handleDeleteClick} className="history-item-button delete">
          {t('historyDeleteButton')}
        </button>
      </div>
    </li>
  );
};

export default HistoryListItem;
