import path from "path";
import picomatch from "picomatch";
import "@jest/globals";

// Mock the functions we want to test
const parseRegexLiteral = (pattern: string): RegExp | null => {
  const regexMatch = pattern.match(/^\/(.+)\/([gimyus]*)$/);
  if (regexMatch) {
    try {
      return new RegExp(regexMatch[1], regexMatch[2]);
    } catch (e) {
      return null;
    }
  }
  return null;
};

const isDirectoryExcluded = (
  dirPath: string,
  excludeFolders: string[],
  folderExclusionMode: "contains" | "exact" | "startsWith" | "endsWith"
): boolean => {
  if (!excludeFolders || excludeFolders.length === 0) {
    return false;
  }

  const picoOptions = { dot: true, nocase: true }; // Case-insensitive folder matching
  const folderMatchers = excludeFolders.map((pattern) => {
    let matchPattern = pattern;
    switch (folderExclusionMode) {
      case "startsWith":
        matchPattern = pattern + "*";
        break;
      case "endsWith":
        matchPattern = "*" + pattern;
        break;
      case "contains":
        if (!pattern.includes("*") && !pattern.includes("?"))
          matchPattern = "*" + pattern + "*";
        break;
      case "exact":
      default:
        break;
    }
    return picomatch(matchPattern, picoOptions);
  });

  // Split path into segments, handling both Windows and POSIX separators
  const segments = dirPath.replace(/\\/g, "/").split("/").filter(Boolean);

  // Check if any segment matches any exclusion pattern
  return folderMatchers.some((isMatch) =>
    segments.some((segment) => isMatch(segment))
  );
};

describe("File Filtering", () => {
  describe("File Extension Filtering", () => {
    test("should match files with specified extensions", () => {
      const filePath = "/path/to/file.txt";
      const extensions = [".txt", ".md"];

      const matches = extensions.some((ext) => filePath.endsWith(ext));
      expect(matches).toBe(true);
    });

    test("should not match files with different extensions", () => {
      const filePath = "/path/to/file.jpg";
      const extensions = [".txt", ".md"];

      const matches = extensions.some((ext) => filePath.endsWith(ext));
      expect(matches).toBe(false);
    });

    test("should handle extensions with and without dots", () => {
      const filePath = "/path/to/file.txt";
      const extensions = ["txt", ".md"];

      const normalizedExtensions = extensions.map((ext) =>
        ext.startsWith(".") ? ext : `.${ext}`
      );
      const matches = normalizedExtensions.some((ext) =>
        filePath.endsWith(ext)
      );
      expect(matches).toBe(true);
    });
  });

  describe("File Path Inclusion/Exclusion", () => {
    test("should exclude files matching exact pattern", () => {
      const filename = "config.json";
      const excludePatterns = ["config.json"];

      const isExcluded = excludePatterns.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });

      expect(isExcluded).toBe(true);
    });

    test("should exclude files matching glob pattern", () => {
      const filename = "test.log";
      const excludePatterns = ["*.log"];

      const isExcluded = excludePatterns.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });

      expect(isExcluded).toBe(true);
    });

    test("should exclude files matching regex pattern", () => {
      const filename = "test123.tmp";
      const excludePatterns = ["/test\\d+\\.tmp/"];

      const isExcluded = excludePatterns.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });

      expect(isExcluded).toBe(true);
    });

    test("should not exclude files not matching any pattern", () => {
      const filename = "important.txt";
      const excludePatterns = ["*.log", "*.tmp", "config.*"];

      const isExcluded = excludePatterns.some((pattern) => {
        const regex = parseRegexLiteral(pattern);
        if (regex) return regex.test(filename);
        return picomatch.isMatch(filename, pattern, { dot: true });
      });

      expect(isExcluded).toBe(false);
    });
  });

  describe("Directory Exclusion", () => {
    test("should exclude directory with 'contains' mode", () => {
      const dirPath = "/path/to/node_modules/package";
      const excludeFolders = ["node_modules"];
      const folderExclusionMode = "contains";

      const result = isDirectoryExcluded(
        dirPath,
        excludeFolders,
        folderExclusionMode
      );
      expect(result).toBe(true);
    });

    test("should exclude directory with 'startsWith' mode", () => {
      const dirPath = "/path/to/temp_folder";
      const excludeFolders = ["temp"];
      const folderExclusionMode = "startsWith";

      const result = isDirectoryExcluded(
        dirPath,
        excludeFolders,
        folderExclusionMode
      );
      expect(result).toBe(true);
    });

    test("should exclude directory with 'endsWith' mode", () => {
      const dirPath = "/path/to/old_backup";
      const excludeFolders = ["backup"];
      const folderExclusionMode = "endsWith";

      const result = isDirectoryExcluded(
        dirPath,
        excludeFolders,
        folderExclusionMode
      );
      expect(result).toBe(true);
    });

    test("should exclude directory with 'exact' mode", () => {
      const dirPath = "/path/to/dist";
      const excludeFolders = ["dist"];
      const folderExclusionMode = "exact";

      const result = isDirectoryExcluded(
        dirPath,
        excludeFolders,
        folderExclusionMode
      );
      expect(result).toBe(true);
    });

    test("should not exclude directory not matching pattern", () => {
      const dirPath = "/path/to/src";
      const excludeFolders = ["node_modules", "dist", "temp"];
      const folderExclusionMode = "contains";

      const result = isDirectoryExcluded(
        dirPath,
        excludeFolders,
        folderExclusionMode
      );
      expect(result).toBe(false);
    });
  });

  describe("File Size Filtering", () => {
    test("should filter files by minimum size", () => {
      const fileStats = { size: 1024, mtime: new Date() };
      const minSizeBytes = 500;
      const maxSizeBytes = undefined;

      const passSizeCheck =
        (minSizeBytes === undefined || fileStats.size >= minSizeBytes) &&
        (maxSizeBytes === undefined || fileStats.size <= maxSizeBytes);

      expect(passSizeCheck).toBe(true);
    });

    test("should filter files by maximum size", () => {
      const fileStats = { size: 1024, mtime: new Date() };
      const minSizeBytes = undefined;
      const maxSizeBytes = 2048;

      const passSizeCheck =
        (minSizeBytes === undefined || fileStats.size >= minSizeBytes) &&
        (maxSizeBytes === undefined || fileStats.size <= maxSizeBytes);

      expect(passSizeCheck).toBe(true);
    });

    test("should filter files by size range", () => {
      const fileStats = { size: 1024, mtime: new Date() };
      const minSizeBytes = 500;
      const maxSizeBytes = 2048;

      const passSizeCheck =
        (minSizeBytes === undefined || fileStats.size >= minSizeBytes) &&
        (maxSizeBytes === undefined || fileStats.size <= maxSizeBytes);

      expect(passSizeCheck).toBe(true);
    });

    test("should exclude files outside size range", () => {
      const fileStats = { size: 3072, mtime: new Date() };
      const minSizeBytes = 500;
      const maxSizeBytes = 2048;

      const passSizeCheck =
        (minSizeBytes === undefined || fileStats.size >= minSizeBytes) &&
        (maxSizeBytes === undefined || fileStats.size <= maxSizeBytes);

      expect(passSizeCheck).toBe(false);
    });
  });

  describe("File Date Filtering", () => {
    test("should filter files by modified after date", () => {
      const fileStats = { size: 1024, mtime: new Date("2023-01-15") };
      const afterDate = new Date("2023-01-01");
      const beforeDate = undefined;

      const passDateCheck =
        (!afterDate || fileStats.mtime.getTime() >= afterDate.getTime()) &&
        (!beforeDate || fileStats.mtime.getTime() <= beforeDate.getTime());

      expect(passDateCheck).toBe(true);
    });

    test("should filter files by modified before date", () => {
      const fileStats = { size: 1024, mtime: new Date("2023-01-15") };
      const afterDate = undefined;
      const beforeDate = new Date("2023-01-31");

      const passDateCheck =
        (!afterDate || fileStats.mtime.getTime() >= afterDate.getTime()) &&
        (!beforeDate || fileStats.mtime.getTime() <= beforeDate.getTime());

      expect(passDateCheck).toBe(true);
    });

    test("should filter files by date range", () => {
      const fileStats = { size: 1024, mtime: new Date("2023-01-15") };
      const afterDate = new Date("2023-01-01");
      const beforeDate = new Date("2023-01-31");

      const passDateCheck =
        (!afterDate || fileStats.mtime.getTime() >= afterDate.getTime()) &&
        (!beforeDate || fileStats.mtime.getTime() <= beforeDate.getTime());

      expect(passDateCheck).toBe(true);
    });

    test("should exclude files outside date range", () => {
      const fileStats = { size: 1024, mtime: new Date("2023-02-15") };
      const afterDate = new Date("2023-01-01");
      const beforeDate = new Date("2023-01-31");

      const passDateCheck =
        (!afterDate || fileStats.mtime.getTime() >= afterDate.getTime()) &&
        (!beforeDate || fileStats.mtime.getTime() <= beforeDate.getTime());

      expect(passDateCheck).toBe(false);
    });
  });

  describe("Maximum Depth Filtering", () => {
    test("should respect maximum depth setting", () => {
      const filePath = "/path/to/deeply/nested/file.txt";
      const basePath = "/path";
      const maxDepth = 3;

      // Calculate the depth relative to the base path
      const relativePath = path.relative(basePath, filePath);
      const segments = relativePath.split(path.sep);
      const depth = segments.length;

      const withinMaxDepth = maxDepth === undefined || depth <= maxDepth;
      expect(withinMaxDepth).toBe(false);
    });

    test("should include files within maximum depth", () => {
      const filePath = "/path/to/file.txt";
      const basePath = "/path";
      const maxDepth = 3;

      // Calculate the depth relative to the base path
      const relativePath = path.relative(basePath, filePath);
      const segments = relativePath.split(path.sep);
      const depth = segments.length;

      const withinMaxDepth = maxDepth === undefined || depth <= maxDepth;
      expect(withinMaxDepth).toBe(true);
    });
  });
});
