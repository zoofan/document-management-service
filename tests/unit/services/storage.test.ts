import { describe, it, expect, beforeEach } from 'vitest';
import {
  createDocument,
  getDocument,
  listDocuments,
  updateDocument,
  deleteDocument,
  clearAllDocuments,
  getDocumentCount,
  findDocumentsByWord,
  findDocumentsByWords,
  getIndexStats,
} from '../../../src/services/storage';

describe('Storage Service', () => {
  beforeEach(() => {
    clearAllDocuments();
  });

  describe('createDocument', () => {
    it('should create a document with generated ID and metadata', () => {
      const doc = createDocument({
        title: 'Test Document',
        content: 'Hello world content',
        author: 'Test Author',
        tags: ['test', 'sample'],
      });

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe('Test Document');
      expect(doc.content).toBe('Hello world content');
      expect(doc.metadata.author).toBe('Test Author');
      expect(doc.metadata.tags).toEqual(['test', 'sample']);
      expect(doc.metadata.wordCount).toBe(3);
      expect(doc.metadata.characterCount).toBe(19); // "Hello world content" = 19 chars
      expect(doc.version).toBe(1);
      expect(doc.createdAt).toBeDefined();
      expect(doc.updatedAt).toBeDefined();
    });

    it('should index document for word search', () => {
      createDocument({
        title: 'Unique Title',
        content: 'Special content words',
      });

      const results = findDocumentsByWord('unique');
      expect(results.length).toBe(1);
    });
  });

  describe('getDocument', () => {
    it('should return document by ID', () => {
      const created = createDocument({
        title: 'Test',
        content: 'Content',
      });

      const retrieved = getDocument(created.id);
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent ID', () => {
      const result = getDocument('non-existent-id');
      expect(result).toBeUndefined();
    });
  });

  describe('listDocuments', () => {
    beforeEach(() => {
      createDocument({ title: 'Alpha', content: 'Content A' });
      createDocument({ title: 'Beta', content: 'Content B' });
      createDocument({ title: 'Gamma', content: 'Content C' });
    });

    it('should return paginated results', () => {
      const result = listDocuments({ page: 1, limit: 2 });

      expect(result.data.length).toBe(2);
      expect(result.pagination.total).toBe(3);
      expect(result.pagination.totalPages).toBe(2);
    });

    it('should sort by title ascending', () => {
      const result = listDocuments({ sortBy: 'title', sortOrder: 'asc' });

      expect(result.data[0].title).toBe('Alpha');
      expect(result.data[1].title).toBe('Beta');
      expect(result.data[2].title).toBe('Gamma');
    });

    it('should return empty array for page beyond total', () => {
      const result = listDocuments({ page: 10, limit: 10 });

      expect(result.data.length).toBe(0);
      expect(result.pagination.total).toBe(3);
    });
  });

  describe('updateDocument', () => {
    it('should update content and increment version', () => {
      const doc = createDocument({
        title: 'Original',
        content: 'Original content',
      });

      const updated = updateDocument(doc.id, { content: 'Updated content' });

      expect(updated?.content).toBe('Updated content');
      expect(updated?.version).toBe(2);
      expect(updated?.metadata.wordCount).toBe(2);
    });

    it('should update word index when content changes', () => {
      const doc = createDocument({
        title: 'Test',
        content: 'Original unique word',
      });

      expect(findDocumentsByWord('original').length).toBe(1);

      updateDocument(doc.id, { content: 'Changed different word' });

      expect(findDocumentsByWord('original').length).toBe(0);
      expect(findDocumentsByWord('changed').length).toBe(1);
    });

    it('should return undefined for non-existent document', () => {
      const result = updateDocument('non-existent', { content: 'New' });
      expect(result).toBeUndefined();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document and remove from index', () => {
      const doc = createDocument({
        title: 'To Delete',
        content: 'Deletable content',
      });

      expect(getDocumentCount()).toBe(1);
      expect(findDocumentsByWord('deletable').length).toBe(1);

      const deleted = deleteDocument(doc.id);

      expect(deleted).toBe(true);
      expect(getDocumentCount()).toBe(0);
      expect(findDocumentsByWord('deletable').length).toBe(0);
    });

    it('should return false for non-existent document', () => {
      const result = deleteDocument('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('findDocumentsByWords (posting list intersection)', () => {
    beforeEach(() => {
      // Create documents with specific word combinations
      createDocument({ title: 'Doc 1', content: 'hello world today' });
      createDocument({ title: 'Doc 2', content: 'hello universe tomorrow' });
      createDocument({ title: 'Doc 3', content: 'goodbye world yesterday' });
    });

    it('should return empty array for empty words', () => {
      const results = findDocumentsByWords([]);
      expect(results).toEqual([]);
    });

    it('should delegate to findDocumentsByWord for single word', () => {
      const results = findDocumentsByWords(['hello']);
      expect(results.length).toBe(2); // Doc 1 and Doc 2
    });

    it('should intersect posting lists for multiple words', () => {
      // Only Doc 1 contains both "hello" and "world"
      const results = findDocumentsByWords(['hello', 'world']);
      expect(results.length).toBe(1);
    });

    it('should return empty when no document contains all words', () => {
      // No document contains both "universe" and "world"
      const results = findDocumentsByWords(['universe', 'world']);
      expect(results).toEqual([]);
    });

    it('should return empty when any word has no matches', () => {
      // "nonexistent" is not in any document
      const results = findDocumentsByWords(['hello', 'nonexistent']);
      expect(results).toEqual([]);
    });

    it('should handle three or more words', () => {
      // Only Doc 1 contains "hello", "world", and "today"
      const results = findDocumentsByWords(['hello', 'world', 'today']);
      expect(results.length).toBe(1);
    });

    it('should optimize by starting with smallest posting list', () => {
      // Add a rare word document
      createDocument({ title: 'Rare', content: 'hello rare unique' });

      // "rare" only appears in 1 doc, "hello" in 3
      // Should efficiently start intersection with "rare"
      const results = findDocumentsByWords(['hello', 'rare']);
      expect(results.length).toBe(1);
    });
  });

  describe('getIndexStats', () => {
    it('should return zero stats for empty index', () => {
      const stats = getIndexStats();
      expect(stats.uniqueWords).toBe(0);
      expect(stats.totalPostings).toBe(0);
    });

    it('should count unique words and postings', () => {
      createDocument({ title: 'Doc 1', content: 'hello world' });
      createDocument({ title: 'Doc 2', content: 'hello universe' });

      const stats = getIndexStats();
      // Words: "doc", "1", "hello", "world", "2", "universe" = 6 unique
      expect(stats.uniqueWords).toBeGreaterThanOrEqual(4);
      // "hello" appears in 2 docs, others in 1 each
      expect(stats.totalPostings).toBeGreaterThanOrEqual(6);
    });
  });
});
