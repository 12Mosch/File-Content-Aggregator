// D:/Code/Electron/src/ui/queryBuilderTypes.ts
// Define the types for the structured query builder

export type ConditionType = 'term' | 'regex' | 'near';

// Base interface for all conditions and groups
export interface QueryItem {
    id: string; // Unique ID for React keys and state management
}

// Interface for a simple term condition
export interface TermCondition extends QueryItem {
  type: 'term';
  value: string;
  caseSensitive: boolean; // Case sensitivity specific to this term
}

// Interface for a regular expression condition
export interface RegexCondition extends QueryItem {
  type: 'regex';
  value: string; // The regex pattern itself
  flags: string; // Flags like 'i', 'g', 'm', 'u', 's', 'y'
}

// Interface for a proximity (NEAR) condition
export interface NearCondition extends QueryItem {
  type: 'near';
  term1: string; // First term (can be simple string or /regex/ literal)
  term2: string; // Second term (can be simple string or /regex/ literal)
  distance: number; // Maximum word distance
}

// Union type for any single condition
export type Condition = TermCondition | RegexCondition | NearCondition;

// Interface for a group of conditions (or nested groups)
export interface QueryGroup extends QueryItem {
  operator: 'AND' | 'OR';
  conditions: Array<Condition | QueryGroup>; // Can contain conditions or other groups
  isRoot?: boolean; // Optional flag to identify the top-level group
}
