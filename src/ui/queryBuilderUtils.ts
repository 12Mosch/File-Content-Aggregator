// D:/Code/Electron/src/ui/queryBuilderUtils.ts
// Utility functions for the query builder
import type {
  QueryGroup, // Import QueryGroup directly
  Condition,
  QueryItem,
  TermCondition,
  RegexCondition,
  NearCondition,
} from "./queryBuilderTypes.js"; // Use .js extension for NodeNext compatibility

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

/**
 * Parses a regex literal string (e.g., "/pattern/flags") into a RegExp object.
 * Returns null if the string is not a valid regex literal.
 * @param pattern The string to parse.
 * @returns A RegExp object or null.
 */
function parseRegexLiteral(pattern: string): RegExp | null {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e: unknown) {
      console.warn(`Invalid RegExp literal format: ${pattern}`, e);
      return null;
    }
  }
  return null;
}

/**
 * Recursively extracts all search terms (strings and RegExp objects) from a QueryGroup or Condition.
 * Ignores empty strings.
 * @param query The QueryGroup or Condition to traverse.
 * @returns An array of strings and RegExp objects representing the search terms.
 */
export function extractSearchTermsFromQuery(
  query: QueryGroup | Condition | null | undefined // Use QueryGroup directly
): (string | RegExp)[] {
  if (!query) {
    return [];
  }

  const terms: (string | RegExp)[] = [];

  const traverse = (item: QueryGroup | Condition) => {
    // Use QueryGroup directly
    if ("operator" in item) {
      // It's a QueryGroup
      item.conditions.forEach(traverse);
    } else {
      // It's a Condition
      switch (item.type) {
        case "term": {
          if (item.value.trim()) {
            terms.push(item.value);
          }
          break;
        }
        case "regex": {
          if (item.value.trim()) {
            try {
              // Create RegExp object from pattern and flags
              const regex = new RegExp(item.value, item.flags || "");
              terms.push(regex);
            } catch (e) {
              console.warn(
                `Could not create RegExp from value: "${item.value}", flags: "${item.flags}"`,
                e
              );
              // Optionally push the raw string as a fallback? Or ignore? Let's ignore for now.
            }
          }
          break;
        }
        case "near": {
          // Extract terms from NEAR, attempting to parse regex literals
          const term1 = item.term1.trim();
          const term2 = item.term2.trim();
          if (term1) {
            const regex1 = parseRegexLiteral(term1);
            terms.push(regex1 || term1);
          }
          if (term2) {
            const regex2 = parseRegexLiteral(term2);
            terms.push(regex2 || term2);
          }
          break;
        }
      }
    }
  };

  traverse(query);

  // Deduplicate terms (important for performance and avoiding redundant highlights)
  // Need a custom way to deduplicate RegExp objects
  const uniqueTermsMap = new Map<string, string | RegExp>();
  terms.forEach((term) => {
    const key = term instanceof RegExp ? term.toString() : term;
    if (!uniqueTermsMap.has(key)) {
      uniqueTermsMap.set(key, term);
    }
  });

  return Array.from(uniqueTermsMap.values());
}

/**
 * Converts a structured query object into a string representation suitable
 * for the backend's boolean search parser (using jsep).
 * Handles quoting, regex literals, and NEAR function syntax.
 * @param group The root QueryGroup object, or null.
 * @returns A string representation of the query, or an empty string if the input is null or empty.
 */
export const convertStructuredQueryToString = (
  group: QueryGroup | null // Accept null
): string => {
  // Return empty string if group is null or has no conditions
  if (!group || !group.conditions || group.conditions.length === 0) return "";

  const parts = group.conditions.map((item) => {
    if ("operator" in item) {
      // Recursively convert subgroup, wrap in parentheses if not empty
      const subQuery = convertStructuredQueryToString(item);
      return subQuery ? `(${subQuery})` : "";
    } else {
      // Convert condition
      switch (item.type) {
        case "term": {
          // *** FIX: Always quote simple terms ***
          // Escape any existing double quotes within the value
          const escapedValue = item.value.replace(/"/g, '\\"');
          return `"${escapedValue}"`;
        }
        case "regex": {
          // Ensure flags are valid and format as /pattern/flags
          const validFlags = (item.flags || "").replace(/[^gimyus]/g, "");
          // Escape forward slashes within the pattern itself
          const escapedPattern = item.value.replace(/\//g, "\\/");
          return `/${escapedPattern}/${validFlags}`;
        }
        case "near": {
          // Format NEAR function, quoting terms if necessary
          const formatNearTerm = (term: string) => {
            // If it looks like a regex literal, pass it through
            if (term.startsWith("/") && term.endsWith("/")) {
              // Also escape internal forward slashes for NEAR parsing
              const match = term.match(/^\/(.+)\/([gimyus]*)$/);
              if (match) {
                return `/${match[1].replace(/\//g, "\\/")}/${match[2]}`;
              }
              // Fallback if regex parsing fails (shouldn't happen often)
              return term;
            }
            // Otherwise, treat as a simple term and quote it, escaping internal quotes
            return `"${term.replace(/"/g, '\\"')}"`;
          };
          return `NEAR(${formatNearTerm(item.term1)}, ${formatNearTerm(item.term2)}, ${item.distance})`;
        }
        default: {
          console.warn(
            "Unknown condition type during string conversion:",
            item
          );
          return "";
        }
      }
    }
  });
  // Join non-empty parts with the group operator
  const validParts = parts.filter(Boolean);
  if (validParts.length === 0) return "";
  if (validParts.length === 1) return validParts[0]; // No need for operator if only one part
  return validParts.join(` ${group.operator} `);
};
