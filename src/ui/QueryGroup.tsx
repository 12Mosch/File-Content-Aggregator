// D:/Code/Electron/src/ui/QueryGroup.tsx
import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import QueryCondition from './QueryCondition';
import type { QueryGroup as QueryStructure, Condition } from './queryBuilderTypes';
import { generateId } from './queryBuilderUtils';
import './QueryBuilder.css';

interface QueryGroupProps {
  group: QueryStructure;
  onChange: (updatedGroup: QueryStructure) => void;
  onRemove?: () => void; // Optional remove handler for nested groups
  level: number;
  isRoot?: boolean; // Flag for the top-level group
  disabled?: boolean;
}

const QueryGroup: React.FC<QueryGroupProps> = ({
  group,
  onChange,
  onRemove,
  level,
  isRoot = false,
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);

  const handleOperatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (disabled) return;
    onChange({ ...group, operator: e.target.value as 'AND' | 'OR' });
  };

  const handleAddCondition = () => {
    if (disabled) return;
    const newCondition: Condition = {
      id: generateId(),
      type: 'term', // Default to term
      value: '',
      caseSensitive: false, // Default case sensitivity for term
    };
    onChange({ ...group, conditions: [...group.conditions, newCondition] });
  };

  const handleAddGroup = () => {
    if (disabled) return;
    const newGroup: QueryStructure = {
      id: generateId(),
      operator: 'AND',
      conditions: [],
    };
    onChange({ ...group, conditions: [...group.conditions, newGroup] });
  };

  const handleConditionChange = useCallback((index: number, updatedItem: Condition | QueryStructure) => {
    if (disabled) return;
    const newConditions = [...group.conditions];
    newConditions[index] = updatedItem;
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange, disabled]);

  const handleRemoveItem = useCallback((index: number) => {
    if (disabled) return;
    const newConditions = group.conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: newConditions });
  }, [group, onChange, disabled]);

  const canRemove = !isRoot && onRemove; // Can remove if not root and handler exists

  return (
    <div className={`query-group level-${level} ${isRoot ? 'root-group' : ''}`}>
      <div className="query-group-controls">
        {!isRoot && <div className="query-group-indent"></div>}
        <select
          value={group.operator}
          onChange={handleOperatorChange}
          disabled={disabled || group.conditions.length < 2} // Disable if less than 2 items
          className="query-group-operator"
        >
          <option value="AND">{t('queryBuilderAND')}</option>
          <option value="OR">{t('queryBuilderOR')}</option>
        </select>
        <button type="button" onClick={handleAddCondition} disabled={disabled} className="query-builder-button add-condition">
          {t('queryBuilderAddCondition')}
        </button>
        <button type="button" onClick={handleAddGroup} disabled={disabled} className="query-builder-button add-group">
          {t('queryBuilderAddGroup')}
        </button>
        {canRemove && (
          <button type="button" onClick={onRemove} disabled={disabled} className="query-builder-button remove-item remove-group">
            &times; {/* Simple remove icon */}
          </button>
        )}
      </div>
      <div className="query-group-conditions">
        {group.conditions.map((item, index) => (
          <div key={item.id} className="query-item-container">
            {'operator' in item ? (
              <QueryGroup
                group={item}
                onChange={(updatedSubGroup) => handleConditionChange(index, updatedSubGroup)}
                onRemove={() => handleRemoveItem(index)}
                level={level + 1}
                disabled={disabled}
              />
            ) : (
              <QueryCondition
                condition={item}
                onChange={(updatedCondition) => handleConditionChange(index, updatedCondition)}
                onRemove={() => handleRemoveItem(index)}
                level={level} // Pass level for potential indenting/styling
                isFirstInGroup={index === 0} // Pass info if it's the first item
                groupOperator={group.operator} // Pass parent operator
                disabled={disabled}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default QueryGroup;
