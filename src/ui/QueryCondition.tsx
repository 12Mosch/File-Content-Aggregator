// D:/Code/Electron/src/ui/QueryCondition.tsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Condition, TermCondition, RegexCondition, NearCondition } from './queryBuilderTypes';
import './QueryBuilder.css';

interface QueryConditionProps {
  condition: Condition;
  onChange: (updatedCondition: Condition) => void;
  onRemove: () => void;
  level: number; // For potential styling/indentation
  isFirstInGroup: boolean;
  groupOperator: 'AND' | 'OR';
  disabled?: boolean;
}

const QueryCondition: React.FC<QueryConditionProps> = ({
  condition,
  onChange,
  onRemove,
  level,
  // isFirstInGroup, // Currently unused, but available
  // groupOperator, // Currently unused, but available
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);

  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (disabled) return;
    const newType = e.target.value as Condition['type'];
    let newCondition: Condition;

    // Reset to default values when type changes
    switch (newType) {
      case 'regex':
        newCondition = { id: condition.id, type: 'regex', value: '', flags: 'i' };
        break;
      case 'near':
        newCondition = { id: condition.id, type: 'near', term1: '', term2: '', distance: 5 };
        break;
      case 'term':
      default:
        newCondition = { id: condition.id, type: 'term', value: '', caseSensitive: false };
        break;
    }
    onChange(newCondition);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange({ ...condition, value: e.target.value } as Condition); // Type assertion needed here
  };

  const handleFlagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || condition.type !== 'regex') return;
    // Allow only valid regex flags
    const validFlags = e.target.value.replace(/[^gimyus]/g, '');
    onChange({ ...condition, flags: validFlags });
  };

  const handleNearTerm1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (disabled || condition.type !== 'near') return;
     onChange({ ...condition, term1: e.target.value });
  };

  const handleNearTerm2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (disabled || condition.type !== 'near') return;
     onChange({ ...condition, term2: e.target.value });
  };

  const handleNearDistanceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
     if (disabled || condition.type !== 'near') return;
     const distance = parseInt(e.target.value, 10);
     onChange({ ...condition, distance: isNaN(distance) || distance < 0 ? 0 : distance });
  };

  // Note: Case sensitivity for 'term' is handled globally in QueryBuilder now

  return (
    <div className={`query-condition level-${level}`}>
      <div className="query-condition-controls">
        <select
          value={condition.type}
          onChange={handleTypeChange}
          disabled={disabled}
          className="query-condition-type"
        >
          <option value="term">{t('queryBuilderTypeTerm')}</option>
          <option value="regex">{t('queryBuilderTypeRegex')}</option>
          <option value="near">{t('queryBuilderTypeNear')}</option>
        </select>

        {condition.type === 'term' && (
          <input
            type="text"
            value={(condition as TermCondition).value}
            onChange={handleValueChange}
            placeholder={t('queryBuilderTermPlaceholder')}
            disabled={disabled}
            className="query-condition-value"
          />
        )}

        {condition.type === 'regex' && (
          <>
            <span className="query-condition-regex-sep">/</span>
            <input
              type="text"
              value={(condition as RegexCondition).value}
              onChange={handleValueChange}
              placeholder={t('queryBuilderRegexPlaceholder')}
              disabled={disabled}
              className="query-condition-value regex-value"
            />
            <span className="query-condition-regex-sep">/</span>
            <input
              type="text"
              value={(condition as RegexCondition).flags}
              onChange={handleFlagsChange}
              placeholder={t('queryBuilderFlagsPlaceholder')}
              disabled={disabled}
              className="query-condition-flags"
              maxLength={6} // Max length of unique flags (gimyus)
            />
          </>
        )}

        {condition.type === 'near' && (
          <>
            <input
              type="text"
              value={(condition as NearCondition).term1}
              onChange={handleNearTerm1Change}
              placeholder={t('queryBuilderNearTerm1Placeholder')}
              disabled={disabled}
              className="query-condition-value near-term"
            />
            <span className="query-condition-near-label">{t('queryBuilderNearDistanceLabel')}</span>
            <input
              type="number"
              value={(condition as NearCondition).distance}
              onChange={handleNearDistanceChange}
              disabled={disabled}
              className="query-condition-near-distance"
              min="0"
              step="1"
            />
             <span className="query-condition-near-label">{t('queryBuilderNearWordsLabel')}</span>
            <input
              type="text"
              value={(condition as NearCondition).term2}
              onChange={handleNearTerm2Change}
              placeholder={t('queryBuilderNearTerm2Placeholder')}
              disabled={disabled}
              className="query-condition-value near-term"
            />
          </>
        )}

        <button type="button" onClick={onRemove} disabled={disabled} className="query-builder-button remove-item remove-condition">
          &times; {/* Simple remove icon */}
        </button>
      </div>
    </div>
  );
};

export default QueryCondition;
