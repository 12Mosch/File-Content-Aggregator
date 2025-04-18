// Import jest-dom for DOM element assertions
import "@testing-library/jest-dom";

/* global window, jest, beforeEach, console, global */

// Mock window.matchMedia which is not implemented in JSDOM
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // Deprecated
    removeListener: jest.fn(), // Deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock scrollIntoView which is not implemented in JSDOM
if (typeof window !== "undefined") {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
}

// Mock import.meta.url for tests
global.URL = class URL {
  constructor(url, base) {
    this.url = url;
    this.href = url;
    this.pathname = url;
  }
};

// Mock require for ES modules
global.require = jest.fn((module) => {
  if (module === "mime") {
    return { getType: jest.fn(() => "text/plain") };
  }
  if (module === "p-limit") {
    return jest.fn(() => {
      const fn = (f) => f();
      fn.activeCount = 0;
      fn.pendingCount = 0;
      fn.clearQueue = jest.fn();
      return fn;
    });
  }
  return {};
});

// Handle ESM-specific issues in performance tests
if (typeof jest !== "undefined") {
  jest.mock("url", () => ({
    fileURLToPath: jest.fn((url) => "mocked-path"),
    URL: global.URL,
  }));
}

// Suppress console logs during tests
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
