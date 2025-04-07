import React from 'react';
import { useTranslation } from 'react-i18next';
import type { Condition, TermCondition, RegexCondition, NearCondition } from './queryBuilderTypes';
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
  level: number; // Keep for potential future use, though not directly used for styling here
  isFirstInGroup: boolean; // Keep for potential future use
  groupOperator: 'AND' | 'OR'; // Keep for potential future use
  disabled?: boolean;
}

const QueryCondition: React.FC<QueryConditionProps> = ({
  condition,
  onChange,
  onRemove,
  // level, // Currently unused
  // isFirstInGroup, // Currently unused
  // groupOperator, // Currently unused
  disabled = false,
}) => {
  const { t } = useTranslation(['form']);

  // Handler for Type Select change
  const handleTypeChange = (newType: Condition['type']) => {
    if (disabled) return;
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
        // Reset caseSensitive if switching back to term? Or keep global?
        // Assuming global handling in QueryBuilder, don't reset here.
        newCondition = { id: condition.id, type: 'term', value: '', caseSensitive: (condition as TermCondition).caseSensitive ?? false };
        break;
    }
    onChange(newCondition);
  };

  // Handler for simple value Input change (Term, Regex pattern)
  const handleValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    // Simple type assertion as value exists on all relevant condition types here
    onChange({ ...condition, value: e.target.value } as Condition);
  };

  // Handler for Regex Flags Input change
  const handleFlagsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || condition.type !== 'regex') return;
    const validFlags = e.target.value.replace(/[^gimyus]/g, ''); // Allow only valid flags
    onChange({ ...condition, flags: validFlags });
  };

  // Handlers for NEAR condition Inputs
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
     // Ensure distance is non-negative integer
     onChange({ ...condition, distance: isNaN(distance) || distance < 0 ? 0 : distance });
  };

  return (
    // Apply Tailwind classes for the condition row layout
    <div className="flex items-center gap-2 flex-wrap bg-background p-2 rounded border border-border/50"> {/* Added bg, padding, border */}

      {/* Condition Type Select */}
      <Select
        value={condition.type}
        onValueChange={handleTypeChange} // Use onValueChange
        disabled={disabled}
      >
        <SelectTrigger className="w-[110px] h-8 text-xs shrink-0"> {/* Fixed width, smaller size */}
          <SelectValue placeholder={t('queryBuilderTypeTerm')} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="term">{t('queryBuilderTypeTerm')}</SelectItem>
          <SelectItem value="regex">{t('queryBuilderTypeRegex')}</SelectItem>
          <SelectItem value="near">{t('queryBuilderTypeNear')}</SelectItem>
        </SelectContent>
      </Select>

      {/* Input fields based on condition type */}
      <div className="flex items-center gap-1 flex-grow flex-wrap"> {/* Container for inputs */}
        {condition.type === 'term' && (
          <Input
            type="text"
            value={(condition as TermCondition).value}
            onChange={handleValueChange}
            placeholder={t('queryBuilderTermPlaceholder')}
            disabled={disabled}
            className="h-8 text-sm flex-grow min-w-[150px]" // Styling for term input
          />
        )}

        {condition.type === 'regex' && (
          <>
            {/* Use simple spans for slashes, styled with Tailwind */}
            <span className="text-muted-foreground text-lg mx-0.5">/</span>
            <Input
              type="text"
              value={(condition as RegexCondition).value}
              onChange={handleValueChange}
              placeholder={t('queryBuilderRegexPlaceholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[150px] font-mono" // Monospace for regex
            />
            <span className="text-muted-foreground text-lg mx-0.5">/</span>
            <Input
              type="text"
              value={(condition as RegexCondition).flags}
              onChange={handleFlagsChange}
              placeholder={t('queryBuilderFlagsPlaceholder')}
              disabled={disabled}
              className="h-8 w-[70px] text-sm font-mono text-center shrink-0" // Fixed width for flags
              maxLength={6}
            />
          </>
        )}

        {condition.type === 'near' && (
          <>
            <Input
              type="text"
              value={(condition as NearCondition).term1}
              onChange={handleNearTerm1Change}
              placeholder={t('queryBuilderNearTerm1Placeholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[120px]" // Styling for near term input
            />
            {/* Use simple spans for labels, styled with Tailwind */}
            <span className="text-xs text-muted-foreground mx-1 shrink-0">{t('queryBuilderNearDistanceLabel')}</span>
            <Input
              type="number"
              value={(condition as NearCondition).distance}
              onChange={handleNearDistanceChange}
              disabled={disabled}
              className="h-8 w-[60px] text-sm text-right shrink-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" // Fixed width, right align, hide spinners
              min="0"
              step="1"
            />
             <span className="text-xs text-muted-foreground mx-1 shrink-0">{t('queryBuilderNearWordsLabel')}</span>
            <Input
              type="text"
              value={(condition as NearCondition).term2}
              onChange={handleNearTerm2Change}
              placeholder={t('queryBuilderNearTerm2Placeholder')}
              disabled={disabled}
              className="h-8 text-sm flex-grow min-w-[120px]" // Styling for near term input
            />
          </>
        )}
      </div>

      {/* Remove Button */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRemove}
        disabled={disabled}
        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0" // Specific styling
        aria-label="Remove condition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
};

export default QueryCondition;
