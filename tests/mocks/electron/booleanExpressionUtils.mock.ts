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
  // Simple mock implementation for testing
  if (node.type === "Literal") {
    const term = String(node.value);
    if (caseSensitive) {
      return content.includes(term);
    } else {
      return content.toLowerCase().includes(term.toLowerCase());
    }
  }
  
  if (node.type === "BinaryExpression") {
    const left = evaluateBooleanAst(node.left, content, caseSensitive);
    const right = evaluateBooleanAst(node.right, content, caseSensitive);
    
    if (node.operator === "&&" || node.operator === "AND") {
      return left && right;
    } else if (node.operator === "||" || node.operator === "OR") {
      return left || right;
    }
  }
  
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
