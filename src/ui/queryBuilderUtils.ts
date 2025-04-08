// D:/Code/Electron/src/ui/queryBuilderUtils.ts
// Utility functions for the query builder

/**
 * Generates a simple unique ID.
 * In a real application, consider using a more robust library like uuid.
 */
export const generateId = (): string => {
  return `qb_${Math.random().toString(36).substring(2, 9)}`;
};
