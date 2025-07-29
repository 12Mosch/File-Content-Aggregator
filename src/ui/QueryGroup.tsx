import React, { useCallback } from "react";
import { useTranslation } from "react-i18next";
import QueryCondition from "./QueryCondition"; // Child component
import type {
  QueryGroup as QueryStructure,
  Condition,
} from "./queryBuilderTypes";
import { generateId } from "./queryBuilderUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Plus, Trash2, Group } from "lucide-react";

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
  const { t } = useTranslation(["form"]);

  // Handler for shadcn Select's onValueChange
  const handleOperatorChange = (value: "AND" | "OR") => {
    if (disabled) return;
    onChange({ ...group, operator: value });
  };

  const handleAddCondition = () => {
    if (disabled) return;
    const newCondition: Condition = {
      id: generateId(),
      type: "term", // Default to term
      value: "",
      caseSensitive: false, // Default case sensitivity for term
    };
    onChange({ ...group, conditions: [...group.conditions, newCondition] });
  };

  const handleAddGroup = () => {
    if (disabled) return;
    const newGroup: QueryStructure = {
      id: generateId(),
      operator: "AND",
      conditions: [],
    };
    onChange({ ...group, conditions: [...group.conditions, newGroup] });
  };

  // Callbacks for child changes (remain the same logic)
  const handleConditionChange = useCallback(
    (index: number, updatedItem: Condition | QueryStructure) => {
      if (disabled) return;
      const newConditions = [...group.conditions];
      newConditions[index] = updatedItem;
      onChange({ ...group, conditions: newConditions });
    },
    [group, onChange, disabled]
  );

  const handleRemoveItem = useCallback(
    (index: number) => {
      if (disabled) return;
      const newConditions = group.conditions.filter((_, i) => i !== index);
      onChange({ ...group, conditions: newConditions });
    },
    [group, onChange, disabled]
  );

  const canRemove = !isRoot && onRemove; // Can remove if not root and handler exists

  return (
    // Apply Tailwind classes for layout, border, padding, margin (indentation)
    <div
      className={cn(
        "flex flex-col gap-2", // Vertical layout with gap
        !isRoot && "ml-4 border-l-2 border-border/60 pl-4" // Indentation for nested groups
      )}
    >
      {/* Controls Section */}
      <div className="flex flex-wrap items-center gap-2">
        {" "}
        {/* Flex layout for controls */}
        {/* Operator Select */}
        <Select
          value={group.operator}
          onValueChange={handleOperatorChange} // Use onValueChange
          disabled={disabled || group.conditions.length < 2}
        >
          <SelectTrigger className="h-8 w-[80px] shrink-0 text-xs">
            {" "}
            {/* Smaller trigger */}
            <SelectValue placeholder="Operator" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">{t("queryBuilderAND")}</SelectItem>
            <SelectItem value="OR">{t("queryBuilderOR")}</SelectItem>
          </SelectContent>
        </Select>
        {/* Add Condition Button */}
        <Button
          type="button"
          variant="ghost" // Use ghost for less emphasis
          size="sm" // Smaller size
          onClick={handleAddCondition}
          disabled={disabled}
          className="h-8 px-2 text-xs" // Adjust padding/height
        >
          <Plus className="mr-1 h-3 w-3" /> {/* Icon */}
          {t("queryBuilderAddCondition")}
        </Button>
        {/* Add Group Button */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleAddGroup}
          disabled={disabled}
          className="h-8 px-2 text-xs"
        >
          <Group className="mr-1 h-3 w-3" /> {/* Icon */}
          {t("queryBuilderAddGroup")}
        </Button>
        {/* Remove Group Button (Conditional) */}
        {canRemove && (
          <Button
            type="button"
            variant="ghost"
            size="icon" // Icon only button
            onClick={onRemove}
            disabled={disabled}
            className="ml-auto h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive" // Push right, specific styling
            aria-label="Remove group"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {/* Conditions/Subgroups Section */}
      {/* Apply Tailwind for layout */}
      <div className="flex flex-col gap-2">
        {group.conditions.map((item, index) => (
          // Container for each item (condition or subgroup)
          <div key={item.id}>
            {"operator" in item ? (
              // Render nested QueryGroup
              <QueryGroup
                group={item}
                onChange={(updatedSubGroup) =>
                  handleConditionChange(index, updatedSubGroup)
                }
                onRemove={() => handleRemoveItem(index)}
                level={level + 1} // Increment level for nesting
                disabled={disabled}
              />
            ) : (
              // Render QueryCondition
              <QueryCondition
                condition={item}
                onChange={(updatedCondition) =>
                  handleConditionChange(index, updatedCondition)
                }
                onRemove={() => handleRemoveItem(index)}
                level={level} // Pass level
                isFirstInGroup={index === 0}
                groupOperator={group.operator}
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
