# Troubleshooting Guide

This document provides solutions for common issues you might encounter when using the File Content Aggregator.

## Search Issues

### "UI: Search failed: Error: Error invoking remote method 'search-files': reply was never sent"

This error occurs when the IPC communication between the renderer process and the main process times out or fails.

**Possible causes:**
- Large search operations that exceed memory limits
- Complex regex patterns that take too long to process
- Too many files being processed simultaneously

**Solutions:**
- Narrow your search scope by specifying more targeted search paths
- Use simpler search terms or regex patterns
- Increase the memory allocated to the application (if running from source)
- Break up large searches into smaller, more manageable chunks
- Ensure your search excludes large binary files or directories with many files

**Technical details:**
The application now includes timeout handling and memory monitoring to prevent this issue. If you still encounter this error, please report it with details about your search parameters and system configuration.

## Performance Issues

### Slow Search Performance

If searches are taking too long to complete:

- Use more specific search paths to reduce the number of files scanned
- Add common binary file extensions to the excluded file types
- Disable fuzzy search for large searches
- Use the "Whole Word" option when searching for specific terms
- Consider increasing cache size in the Cache Settings

### High Memory Usage

If the application is using too much memory:

- Reduce the cache size in the Cache Settings
- Break up large searches into smaller batches
- Restart the application between large search operations
- Exclude large binary files from searches

## Application Issues

### Application Continues Running After Closing

If the application continues running in the background after closing the window:

- Use the "File > Exit" menu option instead of closing the window
- If running from source, use Ctrl+C in the terminal to terminate the process
- Check Task Manager (Windows) or Activity Monitor (Mac) to end the process

## Reporting Issues

If you encounter issues not covered in this guide, please report them on our GitHub repository with the following information:

1. Detailed description of the issue
2. Steps to reproduce
3. System information (OS, memory, etc.)
4. Search parameters used (if applicable)
5. Any error messages or logs
