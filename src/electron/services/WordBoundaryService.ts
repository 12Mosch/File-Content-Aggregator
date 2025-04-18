/**
 * WordBoundaryService
 * 
 * A service for efficiently managing word boundaries in text content.
 * This service implements an LRU cache to avoid recalculating word boundaries
 * for the same content multiple times.
 */

import { LRUCache } from '../../lib/LRUCache';

export interface WordBoundary {
  word: string;
  start: number;
  end: number;
}

export class WordBoundaryService {
  private static instance: WordBoundaryService;
  
  // Use LRU cache with a reasonable size limit to prevent memory leaks
  private boundariesCache = new LRUCache<string, WordBoundary[]>(50);
  
  // Private constructor for singleton pattern
  private constructor() {}
  
  /**
   * Gets the singleton instance of WordBoundaryService
   * @returns The WordBoundaryService instance
   */
  public static getInstance(): WordBoundaryService {
    if (!WordBoundaryService.instance) {
      WordBoundaryService.instance = new WordBoundaryService();
    }
    return WordBoundaryService.instance;
  }
  
  /**
   * Gets word boundaries for the given content
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  public getWordBoundaries(content: string): WordBoundary[] {
    // Generate a hash of the content to use as a cache key
    const contentHash = this.hashString(content);
    
    // Check if boundaries are already cached
    const cachedBoundaries = this.boundariesCache.get(contentHash);
    if (cachedBoundaries) {
      return cachedBoundaries;
    }
    
    // Calculate word boundaries
    const boundaries = this.calculateWordBoundaries(content);
    
    // Cache the result
    this.boundariesCache.set(contentHash, boundaries);
    
    return boundaries;
  }
  
  /**
   * Finds the word index corresponding to a character index
   * @param charIndex The character index
   * @param content The text content
   * @returns The word index (0-based) or -1 if not found
   */
  public getWordIndexFromCharIndex(charIndex: number, content: string): number {
    const boundaries = this.getWordBoundaries(content);
    
    // Check if charIndex falls directly within a word boundary
    for (let i = 0; i < boundaries.length; i++) {
      if (charIndex >= boundaries[i].start && charIndex <= boundaries[i].end) {
        return i;
      }
    }
    
    // If not directly within, check if it's immediately after a word (separated by whitespace)
    // This helps associate indices in whitespace with the preceding word for distance calculation
    for (let i = boundaries.length - 1; i >= 0; i--) {
      if (boundaries[i].end < charIndex) {
        // Check if the space between the word end and charIndex is only whitespace
        if (/^\s*$/.test(content.substring(boundaries[i].end + 1, charIndex + 1))) {
          return i; // Associate with the preceding word
        }
        // If non-whitespace is found, stop searching backwards
        break;
      }
    }
    
    // If charIndex is before the first word or in non-whitespace before it
    return -1;
  }
  
  /**
   * Calculates the word distance between two character indices
   * @param index1 The first character index
   * @param index2 The second character index
   * @param content The text content
   * @returns The word distance or -1 if indices are not associated with words
   */
  public getWordDistance(index1: number, index2: number, content: string): number {
    const wordIndex1 = this.getWordIndexFromCharIndex(index1, content);
    const wordIndex2 = this.getWordIndexFromCharIndex(index2, content);
    
    if (wordIndex1 === -1 || wordIndex2 === -1) {
      return -1;
    }
    
    return Math.abs(wordIndex1 - wordIndex2);
  }
  
  /**
   * Clears the boundaries cache
   */
  public clearCache(): void {
    this.boundariesCache.clear();
  }
  
  /**
   * Removes a specific content from the cache
   * @param content The content to remove
   */
  public removeFromCache(content: string): void {
    const contentHash = this.hashString(content);
    this.boundariesCache.delete(contentHash);
  }
  
  /**
   * Gets statistics about the cache
   */
  public getCacheStats() {
    return this.boundariesCache.getStats();
  }
  
  /**
   * Calculates word boundaries for the given content
   * @param content The text content to analyze
   * @returns An array of WordBoundary objects
   */
  private calculateWordBoundaries(content: string): WordBoundary[] {
    const boundaries: WordBoundary[] = [];
    
    // Use a more efficient regex that matches words in a single pass
    // This regex matches sequences of word characters (alphanumeric + underscore)
    const wordRegex = /\b\w+\b/g;
    
    let match;
    while ((match = wordRegex.exec(content)) !== null) {
      boundaries.push({
        word: match[0],
        start: match.index,
        end: match.index + match[0].length - 1
      });
      
      // Prevent infinite loops with zero-width matches
      if (match.index === wordRegex.lastIndex) {
        wordRegex.lastIndex++;
      }
    }
    
    return boundaries;
  }
  
  /**
   * Simple string hashing function
   * @param str The string to hash
   * @returns A hash string
   */
  private hashString(str: string): string {
    // For very large strings, use a sample to generate the hash
    // This improves performance while still providing a good hash distribution
    const maxSampleLength = 1000;
    const sampleStr = str.length > maxSampleLength
      ? str.substring(0, maxSampleLength / 2) + str.substring(str.length - maxSampleLength / 2)
      : str;
    
    let hash = 0;
    for (let i = 0; i < sampleStr.length; i++) {
      const char = sampleStr.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(36);
  }
}
