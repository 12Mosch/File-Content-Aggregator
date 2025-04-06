// D:/Code/Electron/src/ui/QueryBuilder.tsx
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import QueryGroup from './QueryGroup'; // Child component
import type { QueryGroup as QueryStructure } from './queryBuilderTypes';
import { generateId } from './queryBuilderUtils';
import { Checkbox } from "@/components/ui/checkbox"; // Import shadcn Checkbox
import { Label } from "@/components/ui/label"; // Import shadcn Label
import { cn } from "@/lib/utils"; // Import cn utility

// Remove the CSS import
// import './QueryBuilder.css';

interface QueryBuilderProps {
  onChange: (query: QueryStructure | null) => void;
  onCaseSensitivityChange: (isCaseSensitive: boolean) => void;
  initialQuery?: QueryStructure | null;
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

  // Effect to update internal state ONLY when initial props represent a NEW load
  useEffect(() => {
    const newQueryId = initialQuery?.id ?? null;
    if (initialQuery === null && loadedQueryIdRef.current !== null) {
        setRootGroup(createDefaultRootGroup());
        setIsCaseSensitive(initialCaseSensitive);
        loadedQueryIdRef.current = null;
    } else if (initialQuery && newQueryId !== loadedQueryIdRef.current) {
        console.log(`QueryBuilder: Loading new initialQuery (ID: ${newQueryId})`);
        setRootGroup(initialQuery);
        setIsCaseSensitive(initialCaseSensitive);
        loadedQueryIdRef.current = newQueryId;
    }
  }, [initialQuery, initialCaseSensitive]);

  // Notify parent about query changes (made internally by the user)
  useEffect(() => {
    if (rootGroup.id !== loadedQueryIdRef.current || !initialQuery) {
         onChange(rootGroup.conditions.length > 0 ? rootGroup : null);
    }
  }, [rootGroup, onChange, initialQuery]);

  // Notify parent about case sensitivity changes (handled directly in toggle)
  // useEffect(() => {
  //   onCaseSensitivityChange(isCaseSensitive);
  // }, [isCaseSensitive, onCaseSensitivityChange]);


  const handleRootGroupChange = useCallback((updatedGroup: QueryStructure) => {
    setRootGroup(updatedGroup);
  }, []);

  const handleCaseSensitiveToggle = (checked: boolean | 'indeterminate') => {
    // Checkbox onCheckedChange provides boolean or 'indeterminate'
    const newSensitivity = Boolean(checked);
    setIsCaseSensitive(newSensitivity);
    // Directly notify parent on user interaction
    onCaseSensitivityChange(newSensitivity);
  };

  // Determine if the case sensitive checkbox should be shown
  const hasTermCondition = (group: QueryStructure): boolean => {
    if (!group?.conditions) return false;
    return group.conditions.some(item => {
      if (!item) return false;
      if ('operator' in item) {
        return hasTermCondition(item);
      } else {
        return item.type === 'term';
      }
    });
  };
  const showCaseSensitiveCheckbox = hasTermCondition(rootGroup);


  return (
    // Apply Tailwind classes for container styling
    <div
      className={cn(
        "border border-border rounded-md p-3 bg-muted/30", // Base styles
        "flex flex-col gap-3", // Layout
        disabled && "opacity-60 pointer-events-none" // Disabled state
      )}
    >
      {/* Render the root QueryGroup */}
      <QueryGroup
        group={rootGroup}
        onChange={handleRootGroupChange}
        level={0}
        isRoot={true}
        disabled={disabled}
      />
      {/* Render options like case sensitivity only if relevant */}
      {showCaseSensitiveCheckbox && (
         // Apply Tailwind classes for options section layout/styling
         <div className="mt-2 pt-3 border-t border-border/60">
            {/* Use flex layout for checkbox and label */}
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="queryBuilderCaseSensitive"
                    checked={isCaseSensitive}
                    onCheckedChange={handleCaseSensitiveToggle} // Use onCheckedChange
                    disabled={disabled}
                    aria-label={t('caseSensitiveLabel')} // Add aria-label
                />
                <Label
                    htmlFor="queryBuilderCaseSensitive"
                    // Apply Tailwind classes for label appearance and cursor
                    className="text-sm font-medium leading-none text-muted-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                    {t('caseSensitiveLabel')}
                </Label>
            </div>
        </div>
      )}
    </div>
  );
};

export default QueryBuilder;
