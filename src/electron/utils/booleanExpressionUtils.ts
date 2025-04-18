/**
 * Boolean Expression Utilities
 * 
 * Utilities for parsing and evaluating boolean expressions.
 */

import type * as Jsep from "jsep";
import module from "node:module";
const require = module.createRequire(import.meta.url);
const jsep = require("jsep") as typeof import("jsep");

// Import services
import {
  FuzzySearchService,
  WordBoundaryService,
  NearOperatorService,
} from "../services/index.js";

// Global settings
let fuzzySearchBooleanEnabled = true;
let fuzzySearchNearEnabled = true;
let wholeWordMatchingEnabled = false;

/**
 * Updates the search settings for boolean expression evaluation
 * @param booleanEnabled Whether fuzzy search is enabled for boolean queries
 * @param nearEnabled Whether fuzzy search is enabled for NEAR operator
 * @param wholeWordEnabled Whether whole word matching is enabled
 */
export function updateBooleanSearchSettings(
  booleanEnabled: boolean,
  nearEnabled: boolean,
  wholeWordEnabled: boolean
): void {
  fuzzySearchBooleanEnabled = booleanEnabled;
  fuzzySearchNearEnabled = nearEnabled;
  wholeWordMatchingEnabled = wholeWordEnabled;
  console.log(
    `[BooleanExpressionUtils] Search settings updated: Boolean=${fuzzySearchBooleanEnabled}, NEAR=${fuzzySearchNearEnabled}, WholeWord=${wholeWordMatchingEnabled}`
  );
}

/**
 * Evaluates a boolean AST against content
 * @param node The AST node to evaluate
 * @param content The content to evaluate against
 * @param caseSensitive Whether to use case-sensitive matching
 * @returns Whether the content matches the boolean expression
 */
export function evaluateBooleanAst(
  node: Jsep.Expression,
  content: string,
  caseSensitive = false
): boolean {
  try {
    const wordBoundaryService = WordBoundaryService.getInstance();

    switch (node.type) {
      case "BinaryExpression": {
        const binaryNode = node as Jsep.BinaryExpression;
        const left = evaluateBooleanAst(
          binaryNode.left,
          content,
          caseSensitive
        );
        const right = evaluateBooleanAst(
          binaryNode.right,
          content,
          caseSensitive
        );

        switch (binaryNode.operator) {
          case "&&":
          case "AND":
            return left && right;
          case "||":
          case "OR":
            return left || right;
          default:
            console.warn(
              `Unsupported binary operator: ${binaryNode.operator}`
            );
            return false;
        }
      }
      case "UnaryExpression": {
        const unaryNode = node as Jsep.UnaryExpression;
        if (unaryNode.operator === "!" || unaryNode.operator === "NOT") {
          return !evaluateBooleanAst(unaryNode.argument, content, caseSensitive);
        }
        console.warn(`Unsupported unary operator: ${unaryNode.operator}`);
        return false;
      }
      case "CallExpression": {
        const callNode = node as Jsep.CallExpression;
        const callee = callNode.callee as Jsep.Identifier;

        if (callee.name === "NEAR" || callee.name === "near") {
          if (callNode.arguments.length < 3) {
            console.warn(
              "NEAR function requires at least 3 arguments: NEAR(term1, term2, distance)"
            );
            return false;
          }

          const term1Arg = callNode.arguments[0];
          const term2Arg = callNode.arguments[1];
          const distanceArg = callNode.arguments[2];

          // Extract terms
          let term1 = "";
          let term2 = "";
          let distance = 10; // Default distance

          // Extract term1
          if (term1Arg.type === "Literal") {
            term1 = String((term1Arg as Jsep.Literal).value);
          } else {
            console.warn("First argument to NEAR must be a string literal");
            return false;
          }

          // Extract term2
          if (term2Arg.type === "Literal") {
            term2 = String((term2Arg as Jsep.Literal).value);
          } else {
            console.warn("Second argument to NEAR must be a string literal");
            return false;
          }

          // Extract distance
          if (distanceArg.type === "Literal") {
            const distVal = (distanceArg as Jsep.Literal).value;
            distance = typeof distVal === "number" ? distVal : parseInt(String(distVal), 10);
            if (isNaN(distance)) {
              console.warn("Third argument to NEAR must be a number");
              return false;
            }
          } else {
            console.warn("Third argument to NEAR must be a number literal");
            return false;
          }

          // Use the optimized NearOperatorService
          const nearOperatorService = NearOperatorService.getInstance();

           
          return nearOperatorService.evaluateNear(
            content,
            term1,
            term2,
            distance,
            {
              caseSensitive,
              fuzzySearchEnabled: fuzzySearchNearEnabled,
              wholeWordMatchingEnabled,
            }
          );
        }
        console.warn(`Unsupported function call: ${callee.name}`);
        return false;
      }
      case "Literal": {
        const literalNode = node as Jsep.Literal;
        const termLiteralStr = String(literalNode.value);

        // If it's a quoted string, remove the quotes
        let searchTerm = termLiteralStr;
        if (
          (searchTerm.startsWith('"') && searchTerm.endsWith('"')) ||
          (searchTerm.startsWith("'") && searchTerm.endsWith("'"))
        ) {
          searchTerm = searchTerm.substring(1, searchTerm.length - 1);
        }

        // Check if the term is a regex pattern
        const regexMatch = /^\/(.+)\/([gimuy]*)$/.exec(searchTerm);
        if (regexMatch) {
          try {
            const pattern = regexMatch[1];
            const flags = regexMatch[2] + (caseSensitive ? "" : "i");
            const regex = new RegExp(pattern, flags);
            return regex.test(content);
          } catch (regexError) {
            console.error("Invalid regex in boolean expression:", regexError);
            return false;
          }
        } else {
          // Simple term search
          let found = false;

          if (wholeWordMatchingEnabled) {
            // Use word boundary service for whole word matching
            const wordBoundaries = wordBoundaryService.getWordBoundaries(content);
            found = wordBoundaryService.isWholeWordMatch(
              content,
              searchTerm,
              wordBoundaries,
              caseSensitive
            );
          } else if (caseSensitive) {
            found = content.includes(searchTerm);
          } else {
            found = content.toLowerCase().includes(searchTerm.toLowerCase());
          }

          // If exact match fails, try fuzzy search if enabled
          // Apply fuzzy search when no match was found and fuzzy search is enabled
          if (!found && searchTerm.length >= 3 && fuzzySearchBooleanEnabled) {
            // Use the optimized FuzzySearchService
            const fuzzySearchService = FuzzySearchService.getInstance();

            const fuzzyResult = fuzzySearchService.search(
              content,
              searchTerm,
              {
                isCaseSensitive: caseSensitive,
                useWholeWordMatching: wholeWordMatchingEnabled,
              }
            );

            found = fuzzyResult.isMatch;
            console.log(
              `[AST Eval] Fuzzy search: ${found ? "FOUND" : "NOT FOUND"} (score: ${fuzzyResult.score || "N/A"})`
            );
          }

          console.log(
            `[AST Eval] Term search result: ${found} for term "${termLiteralStr}"`
          );
          return found;
        }
      }
      case "Compound": {
        const compoundNode = node as Jsep.Compound;
        let result = false;
        for (const child of compoundNode.body) {
          result = evaluateBooleanAst(child, content, caseSensitive);
        }
        return result;
      }
      default: {
        if (typeof node.value === "boolean") {
          return node.value;
        }
        console.warn(`Unsupported AST node type: ${String(node.type)}`);
        return false;
      }
    }
  } catch (evalError: unknown) {
    const message =
      evalError instanceof Error ? evalError.message : String(evalError);
    console.error(
      "Error during boolean AST evaluation:",
      message,
      "Node:",
      node
    );
    // Clean up any cached data if evaluation fails
    if (typeof content === "string") {
      const wordBoundaryService = WordBoundaryService.getInstance();
      wordBoundaryService.removeFromCache(content);
    }
    return false;
  }
}

/**
 * Parses a boolean expression string into an AST
 * @param expression The boolean expression to parse
 * @returns The parsed AST
 */
export function parseBooleanExpression(expression: string): Jsep.Expression {
  try {
    return jsep(expression);
  } catch (error) {
    console.error("Error parsing boolean expression:", error);
    throw error;
  }
}
