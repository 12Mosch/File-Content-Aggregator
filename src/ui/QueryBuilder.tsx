import React, { useState, useCallback, useEffect, useRef } from 'react'; // Import useRef
import { useTranslation } from 'react-i18next';
import QueryGroup from './QueryGroup';
import type { QueryGroup as QueryStructure } from './queryBuilderTypes';
import { generateId } from './queryBuilderUtils';
import './QueryBuilder.css';

interface QueryBuilderProps {
  onChange: (query: QueryStructure | null) => void;
  onCaseSensitivityChange: (isCaseSensitive: boolean) => void;
  initialQuery?: QueryStructure | null; // Accept initial query structure
  initialCaseSensitive?: boolean;
  disabled?: boolean;
}

// Helper to create a default empty root group
const createDefaultRootGroup = (): QueryStructure => ({
    id: generateId(),
    operator: 'AND',
    conditions: [],
    isRoot: true,
});

const QueryBuilder: React.FC<QueryBuilderProps> = ({
  onChange,
  onCaseSensitivityChange,
  initialQuery = null,
  initialCaseSensitive = false,
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);
  // Initialize state with props or default empty group
  const [rootGroup, setRootGroup] = useState<QueryStructure>(
    initialQuery || createDefaultRootGroup()
  );
  const [isCaseSensitive, setIsCaseSensitive] = useState(initialCaseSensitive);

  // Ref to track the ID of the query loaded via props
  const loadedQueryIdRef = useRef<string | null>(initialQuery?.id ?? null);

  // --- Effect to update internal state ONLY when initial props represent a NEW load ---
  useEffect(() => {
    const newQueryId = initialQuery?.id ?? null;
    // Only reset internal state if:
    // 1. There IS an initialQuery coming from props.
    // 2. EITHER there was no previously loaded query OR the new query ID is different from the last loaded one.
    // This prevents resetting the state if the parent re-renders but passes the same history item.
    // Also reset if initialQuery becomes null (e.g., form reset externally)
    if (initialQuery === null && loadedQueryIdRef.current !== null) {
        // Handle external reset: If prop becomes null, reset internal state
        setRootGroup(createDefaultRootGroup());
        setIsCaseSensitive(initialCaseSensitive); // Reset sensitivity too
        loadedQueryIdRef.current = null; // Update ref
    } else if (initialQuery && newQueryId !== loadedQueryIdRef.current) {
        // Handle loading a new history item
        console.log(`QueryBuilder: Loading new initialQuery (ID: ${newQueryId})`);
        setRootGroup(initialQuery);
        setIsCaseSensitive(initialCaseSensitive);
        loadedQueryIdRef.current = newQueryId; // Update ref to the newly loaded ID
    }
    // No dependency on initialCaseSensitive here, handled separately or with query load
  }, [initialQuery, initialCaseSensitive]); // Rerun if the initialQuery object reference or initialCaseSensitive changes
  // ---------------------------------------------------------------

  // Notify parent about query changes (made internally by the user)
  useEffect(() => {
    // Only notify if the change didn't originate from the initial prop load effect
    // Check if the current rootGroup ID matches the last loaded ID. If they DON'T match,
    // it means the user has modified it internally, OR it was reset to default.
    if (rootGroup.id !== loadedQueryIdRef.current || !initialQuery) {
         onChange(rootGroup.conditions.length > 0 ? rootGroup : null);
    }
  }, [rootGroup, onChange, initialQuery]); // Notify when internal rootGroup changes

  // Notify parent about case sensitivity changes
  useEffect(() => {
    // Only notify if the change didn't originate from the initial prop load effect
    // We compare the internal state `isCaseSensitive` with the prop `initialCaseSensitive`
    // This isn't perfect if the prop changes *after* initial load for other reasons,
    // but it's a reasonable check for history loading.
    // A better approach might involve tracking if the sensitivity was *just* set by the effect.
    // For now, let's assume the prop only changes significantly on history load.
    // We can directly call the handler in the toggle function for immediate feedback.
    // onCaseSensitivityChange(isCaseSensitive); // This might cause loops if parent updates prop based on it
  }, [isCaseSensitive, onCaseSensitivityChange]);


  const handleRootGroupChange = useCallback((updatedGroup: QueryStructure) => {
    // When the user changes the group internally, update the state.
    // This change should NOT match the loadedQueryIdRef anymore.
    setRootGroup(updatedGroup);
  }, []);

  const handleCaseSensitiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newSensitivity = e.target.checked;
    setIsCaseSensitive(newSensitivity);
    // Directly notify parent on user interaction
    onCaseSensitivityChange(newSensitivity);
  };

  // Determine if the case sensitive checkbox should be shown
  const hasTermCondition = (group: QueryStructure): boolean => {
    // Make sure group and conditions exist before checking
    if (!group?.conditions) return false;
    return group.conditions.some(item => {
      if (!item) return false; // Add null check for item
      if ('operator' in item) {
        return hasTermCondition(item); // Recurse into subgroups
      } else {
        return item.type === 'term'; // Check condition type
      }
    });
  };
  const showCaseSensitiveCheckbox = hasTermCondition(rootGroup);


  return (
    <div className={`query-builder-container ${disabled ? 'disabled' : ''}`}>
      <QueryGroup
        group={rootGroup}
        onChange={handleRootGroupChange}
        level={0}
        isRoot={true}
        disabled={disabled}
      />
      {showCaseSensitiveCheckbox && (
         <div className="query-builder-options">
            <div className="form-group-checkbox query-builder-case-sensitive">
                <input
                    type="checkbox"
                    id="queryBuilderCaseSensitive"
                    checked={isCaseSensitive}
                    onChange={handleCaseSensitiveToggle}
                    disabled={disabled}
                    className="form-checkbox"
                />
                <label htmlFor="queryBuilderCaseSensitive" className="form-checkbox-label">
                    {t('caseSensitiveLabel')}
                </label>
            </div>
        </div>
      )}
    </div>
  );
};

export default QueryBuilder;
