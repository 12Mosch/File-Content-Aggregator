// D:/Code/Electron/src/ui/QueryBuilder.tsx
import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import QueryGroup from './QueryGroup';
import type { QueryGroup as QueryStructure } from './queryBuilderTypes';
import { generateId } from './queryBuilderUtils';
import './QueryBuilder.css';

interface QueryBuilderProps {
  onChange: (query: QueryStructure | null) => void;
  onCaseSensitivityChange: (isCaseSensitive: boolean) => void;
  initialCaseSensitive?: boolean;
  disabled?: boolean;
}

const QueryBuilder: React.FC<QueryBuilderProps> = ({
  onChange,
  onCaseSensitivityChange,
  initialCaseSensitive = false,
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);
  const [rootGroup, setRootGroup] = useState<QueryStructure>({
    id: generateId(),
    operator: 'AND',
    conditions: [],
    isRoot: true,
  });
  const [isCaseSensitive, setIsCaseSensitive] = useState(initialCaseSensitive);

  // Notify parent about query changes
  useEffect(() => {
    // Only call onChange if the root group has conditions
    if (rootGroup.conditions.length > 0) {
      onChange(rootGroup);
    } else {
      onChange(null); // Notify that the query is empty
    }
  }, [rootGroup, onChange]);

  // Notify parent about case sensitivity changes
  useEffect(() => {
    onCaseSensitivityChange(isCaseSensitive);
  }, [isCaseSensitive, onCaseSensitivityChange]);


  const handleRootGroupChange = useCallback((updatedGroup: QueryStructure) => {
    setRootGroup(updatedGroup);
  }, []);

  const handleCaseSensitiveToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIsCaseSensitive(e.target.checked);
  };

  // Determine if the case sensitive checkbox should be shown
  // It's relevant if there's at least one 'term' condition anywhere in the structure
  const hasTermCondition = (group: QueryStructure): boolean => {
    return group.conditions.some(item => {
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
        isRoot={true} // Pass isRoot prop
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
