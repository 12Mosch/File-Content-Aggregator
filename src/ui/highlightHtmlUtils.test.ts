import { highlightTermsInHtml } from './highlightHtmlUtils';

// Mock document.createElement for testing
const mockCreateElement = jest.fn();
const mockAppendChild = jest.fn();
const mockInsertBefore = jest.fn();
const mockRemoveChild = jest.fn();

// Setup DOM mocks
beforeEach(() => {
  // Reset mocks
  mockCreateElement.mockReset();
  mockAppendChild.mockReset();
  mockInsertBefore.mockReset();
  mockRemoveChild.mockReset();

  // Mock implementation for document.createElement
  document.createElement = mockCreateElement;

  // Mock implementation for DOM manipulation
  mockCreateElement.mockImplementation((tag) => {
    const element = {
      nodeType: 1, // ELEMENT_NODE
      nodeName: tag.toUpperCase(),
      className: '',
      textContent: '',
      innerHTML: '',
      childNodes: [],
      parentNode: null,
      appendChild: mockAppendChild,
      insertBefore: mockInsertBefore,
      removeChild: mockRemoveChild,
    };
    
    mockAppendChild.mockImplementation((child) => {
      element.childNodes.push(child);
      child.parentNode = element;
      return child;
    });
    
    mockInsertBefore.mockImplementation((newChild, refChild) => {
      const index = element.childNodes.indexOf(refChild);
      if (index !== -1) {
        element.childNodes.splice(index, 0, newChild);
      } else {
        element.childNodes.push(newChild);
      }
      newChild.parentNode = element;
      return newChild;
    });
    
    mockRemoveChild.mockImplementation((child) => {
      const index = element.childNodes.indexOf(child);
      if (index !== -1) {
        element.childNodes.splice(index, 1);
      }
      child.parentNode = null;
      return child;
    });
    
    return element;
  });

  // Mock document.createTextNode
  document.createTextNode = (text) => ({
    nodeType: 3, // TEXT_NODE
    nodeName: '#text',
    textContent: text,
    parentNode: null,
  });
});

describe('highlightTermsInHtml', () => {
  test('should return original HTML if no terms provided', () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    expect(highlightTermsInHtml(html, [], true)).toBe(html);
  });

  test('should return original HTML if empty HTML provided', () => {
    expect(highlightTermsInHtml('', ['test'], true)).toBe('');
  });

  test('should highlight string terms in HTML', () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    const result = highlightTermsInHtml(html, ['const'], true);
    
    // The result should contain a span with class "search-term-match"
    expect(result).toContain('search-term-match');
    expect(result).toContain('const');
  });

  test('should respect case sensitivity', () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    
    // Case-sensitive (should match)
    const resultSensitive = highlightTermsInHtml(html, ['const'], true);
    expect(resultSensitive).toContain('search-term-match');
    
    // Case-insensitive (should not match "CONST")
    const resultInsensitive = highlightTermsInHtml(html, ['CONST'], true);
    expect(resultInsensitive).not.toContain('search-term-match');
    
    // Case-insensitive (should match "CONST")
    const resultInsensitiveMatch = highlightTermsInHtml(html, ['CONST'], false);
    expect(resultInsensitiveMatch).toContain('search-term-match');
  });

  test('should handle regex terms', () => {
    const html = '<span class="hljs-keyword">const</span> x = 10;';
    const result = highlightTermsInHtml(html, [/con.t/], true);
    
    expect(result).toContain('search-term-match');
    expect(result).toContain('const');
  });
});
