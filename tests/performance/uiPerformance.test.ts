import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { performance } from 'perf_hooks';
import fs from 'fs/promises';
import path from 'path';
import ResultsDisplay from '../../src/ui/ResultsDisplay';
import type { StructuredItem } from '../../src/ui/vite-env.d';

// Mock the necessary dependencies
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' }
  })
}));

// Mock the worker
jest.mock('../../src/ui/highlight.worker.ts', () => {
  return {
    __esModule: true,
    default: class MockWorker {
      onmessage: ((event: MessageEvent) => void) | null = null;
      
      constructor() {
        setTimeout(() => {
          if (this.onmessage) {
            this.onmessage(new MessageEvent('message', {
              data: {
                filePath: 'test.txt',
                highlightedHtml: '<span>test</span>',
                status: 'done'
              }
            }));
          }
        }, 10);
      }
      
      postMessage(data: any) {
        // Mock implementation
      }
    }
  };
});

// Helper function to generate mock structured items
function generateMockItems(count: number): StructuredItem[] {
  const items: StructuredItem[] = [];
  
  for (let i = 0; i < count; i++) {
    items.push({
      filePath: `file${i}.txt`,
      fileName: `file${i}.txt`,
      fileSize: 1024,
      lastModified: new Date().toISOString(),
      matched: true,
      matchedLines: [],
      readError: null
    });
  }
  
  return items;
}

// Helper function to save test results
async function saveTestResults(testName: string, results: any): Promise<void> {
  const resultsDir = path.join(__dirname, '../../performance-results');
  
  try {
    await fs.mkdir(resultsDir, { recursive: true });
    const filePath = path.join(resultsDir, `${testName}-${new Date().toISOString().replace(/:/g, '-')}.json`);
    await fs.writeFile(filePath, JSON.stringify(results, null, 2));
    console.log(`Results saved to ${filePath}`);
  } catch (error) {
    console.error('Error saving test results:', error);
  }
}

describe('UI Performance Tests', () => {
  beforeEach(() => {
    // Mock window.URL.createObjectURL
    Object.defineProperty(window, 'URL', {
      value: {
        createObjectURL: jest.fn(() => 'blob:test'),
        revokeObjectURL: jest.fn()
      }
    });
    
    // Mock ResizeObserver
    global.ResizeObserver = class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });
  
  describe('ResultsDisplay Rendering Performance', () => {
    test('should measure initial render time with different result set sizes', async () => {
      const testSizes = [10, 100, 1000, 5000];
      const results = [];
      
      for (const size of testSizes) {
        const mockItems = generateMockItems(size);
        
        // Measure render time
        const startTime = performance.now();
        
        render(
          <ResultsDisplay
            structuredItems={mockItems}
            summary={{
              filesFound: size,
              filesProcessed: size,
              errorsEncountered: 0
            }}
            viewMode="tree"
            itemDisplayStates={new Map()}
            itemDisplayVersion={0}
            onToggleExpand={() => {}}
            onShowFullContent={() => {}}
            isFilterActive={false}
            filterTerm=""
            filterCaseSensitive={false}
            searchQueryStructure={null}
            searchQueryCaseSensitive={false}
            searchHighlightTerms={[]}
          />
        );
        
        const endTime = performance.now();
        const renderTime = endTime - startTime;
        
        results.push({
          itemCount: size,
          renderTime: `${renderTime.toFixed(2)} ms`
        });
        
        console.log(`Initial render with ${size} items: ${renderTime.toFixed(2)} ms`);
        
        // Clean up
        jest.clearAllMocks();
      }
      
      // Save results
      await saveTestResults('results-display-render-performance', results);
      
      // Basic assertion to ensure test runs
      expect(results.length).toBe(testSizes.length);
    });
    
    test('should measure interaction performance with large result sets', async () => {
      const mockItems = generateMockItems(1000);
      const results = [];
      
      // Create a map with some items expanded
      const itemDisplayStates = new Map();
      for (let i = 0; i < 10; i++) {
        itemDisplayStates.set(`file${i}.txt`, { expanded: true, showFull: false });
      }
      
      // Render the component
      render(
        <ResultsDisplay
          structuredItems={mockItems}
          summary={{
            filesFound: mockItems.length,
            filesProcessed: mockItems.length,
            errorsEncountered: 0
          }}
          viewMode="tree"
          itemDisplayStates={itemDisplayStates}
          itemDisplayVersion={0}
          onToggleExpand={() => {}}
          onShowFullContent={() => {}}
          isFilterActive={false}
          filterTerm=""
          filterCaseSensitive={false}
          searchQueryStructure={null}
          searchQueryCaseSensitive={false}
          searchHighlightTerms={[]}
        />
      );
      
      // Measure filter performance
      const filterStartTime = performance.now();
      
      // Simulate typing in the filter input
      const filterInput = screen.getByPlaceholderText('results:filterPlaceholder');
      fireEvent.change(filterInput, { target: { value: 'file1' } });
      
      const filterEndTime = performance.now();
      const filterTime = filterEndTime - filterStartTime;
      
      results.push({
        operation: 'Filter Results',
        itemCount: mockItems.length,
        executionTime: `${filterTime.toFixed(2)} ms`
      });
      
      console.log(`Filter operation with ${mockItems.length} items: ${filterTime.toFixed(2)} ms`);
      
      // Save results
      await saveTestResults('results-display-interaction-performance', results);
      
      // Basic assertion to ensure test runs
      expect(results.length).toBeGreaterThan(0);
    });
  });
});
