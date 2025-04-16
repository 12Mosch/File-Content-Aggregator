import jsep from "jsep";
import "@jest/globals";

// Mock the functions we want to test
const parseRegexLiteral = (pattern: string): RegExp | null => {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (_e) {
      return null;
    }
  }
  return null;
};

describe("Search Term Parsing", () => {
  // Setup jsep for testing
  beforeEach(() => {
    // Configure jsep for AND/OR/NOT/NEAR
    // Reset jsep operators to ensure clean state
    if (jsep.binary_ops["||"]) jsep.removeBinaryOp("||");
    if (jsep.binary_ops["&&"]) jsep.removeBinaryOp("&&");
    if (jsep.unary_ops["!"]) jsep.removeUnaryOp("!");

    // Add our custom operators
    jsep.addBinaryOp("AND", 1);
    jsep.addBinaryOp("OR", 0);
    jsep.addUnaryOp("NOT");
  });

  describe("Simple Term Parsing", () => {
    test("should parse a simple term", () => {
      const term = "example";
      const ast = jsep(term);

      expect(ast.type).toBe("Identifier");
      expect(ast.name).toBe("example");
    });

    test("should parse a quoted term", () => {
      const term = '"example term"';
      const ast = jsep(term);

      expect(ast.type).toBe("Literal");
      expect(ast.value).toBe("example term");
    });
  });

  describe("Regex Pattern Parsing", () => {
    test("should parse a regex pattern", () => {
      const regexStr = "/pattern/";
      const regex = parseRegexLiteral(regexStr);

      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.source).toBe("pattern");
    });

    test("should parse a regex pattern with flags", () => {
      const regexStr = "/pattern/i";
      const regex = parseRegexLiteral(regexStr);

      expect(regex).toBeInstanceOf(RegExp);
      expect(regex?.source).toBe("pattern");
      expect(regex?.flags).toContain("i");
    });

    test("should return null for invalid regex patterns", () => {
      const invalidRegex = "/[unclosed/";
      const result = parseRegexLiteral(invalidRegex);

      expect(result).toBeNull();
    });

    test("should return null for non-regex strings", () => {
      const nonRegex = "just a string";
      const result = parseRegexLiteral(nonRegex);

      expect(result).toBeNull();
    });
  });

  describe("Boolean Expression Parsing", () => {
    test("should parse AND expression", () => {
      const expression = '"term1" AND "term2"';
      const ast = jsep(expression);

      expect(ast.type).toBe("BinaryExpression");
      expect(ast.operator).toBe("AND");
      expect(ast.left.type).toBe("Literal");
      expect(ast.right.type).toBe("Literal");
      expect(ast.left.value).toBe("term1");
      expect(ast.right.value).toBe("term2");
    });

    test("should parse OR expression", () => {
      const expression = '"term1" OR "term2"';
      const ast = jsep(expression);

      expect(ast.type).toBe("BinaryExpression");
      expect(ast.operator).toBe("OR");
      expect(ast.left.type).toBe("Literal");
      expect(ast.right.type).toBe("Literal");
      expect(ast.left.value).toBe("term1");
      expect(ast.right.value).toBe("term2");
    });

    test("should parse NOT expression", () => {
      const expression = 'NOT "term"';
      const ast = jsep(expression);

      expect(ast.type).toBe("UnaryExpression");
      expect(ast.operator).toBe("NOT");
      expect(ast.argument.type).toBe("Literal");
      expect(ast.argument.value).toBe("term");
    });

    test("should parse complex boolean expressions", () => {
      const expression = '("term1" AND "term2") OR NOT "term3"';
      const ast = jsep(expression);

      expect(ast.type).toBe("BinaryExpression");
      expect(ast.operator).toBe("OR");
      expect(ast.left.type).toBe("BinaryExpression");
      expect(ast.right.type).toBe("UnaryExpression");
    });
  });

  describe("NEAR Operator Parsing", () => {
    test("should parse NEAR function call", () => {
      const expression = 'NEAR("term1", "term2", 5)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.type).toBe("Identifier");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);
      expect(ast.arguments[0].type).toBe("Literal");
      expect(ast.arguments[1].type).toBe("Literal");
      expect(ast.arguments[2].type).toBe("Literal");
      expect(ast.arguments[0].value).toBe("term1");
      expect(ast.arguments[1].value).toBe("term2");
      expect(ast.arguments[2].value).toBe(5);
    });

    test("should parse NEAR with quoted terms containing special characters", () => {
      const expression =
        'NEAR("term with spaces", "term with \\"quotes\\"", 3)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);
      expect(ast.arguments[0].value).toBe("term with spaces");
      expect(ast.arguments[1].value).toBe('term with "quotes"');
      expect(ast.arguments[2].value).toBe(3);
    });

    test("should parse NEAR with regex patterns", () => {
      const expression = 'NEAR("/pattern1/", "/pattern2/", 10)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);
      expect(ast.arguments[0].value).toBe("/pattern1/");
      expect(ast.arguments[1].value).toBe("/pattern2/");
      expect(ast.arguments[2].value).toBe(10);
    });

    test("should parse NEAR with regex patterns containing flags", () => {
      const expression = 'NEAR("/pattern1/i", "/pattern2/g", 8)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);
      expect(ast.arguments[0].value).toBe("/pattern1/i");
      expect(ast.arguments[1].value).toBe("/pattern2/g");
      expect(ast.arguments[2].value).toBe(8);
    });

    test("should parse nested NEAR operators", () => {
      const expression = 'NEAR(NEAR("term1", "term2", 3), "term3", 5)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);

      // Check outer NEAR's third argument
      expect(ast.arguments[2].value).toBe(5);

      // Check inner NEAR
      const innerNear = ast.arguments[0];
      expect(innerNear.type).toBe("CallExpression");
      expect(innerNear.callee.name).toBe("NEAR");
      expect(innerNear.arguments.length).toBe(3);
      expect(innerNear.arguments[0].value).toBe("term1");
      expect(innerNear.arguments[1].value).toBe("term2");
      expect(innerNear.arguments[2].value).toBe(3);

      // Check outer NEAR's second argument
      expect(ast.arguments[1].value).toBe("term3");
    });

    test("should parse NEAR with complex nested expressions", () => {
      const expression =
        'NEAR(("term1" AND "term2"), ("term3" OR "term4"), 10)';
      const ast = jsep(expression);

      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);

      // Check first argument (AND expression)
      const firstArg = ast.arguments[0];
      expect(firstArg.type).toBe("BinaryExpression");
      expect(firstArg.operator).toBe("AND");
      expect(firstArg.left.value).toBe("term1");
      expect(firstArg.right.value).toBe("term2");

      // Check second argument (OR expression)
      const secondArg = ast.arguments[1];
      expect(secondArg.type).toBe("BinaryExpression");
      expect(secondArg.operator).toBe("OR");
      expect(secondArg.left.value).toBe("term3");
      expect(secondArg.right.value).toBe("term4");

      // Check distance
      expect(ast.arguments[2].value).toBe(10);
    });
  });

  describe("Invalid NEAR Syntax Handling", () => {
    test("should handle NEAR with missing arguments", () => {
      const invalidExpression = 'NEAR("term1")';

      // This should parse but will be handled as invalid during evaluation
      const ast = jsep(invalidExpression);
      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(1);
    });

    test("should handle NEAR with incorrect argument types", () => {
      const invalidExpression = 'NEAR("term1", "term2", "not-a-number")';

      // This should parse but the third argument won't be a number
      const ast = jsep(invalidExpression);
      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);
      expect(typeof ast.arguments[2].value).toBe("string");
      expect(ast.arguments[2].value).toBe("not-a-number");
    });

    test("should handle NEAR with negative distance", () => {
      const invalidExpression = 'NEAR("term1", "term2", -5)';

      // This should parse but the negative distance will be handled during evaluation
      const ast = jsep(invalidExpression);
      expect(ast.type).toBe("CallExpression");
      expect(ast.callee.name).toBe("NEAR");
      expect(ast.arguments.length).toBe(3);

      // Check that the third argument is a unary expression with a negative number
      expect(ast.arguments[2].type).toBe("UnaryExpression");
      expect(ast.arguments[2].operator).toBe("-");
      expect(ast.arguments[2].argument.value).toBe(5);
    });
  });

  describe("Invalid Syntax Handling", () => {
    test("should handle unbalanced parentheses", () => {
      const invalidExpression = '"term1" AND (term2';

      expect(() => {
        jsep(invalidExpression);
      }).toThrow();
    });

    test("should handle invalid operators", () => {
      const invalidExpression = '"term1" INVALID "term2"';

      // This should not throw but produce an AST that doesn't recognize INVALID as an operator
      const ast = jsep(invalidExpression);
      expect(ast.type).not.toBe("BinaryExpression");
    });
  });
});
