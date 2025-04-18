#!/usr/bin/env node
/**
 * Custom development script that ensures all processes are terminated when the Electron app is closed.
 * This script replaces the npm-run-all approach to ensure proper cleanup.
 */

/* eslint-disable no-undef */

import { spawn } from "child_process";
import { platform } from "os";

// Determine if we're on Windows
const isWindows = platform() === "win32";

// Store all child processes so we can terminate them
const processes = [];

// Function to kill all processes
function killAllProcesses() {
  console.log("Terminating all processes...");
  processes.forEach((proc) => {
    try {
      if (isWindows) {
        // On Windows, we need to use taskkill to ensure the process and its children are terminated
        spawn("taskkill", ["/pid", proc.pid, "/f", "/t"]);
      } else {
        proc.kill("SIGTERM");
      }
    } catch (error) {
      console.error(`Error killing process ${proc.pid}:`, error);
    }
  });

  // Force exit after a short delay to ensure everything is cleaned up
  setTimeout(() => {
    console.log("Forcing exit...");
    process.exit(0);
  }, 500);
}

// Start the Vite development server
console.log("Starting Vite development server...");
const viteProcess = spawn("npm", ["run", "dev:react"], {
  stdio: "inherit",
  shell: true,
});
processes.push(viteProcess);

// Give Vite a moment to start up
setTimeout(() => {
  // Start the Electron process
  console.log("Starting Electron...");
  const electronProcess = spawn("npm", ["run", "dev:electron"], {
    stdio: "inherit",
    shell: true,
  });
  processes.push(electronProcess);

  // Handle Electron process exit
  electronProcess.on("exit", (code) => {
    console.log(`Electron process exited with code ${code}`);
    killAllProcesses();
  });
}, 2000);

// Handle script termination signals
process.on("SIGINT", killAllProcesses);
process.on("SIGTERM", killAllProcesses);
process.on("exit", killAllProcesses);

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught exception:", error);
  killAllProcesses();
});
