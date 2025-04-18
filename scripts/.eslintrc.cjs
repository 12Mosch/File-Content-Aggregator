module.exports = {
  env: {
    node: true, // This enables Node.js global variables and Node.js scoping
    es2022: true, // This enables ES2022 globals
  },
  rules: {
    // Allow console in scripts
    "no-console": "off",
    // Allow process in scripts
    "no-undef": "off",
    // Relax unused vars for scripts
    "@typescript-eslint/no-unused-vars": "warn",
  },
};
