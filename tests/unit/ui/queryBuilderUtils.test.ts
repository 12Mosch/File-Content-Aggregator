// Tests for query builder utility functions, especially escaping functionality

import {
  convertStructuredQueryToString,
  generateId,
  isQueryStructure,
} from "../../../src/ui/queryBuilderUtils.js";
import type { QueryGroup, TermCondition, NearCondition } from "../../../src/ui/queryBuilderTypes.js";

describe("queryBuilderUtils", () => {
  describe("generateId", () => {
    test("should generate unique IDs", () => {
      const id1 = generateId();
      const id2 = generateId();
      
      expect(id1).toMatch(/^qb_[a-z0-9]{7}$/);
      expect(id2).toMatch(/^qb_[a-z0-9]{7}$/);
      expect(id1).not.toBe(id2);
    });
  });

  describe("convertStructuredQueryToString - Escaping Security Fix", () => {
    test("should properly escape backslashes and quotes in term conditions", () => {
      const termCondition: TermCondition = {
        id: "test1",
        type: "term",
        value: 'test\\"value',  // Input with backslash followed by quote
        caseSensitive: false,
      };

      const queryGroup: QueryGroup = {
        id: "group1",
        operator: "AND",
        conditions: [termCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Should escape backslash first, then quote: test\\"value -> test\\\\"value -> test\\\\"value
      expect(result).toBe('"test\\\\\\"value"');
    });

    test("should handle multiple backslashes correctly", () => {
      const termCondition: TermCondition = {
        id: "test2",
        type: "term",
        value: 'test\\\\value',  // Input with double backslash
        caseSensitive: false,
      };

      const queryGroup: QueryGroup = {
        id: "group2",
        operator: "AND",
        conditions: [termCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Should escape each backslash: test\\value -> test\\\\value
      expect(result).toBe('"test\\\\\\\\value"');
    });

    test("should handle quotes without backslashes correctly", () => {
      const termCondition: TermCondition = {
        id: "test3",
        type: "term",
        value: 'test"value',  // Input with just a quote
        caseSensitive: false,
      };

      const queryGroup: QueryGroup = {
        id: "group3",
        operator: "AND",
        conditions: [termCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Should escape the quote: test"value -> test\"value
      expect(result).toBe('"test\\"value"');
    });

    test("should handle NEAR conditions with backslashes and quotes", () => {
      const nearCondition: NearCondition = {
        id: "test4",
        type: "near",
        term1: 'first\\"term',
        term2: 'second\\term',
        distance: 5,
      };

      const queryGroup: QueryGroup = {
        id: "group4",
        operator: "AND",
        conditions: [nearCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Both terms should be properly escaped
      expect(result).toBe('NEAR("first\\\\\\"term", "second\\\\term", 5)');
    });

    test("should handle complex injection attempt", () => {
      // This simulates a potential injection attempt where someone tries to break out of quotes
      const termCondition: TermCondition = {
        id: "test5",
        type: "term",
        value: 'value\\" OR 1=1 --',  // Potential SQL-like injection attempt
        caseSensitive: false,
      };

      const queryGroup: QueryGroup = {
        id: "group5",
        operator: "AND",
        conditions: [termCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Should be properly escaped and contained within quotes
      expect(result).toBe('"value\\\\\\" OR 1=1 --"');
      // Verify the result starts and ends with quotes and contains the escaped content
      expect(result.startsWith('"')).toBe(true);
      expect(result.endsWith('"')).toBe(true);
      expect(result).toContain('\\"'); // Contains escaped quote
    });

    test("should handle empty and whitespace values", () => {
      const termCondition: TermCondition = {
        id: "test6",
        type: "term",
        value: '',  // Empty value
        caseSensitive: false,
      };

      const queryGroup: QueryGroup = {
        id: "group6",
        operator: "AND",
        conditions: [termCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);
      
      // Empty values should result in empty string
      expect(result).toBe('');
    });

    test("should properly escape backslashes and forward slashes in regex conditions", () => {
      const regexCondition = {
        id: "test7",
        type: "regex" as const,
        value: 'test\\/pattern\\with\\backslashes',  // Input with backslashes and forward slashes
        flags: "gi",
      };

      const queryGroup: QueryGroup = {
        id: "group7",
        operator: "AND",
        conditions: [regexCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);

      // Should escape backslashes first, then forward slashes
      expect(result).toBe('/test\\\\\\/pattern\\\\with\\\\backslashes/gi');
    });

    test("should handle regex patterns in NEAR conditions with backslashes", () => {
      const nearCondition = {
        id: "test8",
        type: "near" as const,
        term1: '/pattern\\with\\backslashes/gi',  // Regex with backslashes
        term2: '/another\\/pattern/i',  // Regex with forward slashes
        distance: 3,
      };

      const queryGroup: QueryGroup = {
        id: "group8",
        operator: "AND",
        conditions: [nearCondition],
      };

      const result = convertStructuredQueryToString(queryGroup);

      // Both regex patterns should have proper escaping
      expect(result).toBe('NEAR(/pattern\\\\with\\\\backslashes/gi, /another\\\\\\/pattern/i, 3)');
    });
  });

  describe("isQueryStructure", () => {
    test("should validate correct query structure", () => {
      const validQuery: QueryGroup = {
        id: "test",
        operator: "AND",
        conditions: [
          {
            id: "term1",
            type: "term",
            value: "test",
            caseSensitive: false,
          },
        ],
      };

      expect(isQueryStructure(validQuery)).toBe(true);
    });

    test("should reject invalid query structure", () => {
      const invalidQuery = {
        id: "test",
        operator: "INVALID",
        conditions: [],
      };

      expect(isQueryStructure(invalidQuery)).toBe(false);
    });
  });
});
