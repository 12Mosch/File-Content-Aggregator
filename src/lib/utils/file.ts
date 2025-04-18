/**
 * File Utility Functions
 * 
 * Utility functions for file operations and path handling.
 */

import path from 'path';
import fs from 'fs/promises';
import { AppError } from '../errors';

/**
 * Check if a file exists
 * @param filePath Path to the file
 * @returns True if the file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    return stats.isFile();
  } catch (error) {
    return false;
  }
}

/**
 * Check if a directory exists
 * @param dirPath Path to the directory
 * @returns True if the directory exists
 */
export async function directoryExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(dirPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Create a directory if it doesn't exist
 * @param dirPath Path to the directory
 * @param recursive Whether to create parent directories
 * @returns True if the directory was created
 */
export async function ensureDirectory(dirPath: string, recursive = true): Promise<boolean> {
  try {
    if (await directoryExists(dirPath)) {
      return false; // Directory already exists
    }
    
    await fs.mkdir(dirPath, { recursive });
    return true;
  } catch (error) {
    throw AppError.fromUnknown(error, `Failed to create directory: ${dirPath}`);
  }
}

/**
 * Read a file with error handling
 * @param filePath Path to the file
 * @param encoding File encoding
 * @returns File contents
 */
export async function readFile(filePath: string, encoding: BufferEncoding = 'utf8'): Promise<string> {
  try {
    return await fs.readFile(filePath, { encoding });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw AppError.fileNotFound(filePath);
    }
    throw AppError.fileAccessError(filePath, error);
  }
}

/**
 * Write to a file with error handling
 * @param filePath Path to the file
 * @param data Data to write
 * @param encoding File encoding
 */
export async function writeFile(
  filePath: string,
  data: string | Buffer,
  encoding: BufferEncoding = 'utf8'
): Promise<void> {
  try {
    // Ensure the directory exists
    const dirPath = path.dirname(filePath);
    await ensureDirectory(dirPath);
    
    // Write the file
    await fs.writeFile(filePath, data, { encoding });
  } catch (error) {
    throw AppError.fileAccessError(filePath, error);
  }
}

/**
 * Delete a file with error handling
 * @param filePath Path to the file
 * @returns True if the file was deleted
 */
export async function deleteFile(filePath: string): Promise<boolean> {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false; // File doesn't exist
    }
    throw AppError.fileAccessError(filePath, error);
  }
}

/**
 * Get file stats with error handling
 * @param filePath Path to the file
 * @returns File stats
 */
export async function getFileStats(filePath: string): Promise<fs.Stats> {
  try {
    return await fs.stat(filePath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw AppError.fileNotFound(filePath);
    }
    throw AppError.fileAccessError(filePath, error);
  }
}

/**
 * List files in a directory with error handling
 * @param dirPath Path to the directory
 * @param options Options for listing files
 * @returns Array of file paths
 */
export async function listFiles(
  dirPath: string,
  options: {
    recursive?: boolean;
    filter?: (filePath: string) => boolean;
  } = {}
): Promise<string[]> {
  const { recursive = false, filter } = options;
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    const files: string[] = [];
    
    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && recursive) {
        const subFiles = await listFiles(entryPath, options);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        if (!filter || filter(entryPath)) {
          files.push(entryPath);
        }
      }
    }
    
    return files;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw AppError.fileNotFound(dirPath);
    }
    throw AppError.fileAccessError(dirPath, error);
  }
}

/**
 * Get the file extension
 * @param filePath Path to the file
 * @returns File extension (lowercase, without the dot)
 */
export function getFileExtension(filePath: string): string {
  return path.extname(filePath).slice(1).toLowerCase();
}

/**
 * Check if a file has a specific extension
 * @param filePath Path to the file
 * @param extensions Array of extensions to check (without the dot)
 * @returns True if the file has one of the specified extensions
 */
export function hasFileExtension(filePath: string, extensions: string[]): boolean {
  const ext = getFileExtension(filePath);
  return extensions.includes(ext);
}

/**
 * Get the file name without extension
 * @param filePath Path to the file
 * @returns File name without extension
 */
export function getFileNameWithoutExtension(filePath: string): string {
  const basename = path.basename(filePath);
  const extname = path.extname(basename);
  return basename.slice(0, basename.length - extname.length);
}

/**
 * Normalize a file path
 * @param filePath Path to normalize
 * @returns Normalized path
 */
export function normalizePath(filePath: string): string {
  return path.normalize(filePath).replace(/\\/g, '/');
}

/**
 * Get the relative path from one path to another
 * @param from Source path
 * @param to Destination path
 * @returns Relative path
 */
export function getRelativePath(from: string, to: string): string {
  return normalizePath(path.relative(from, to));
}

/**
 * Join path segments
 * @param segments Path segments to join
 * @returns Joined path
 */
export function joinPaths(...segments: string[]): string {
  return normalizePath(path.join(...segments));
}

/**
 * Resolve a path to an absolute path
 * @param filePath Path to resolve
 * @returns Absolute path
 */
export function resolvePath(filePath: string): string {
  return normalizePath(path.resolve(filePath));
}
