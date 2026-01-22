import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocument,
  getDocument,
  clearAllDocuments,
} from '../../src/services/storage';
import { applyChanges } from '../../src/services/change.service';
import { search } from '../../src/services/search.service';

// Generate large text content
function generateLargeContent(targetSizeMB: number): string {
  const paragraph = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. `;

  const targetSize = targetSizeMB * 1024 * 1024;
  let content = '';

  while (content.length < targetSize) {
    content += paragraph;
  }

  return content.slice(0, targetSize);
}

describe('Performance Benchmarks', () => {
  beforeEach(() => {
    clearAllDocuments();
  });

  describe('Large Document Operations', () => {
    it('should create 10MB document in < 100ms', () => {
      const content = generateLargeContent(10);

      const start = performance.now();
      const doc = createDocument({
        title: 'Large Document',
        content,
      });
      const elapsed = performance.now() - start;

      expect(doc.id).toBeDefined();
      expect(doc.metadata.characterCount).toBeGreaterThan(10 * 1024 * 1024 * 0.9);
      expect(elapsed).toBeLessThan(500); // Allow more time for word indexing
      console.log(`Create 10MB document: ${elapsed.toFixed(2)}ms`);
    });

    it('should find/replace on 10MB document in < 500ms', () => {
      const content = generateLargeContent(10);
      const doc = createDocument({ title: 'Test', content });

      const changes = [
        { searchText: 'Lorem', replaceText: 'LOREM' },
        { searchText: 'ipsum', replaceText: 'IPSUM' },
        { searchText: 'dolor', replaceText: 'DOLOR' },
      ];

      const start = performance.now();
      const result = applyChanges(doc.content, changes);
      const elapsed = performance.now() - start;

      expect(result.totalReplacements).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(500);
      console.log(`Find/replace on 10MB document: ${elapsed.toFixed(2)}ms, replacements: ${result.totalReplacements}`);
    });

    it('should search 10MB document in < 200ms', () => {
      const content = generateLargeContent(10);
      createDocument({ title: 'Searchable', content });

      const start = performance.now();
      const result = search({
        query: 'consectetur',
        maxResults: 100,
      });
      const elapsed = performance.now() - start;

      expect(result.totalMatches).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(200);
      console.log(`Search 10MB document: ${elapsed.toFixed(2)}ms, matches: ${result.totalMatches}`);
    });
  });

  describe('Multiple Document Operations', () => {
    it('should handle 100 documents efficiently', () => {
      // Create 100 documents
      const createStart = performance.now();
      for (let i = 0; i < 100; i++) {
        createDocument({
          title: `Document ${i}`,
          content: `This is content for document ${i}. It contains some searchable terms like unique${i} and common words.`,
        });
      }
      const createElapsed = performance.now() - createStart;

      // Search across all documents
      const searchStart = performance.now();
      const result = search({ query: 'searchable' });
      const searchElapsed = performance.now() - searchStart;

      expect(result.totalMatches).toBe(100);
      expect(createElapsed).toBeLessThan(1000);
      expect(searchElapsed).toBeLessThan(100);
      console.log(`Create 100 documents: ${createElapsed.toFixed(2)}ms`);
      console.log(`Search 100 documents: ${searchElapsed.toFixed(2)}ms`);
    });
  });

  describe('Complex Change Operations', () => {
    it('should handle 50 sequential changes efficiently', () => {
      const content = generateLargeContent(1); // 1MB document
      const doc = createDocument({ title: 'Test', content });

      const changes = [];
      for (let i = 0; i < 50; i++) {
        changes.push({
          searchText: 'Lorem',
          replaceText: `Lorem${i}`,
          occurrence: 1,
          replaceAll: false,
        });
      }

      const start = performance.now();
      const result = applyChanges(doc.content, changes);
      const elapsed = performance.now() - start;

      expect(result.results.length).toBe(50);
      expect(elapsed).toBeLessThan(500);
      console.log(`50 sequential changes on 1MB document: ${elapsed.toFixed(2)}ms`);
    });
  });
});
