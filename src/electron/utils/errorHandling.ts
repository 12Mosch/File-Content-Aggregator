/**
 * Error Handling Utilities for the Main Process
 *
 * Provides standardized error handling for the Electron main process.
 */

import { WebFrameMain, BrowserWindow } from "electron";
import { AppError } from "../../lib/errors.js";
import {
  getErrorHandler,
  ErrorSeverity,
  ErrorContext,
} from "../../lib/services/ErrorHandlingService.js";

/**
 * Validates that the IPC message sender is the main frame of the specified window.
 * @param senderFrame The WebFrameMain object of the sender
 * @param window The BrowserWindow to validate against
 * @returns True if the sender is valid, false otherwise
 */
export function validateSender(
  senderFrame: WebFrameMain | null,
  window: BrowserWindow | null
): boolean {
  if (!window || !senderFrame) return false;
  if (senderFrame === window.webContents.mainFrame) return true;

  // Log the validation failure
  const errorHandler = getErrorHandler();
  errorHandler.handleError(
    new AppError("Invalid IPC sender", "INVALID_SENDER", { senderFrame }),
    {
      severity: ErrorSeverity.HIGH,
      context: {
        component: "MainProcess",
        operation: "validateSender",
      },
    }
  );

  return false;
}

/**
 * Handle an IPC error with standardized logging and reporting
 * @param error Error that occurred
 * @param context Additional context about the error
 * @returns Formatted error object for IPC response
 */
export function handleIpcError(
  error: unknown,
  context: ErrorContext
): { success: false; error: string } {
  const errorHandler = getErrorHandler();
  const appError = errorHandler.handleError(error, {
    severity: ErrorSeverity.MEDIUM,
    context,
    showToUser: true,
  });

  // Return a standardized error response
  return {
    success: false,
    error: appError instanceof AppError ? appError.code : "UNKNOWN_ERROR",
  };
}

/**
 * Wrap an IPC handler with standardized error handling
 * @param handler The IPC handler function
 * @param componentName Name of the component for error reporting
 * @returns Wrapped handler with error handling
 */
export function wrapIpcHandler<T, R>(
  handler: (event: Electron.IpcMainInvokeEvent, ...args: T[]) => Promise<R>,
  componentName: string
): (
  event: Electron.IpcMainInvokeEvent,
  ...args: T[]
) => Promise<R | { success: false; error: string }> {
  return async (
    event: Electron.IpcMainInvokeEvent,
    ...args: T[]
  ): Promise<R | { success: false; error: string }> => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      return handleIpcError(error, {
        component: componentName,
        operation: handler.name || "ipcHandler",
        data: { args },
      });
    }
  };
}

/**
 * Create a standardized error response for IPC handlers
 * @param errorCode Error code
 * @param errorMessage Error message
 * @returns Standardized error response
 */
export function createErrorResponse(
  errorCode: string,
  errorMessage?: string
): { success: false; error: string; message?: string } {
  return {
    success: false,
    error: errorCode,
    ...(errorMessage ? { message: errorMessage } : {}),
  };
}
