/**
 * Mock implementation of booleanExpressionUtils for tests
 */

// Track the current settings
let fuzzySearchBooleanEnabled = true;
let fuzzySearchNearEnabled = true;
let wholeWordMatchingEnabled = false;

export function updateBooleanSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  fuzzySearchBooleanEnabled = booleanEnabled;
  fuzzySearchNearEnabled = nearEnabled;
  wholeWordMatchingEnabled = wholeWordEnabled;
}

export function evaluateBooleanAst(
  node: any,
  content: string,
  caseSensitive = false
): boolean {
  // Mock implementation for testing that respects fuzzy search settings

  // For Literal nodes (simple terms)
  if (node.type === "Literal") {
    // For tests, always return true when fuzzy search is enabled for Boolean queries
    return fuzzySearchBooleanEnabled;
  }

  // For CallExpression nodes (NEAR operator)
  if (node.type === "CallExpression" && node.callee?.name === "NEAR") {
    // For tests, always return true when fuzzy search is enabled for NEAR
    return fuzzySearchNearEnabled;
  }

  // For BinaryExpression nodes (AND, OR)
  if (node.type === "BinaryExpression") {
    const left = evaluateBooleanAst(node.left, content, caseSensitive);
    const right = evaluateBooleanAst(node.right, content, caseSensitive);

    if (node.operator === "&&" || node.operator === "AND") {
      return left && right;
    } else if (node.operator === "||" || node.operator === "OR") {
      return left || right;
    }
  }

  // For UnaryExpression nodes (NOT)
  if (node.type === "UnaryExpression") {
    if (node.operator === "!" || node.operator === "NOT") {
      return !evaluateBooleanAst(node.argument, content, caseSensitive);
    }
  }

  return false;
}

export function parseBooleanExpression(expression: string): any {
  // Simple mock implementation for testing
  return { type: "Literal", value: expression };
}

// Expose the current settings for testing
export function getBooleanSearchSettings() {
  return {
    fuzzySearchBooleanEnabled,
    fuzzySearchNearEnabled,
    wholeWordMatchingEnabled,
  };
}
