// D:/Code/Electron/src/ui/QueryBuilder.tsx
// Reverted to standard component, relying on onChange props
import React, { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import QueryGroup from "./QueryGroup"; // Child component
import type { QueryGroup as QueryStructure } from "./queryBuilderTypes";
import { generateId } from "./queryBuilderUtils";
import { Checkbox } from "@/components/ui/checkbox"; // Import shadcn Checkbox
import { Label } from "@/components/ui/label"; // Import shadcn Label
import { cn } from "@/lib/utils"; // Import cn utility

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
  operator: "AND",
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
  const { t } = useTranslation(["form"]);
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
      // If parent clears the query, reset internal state
      // console.log("QueryBuilder: Parent cleared query. Resetting.");
      setRootGroup(createDefaultRootGroup());
      setIsCaseSensitive(initialCaseSensitive); // Reset case sensitivity too
      loadedQueryIdRef.current = null;
    } else if (initialQuery && newQueryId !== loadedQueryIdRef.current) {
      // If parent loads a new query (e.g., from history)
      // console.log(`QueryBuilder: Loading new initialQuery (ID: ${newQueryId})`);
      setRootGroup(initialQuery);
      setIsCaseSensitive(initialCaseSensitive);
      loadedQueryIdRef.current = newQueryId;
    }
    // Only run when initialQuery or initialCaseSensitive changes from parent
  }, [initialQuery, initialCaseSensitive]);

  // Callback for internal changes within QueryGroup/QueryCondition
  const handleRootGroupChange = useCallback(
    (updatedGroup: QueryStructure) => {
      // console.log("QueryBuilder: handleRootGroupChange", updatedGroup); // Log internal change
      setRootGroup(updatedGroup);
      // Notify parent immediately
      onChange(updatedGroup.conditions.length > 0 ? updatedGroup : null);
    },
    [onChange] // Depend only on onChange prop
  );

  // Callback for case sensitivity toggle
  const handleCaseSensitiveToggle = useCallback(
    (checked: boolean | "indeterminate") => {
      const newSensitivity = Boolean(checked);
      // console.log("QueryBuilder: handleCaseSensitiveToggle", newSensitivity); // Log internal change
      setIsCaseSensitive(newSensitivity);
      // Notify parent immediately
      onCaseSensitivityChange(newSensitivity);
    },
    [onCaseSensitivityChange] // Depend only on onCaseSensitivityChange prop
  );

  // Determine if the case sensitive checkbox should be shown
  const hasTermCondition = (group: QueryStructure): boolean => {
    if (!group?.conditions) return false;
    return group.conditions.some((item) => {
      if (!item) return false;
      if ("operator" in item) {
        return hasTermCondition(item);
      } else {
        return item.type === "term";
      }
    });
  };
  const showCaseSensitiveCheckbox = hasTermCondition(rootGroup);

  return (
    <div
      className={cn(
        "border border-border rounded-md p-3 bg-muted/30", // Base styles
        "flex flex-col gap-3", // Layout
        disabled && "opacity-60 pointer-events-none" // Disabled state
      )}
    >
      <QueryGroup
        group={rootGroup}
        onChange={handleRootGroupChange} // Pass the callback
        level={0}
        isRoot={true}
        disabled={disabled}
      />
      {showCaseSensitiveCheckbox && (
        <div className="mt-2 pt-3 border-t border-border/60">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="queryBuilderCaseSensitive"
              checked={isCaseSensitive}
              onCheckedChange={handleCaseSensitiveToggle} // Pass the callback
              disabled={disabled}
              aria-label={t("caseSensitiveLabel")}
            />
            <Label
              htmlFor="queryBuilderCaseSensitive"
              className="text-sm font-medium leading-none text-muted-foreground cursor-pointer peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {t("caseSensitiveLabel")}
            </Label>
          </div>
        </div>
      )}
    </div>
  );
};

export default QueryBuilder;
