/** @type {import('jest').Config} */
const config = {
  preset: "ts-jest/presets/js-with-ts-esm",
  testEnvironment: "jsdom",
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        useESM: true,
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  // Define test locations
  testMatch: ["**/tests/**/*.test.[jt]s?(x)", "**/?(*.)+(spec|test).[jt]s?(x)"],
  // Group tests by type
  testPathIgnorePatterns: ["/node_modules/", "/dist/"],
  // Configure coverage reporting
  collectCoverageFrom: ["src/**/*.{js,jsx,ts,tsx}", "!src/**/*.d.ts"],
  // Configure test result reporters
  reporters: ["default"],
  // Configure test timeouts
  testTimeout: 10000,
  // Configure setup files
  setupFilesAfterEnv: ["./tests/setup.js"],
  // Handle ES modules
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
    // Mock import.meta.url for tests
    "\\.\\.(css|less|scss|sass)$": "identity-obj-proxy",
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(.+\\\\.mjs$)|p-limit|electron-store)",
  ],
  // Mock environment variables
  globals: {
    "import.meta": {
      url: "file:///mock/url",
    },
    // Add __filename and __dirname for ESM compatibility
    __filename: "mock-filename",
    __dirname: "mock-dirname",
  },
};

export default config;
