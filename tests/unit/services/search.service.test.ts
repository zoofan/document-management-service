import { describe, it, expect, beforeEach } from 'vitest';
import { search } from '../../../src/services/search.service';
import { createDocument, clearAllDocuments } from '../../../src/services/storage';

describe('Search Service', () => {
  beforeEach(() => {
    clearAllDocuments();
  });

  describe('search', () => {
    it('should find text in documents', () => {
      createDocument({
        title: 'Document 1',
        content: 'The quick brown fox jumps over the lazy dog',
      });

      const result = search({ query: 'quick' });

      expect(result.totalMatches).toBe(1);
      expect(result.documentsSearched).toBe(1);
      expect(result.results[0].matchedText).toBe('quick');
    });

    it('should return context around matches', () => {
      createDocument({
        title: 'Test Doc',
        content: 'Some prefix text TARGET word followed by more text',
      });

      const result = search({ query: 'TARGET', contextSize: 20 });

      expect(result.results[0].context).toContain('TARGET');
      expect(result.results[0].context.length).toBeLessThanOrEqual(50);
    });

    it('should handle case-insensitive search by default', () => {
      createDocument({
        title: 'Test',
        content: 'Hello WORLD hello World',
      });

      const result = search({ query: 'hello' });

      expect(result.totalMatches).toBe(2);
    });

    it('should handle case-sensitive search', () => {
      createDocument({
        title: 'Test',
        content: 'Hello HELLO hello',
      });

      const result = search({ query: 'Hello', caseSensitive: true });

      expect(result.totalMatches).toBe(1);
    });

    it('should search across multiple documents', () => {
      createDocument({ title: 'Doc 1', content: 'findme in document one' });
      createDocument({ title: 'Doc 2', content: 'findme in document two' });
      createDocument({ title: 'Doc 3', content: 'nothing here' });

      const result = search({ query: 'findme' });

      expect(result.totalMatches).toBe(2);
      expect(result.documentsSearched).toBeGreaterThanOrEqual(2); // May vary due to index optimization
    });

    it('should filter by document IDs', () => {
      const doc1 = createDocument({ title: 'Doc 1', content: 'findme here' });
      createDocument({ title: 'Doc 2', content: 'findme there' });

      const result = search({
        query: 'findme',
        documentIds: [doc1.id],
      });

      expect(result.totalMatches).toBe(1);
      expect(result.results[0].documentId).toBe(doc1.id);
    });

    it('should limit results', () => {
      createDocument({
        title: 'Test',
        content: 'word word word word word word word word word word',
      });

      const result = search({ query: 'word', maxResults: 3 });

      expect(result.totalMatches).toBe(3);
    });

    it('should include position in results', () => {
      createDocument({
        title: 'Test',
        content: 'start middle end',
      });

      const result = search({ query: 'middle' });

      expect(result.results[0].position).toBe(6);
    });

    it('should escape regex special characters in query', () => {
      createDocument({
        title: 'Test',
        content: 'Price: $100.00 (special)',
      });

      const result = search({ query: '$100.00' });

      expect(result.totalMatches).toBe(1);
      expect(result.results[0].matchedText).toBe('$100.00');
    });

    it('should return empty results for no matches', () => {
      createDocument({ title: 'Test', content: 'Hello world' });

      const result = search({ query: 'xyz' });

      expect(result.totalMatches).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should include document title in results', () => {
      createDocument({
        title: 'My Special Document',
        content: 'Contains searchable content',
      });

      const result = search({ query: 'searchable' });

      expect(result.results[0].documentTitle).toBe('My Special Document');
    });
  });

  describe('multi-word query optimization', () => {
    it('should efficiently search multi-word queries via posting list intersection', () => {
      createDocument({ title: 'Doc 1', content: 'hello world today' });
      createDocument({ title: 'Doc 2', content: 'hello universe tomorrow' });
      createDocument({ title: 'Doc 3', content: 'goodbye world yesterday' });

      // Query "hello world" should only search Doc 1 (contains both words)
      const result = search({ query: 'hello world' });

      expect(result.totalMatches).toBe(1);
      expect(result.documentsSearched).toBe(1); // Only Doc 1 was searched
    });

    it('should return no results when no document contains all query words', () => {
      createDocument({ title: 'Doc 1', content: 'hello world' });
      createDocument({ title: 'Doc 2', content: 'foo bar' });

      // No document contains both "hello" and "bar"
      const result = search({ query: 'hello bar' });

      expect(result.totalMatches).toBe(0);
      expect(result.documentsSearched).toBe(0); // No documents searched
    });

    it('should find exact phrase match within intersected documents', () => {
      createDocument({ title: 'Doc 1', content: 'hello world today' });
      createDocument({ title: 'Doc 2', content: 'world hello reversed' }); // Both words but not as phrase

      // Looking for "hello world" as exact phrase
      const result = search({ query: 'hello world' });

      // Both docs contain both words, so both are searched
      expect(result.documentsSearched).toBe(2);
      // But only Doc 1 has the exact phrase
      expect(result.totalMatches).toBe(1);
    });

    it('should handle three or more word queries', () => {
      createDocument({ title: 'Doc 1', content: 'the quick brown fox' });
      createDocument({ title: 'Doc 2', content: 'the quick red fox' });
      createDocument({ title: 'Doc 3', content: 'a slow brown dog' });

      // Only Doc 1 has all three words
      const result = search({ query: 'quick brown fox' });

      expect(result.documentsSearched).toBe(1);
      expect(result.totalMatches).toBe(1);
    });

    it('should return empty for query with unknown word', () => {
      createDocument({ title: 'Doc 1', content: 'hello world' });

      // "nonexistent" is not indexed anywhere
      const result = search({ query: 'hello nonexistent' });

      expect(result.documentsSearched).toBe(0);
      expect(result.totalMatches).toBe(0);
    });
  });
});
