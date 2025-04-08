import React from 'react';
import { useTranslation } from 'react-i18next';
// Prefix unused types with underscore
import type { Condition, TermCondition, /* _RegexCondition, _NearCondition */ } from './queryBuilderTypes';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';

interface QueryConditionProps {
  condition: Condition;
  onChange: (updatedCondition: Condition) => void;
  onRemove: () => void;
  level: number;
  isFirstInGroup: boolean;
  groupOperator: 'AND' | 'OR';
  disabled?: boolean;
}

const QueryCondition: React.FC<QueryConditionProps> = ({
  condition,
  onChange,
  onRemove,
  // _level, // Prefix unused vars
  // _isFirstInGroup,
  // _groupOperator,
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);

  const handleTypeChange = (newType: Condition['type']) => {
    if (disabled) return;
    let newCondition: Condition;
    switch (newType) {
      case 'regex':
        newCondition = { id: condition.id, type: 'regex', value: '', flags: 'i' };
        break;
      case 'near':
        newCondition = { id: condition.id, type: 'near', term1: '', term2: '', distance: 5 };
        break;
      case 'term':
      default:
        newCondition = { id: condition.id, type: 'term', value: '', caseSensitive: (condition as TermCondition).caseSensitive ?? false };
        break;
    }
    onChange(newCondition);
  };

  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // Check type before accessing value to satisfy type safety
    if (condition.type === 'term' || condition.type === 'regex') {
        onChange({ ...condition, value: e.target.value });
    }
  };

  const handleFlagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || condition.type !== 'regex') return;
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

  return (
    <div className="flex items-center gap-2 flex-wrap bg-background p-2 rounded border border-border/50">
      <Select
        value={condition.type}
        onValueChange={handleTypeChange}
        disabled={disabled}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs shrink-0">
          <SelectValue placeholder={t('queryBuilderTypeTerm')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="term">{t('queryBuilderTypeTerm')}</SelectItem>
          <SelectItem value="regex">{t('queryBuilderTypeRegex')}</SelectItem>
          <SelectItem value="near">{t('queryBuilderTypeNear')}</SelectItem>
        </SelectContent>
      </Select>

      <div className="flex items-center gap-1 flex-grow flex-wrap">
        {condition.type === 'term' && (
          <Input
            type="text"
            value={condition.value} // Access value safely
            onChange={handleValueChange}
            placeholder={t('queryBuilderTermPlaceholder')}
            disabled={disabled}
            className="h-8 text-sm flex-grow min-w-[150px]"
          />
        )}

        {condition.type === 'regex' && (
          <>
            <span className="text-muted-foreground text-lg mx-0.5">/</span>
            <Input
              type="text"
              value={condition.value} // Access value safely
              onChange={handleValueChange}
              placeholder={t('queryBuilderRegexPlaceholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[150px] font-mono"
            />
            <span className="text-muted-foreground text-lg mx-0.5">/</span>
            <Input
              type="text"
              value={condition.flags} // Access flags safely
              onChange={handleFlagsChange}
              placeholder={t('queryBuilderFlagsPlaceholder')}
              disabled={disabled}
              className="h-8 w-[70px] text-sm font-mono text-center shrink-0"
              maxLength={6}
            />
          </>
        )}

        {condition.type === 'near' && (
          <>
            <Input
              type="text"
              value={condition.term1} // Access term1 safely
              onChange={handleNearTerm1Change}
              placeholder={t('queryBuilderNearTerm1Placeholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[120px]"
            />
            <span className="text-xs text-muted-foreground mx-1 shrink-0">{t('queryBuilderNearDistanceLabel')}</span>
            <Input
              type="number"
              value={condition.distance} // Access distance safely
              onChange={handleNearDistanceChange}
              disabled={disabled}
              className="h-8 w-[60px] text-sm text-right shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              min="0"
              step="1"
            />
             <span className="text-xs text-muted-foreground mx-1 shrink-0">{t('queryBuilderNearWordsLabel')}</span>
            <Input
              type="text"
              value={condition.term2} // Access term2 safely
              onChange={handleNearTerm2Change}
              placeholder={t('queryBuilderNearTerm2Placeholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[120px]"
            />
          </>
        )}
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
        aria-label="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default QueryCondition;
