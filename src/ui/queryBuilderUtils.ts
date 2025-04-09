// Utility functions for the query builder
import type { QueryGroup, Condition, QueryItem } from "./queryBuilderTypes.js"; // Use .js extension for NodeNext compatibility

/**
 * Generates a simple unique ID.
 * In a real application, consider using a more robust library like uuid.
 */
export const generateId = (): string => {
  return `qb_${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Type guard to check if an object is a valid QueryItem (has an id).
 * @param item The object to check.
 * @returns True if the object is a QueryItem, false otherwise.
 */
function isQueryItem(item: unknown): item is QueryItem {
  return (
    typeof item === "object" &&
    item !== null &&
    "id" in item &&
    typeof (item as QueryItem).id === "string"
  );
}

/**
 * Type guard to check if an object is a valid Condition.
 * @param item The object to check.
 * @returns True if the object is a Condition, false otherwise.
 */
function isCondition(item: unknown): item is Condition {
  if (!isQueryItem(item)) return false;
  const condition = item as Partial<Condition>; // Cast for easier access
  if (!condition.type) return false;

  switch (condition.type) {
    case "term":
      return (
        "value" in condition &&
        typeof condition.value === "string" &&
        "caseSensitive" in condition &&
        typeof condition.caseSensitive === "boolean"
      );
    case "regex":
      return (
        "value" in condition &&
        typeof condition.value === "string" &&
        "flags" in condition &&
        typeof condition.flags === "string"
      );
    case "near":
      return (
        "term1" in condition &&
        typeof condition.term1 === "string" &&
        "term2" in condition &&
        typeof condition.term2 === "string" &&
        "distance" in condition &&
        typeof condition.distance === "number"
      );
    default:
      return false;
  }
}

/**
 * Type guard to recursively check if an object conforms to the QueryGroup structure.
 * @param group The object to check.
 * @returns True if the object is a valid QueryGroup, false otherwise.
 */
export function isQueryStructure(group: unknown): group is QueryGroup {
  if (!isQueryItem(group)) return false;
  const potentialGroup = group as Partial<QueryGroup>; // Cast for easier access

  // Check for required QueryGroup properties
  if (
    typeof potentialGroup.operator !== "string" ||
    (potentialGroup.operator !== "AND" && potentialGroup.operator !== "OR") ||
    !Array.isArray(potentialGroup.conditions)
  ) {
    return false;
  }

  // Recursively check each item in the conditions array
  for (const item of potentialGroup.conditions) {
    if (!item) return false; // Should not contain null/undefined items
    // Check if it's a valid Condition or recursively check if it's a valid QueryGroup
    if (!isCondition(item) && !isQueryStructure(item)) {
      return false;
    }
  }

  // If all checks pass, it's a valid QueryGroup
  return true;
}
