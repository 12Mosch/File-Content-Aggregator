/**
 * Jest setup file for ES module compatibility
 * This file handles the setup needed for proper ES module support in Jest
 */

/* eslint-env node */
/* global global */

// Set up global variables that might be needed for ES module compatibility
global.__filename = "mock-filename";
global.__dirname = "mock-dirname";

// Handle the require function conflict in ES modules
// This prevents the "Identifier 'require' has already been declared" error
const originalRequire = global.require;

// Mock module.createRequire to return the existing require function
// This prevents conflicts when code tries to create its own require function
global.module = global.module || {};
global.module.createRequire = () => originalRequire;

// Mock import.meta for Jest compatibility
// This needs to be set up before any modules are loaded
if (typeof globalThis !== "undefined") {
  // Use globalThis if available (modern environments)
  globalThis.importMeta = {
    url: "file:///mock/url",
  };
} else {
  // Fallback for older environments
  global.importMeta = {
    url: "file:///mock/url",
  };
}

// Also set up import.meta directly on global for better compatibility
global.import = global.import || {};
global.import.meta = global.import.meta || {
  url: "file:///mock/url",
};
