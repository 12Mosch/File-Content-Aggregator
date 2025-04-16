// Import jest-dom for DOM element assertions
import "@testing-library/jest-dom";

/* global window, jest, beforeEach, console */

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

// Suppress console logs during tests
beforeEach(() => {
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
});
