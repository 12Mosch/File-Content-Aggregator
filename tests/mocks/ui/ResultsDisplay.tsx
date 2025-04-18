/**
 * Mock implementation of ResultsDisplay component for testing
 */

// Define the props interface
interface ResultsDisplayProps {
  structuredItems: Array<{ filePath: string; matched: boolean }>;
  summary: {
    filesFound: number;
    filesProcessed: number;
    errorsEncountered: number;
  };
  viewMode: string;
  itemDisplayStates: Record<string, any>;
  itemDisplayVersion: number;
  onToggleExpand: (filePath: string) => void;
  onShowFullContent: (filePath: string) => void;
  isFilterActive: boolean;
  filterTerm: string;
  filterCaseSensitive: boolean;
  searchQueryStructure: any;
  searchQueryCaseSensitive: boolean;
}

// Create a mock component
const ResultsDisplay = (props: ResultsDisplayProps) => {
  return {
    props,
    render: () => `<div>Results: ${props.structuredItems.length}</div>`,
  };
};

export default ResultsDisplay;
