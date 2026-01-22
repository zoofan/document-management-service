import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../../src/routes';
import { clearAllDocuments } from '../../src/services/storage';

describe('Changes API Integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    await registerRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clearAllDocuments();
  });

  describe('POST /api/documents/:id/changes', () => {
    it('should apply find/replace changes', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Test Document',
          content: 'The quick brown fox jumps over the lazy dog',
        },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [
            { searchText: 'quick', replaceText: 'slow' },
            { searchText: 'brown', replaceText: 'red' },
          ],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.document.content).toBe('The slow red fox jumps over the lazy dog');
      expect(body.totalReplacements).toBe(2);
      expect(body.previousVersion).toBe(1);
      expect(body.newVersion).toBe(2);
    });

    it('should increment version only when changes are made', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Hello world' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [{ searchText: 'xyz', replaceText: 'abc' }],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.totalReplacements).toBe(0);
      expect(body.newVersion).toBe(1); // No change, same version
    });

    it('should handle case-insensitive replacement', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Hello HELLO hello' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [
            { searchText: 'hello', replaceText: 'hi', matchCase: false },
          ],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.document.content).toBe('hi hi hi');
      expect(body.results[0].replacementsMade).toBe(3);
    });

    it('should handle whole word matching', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foobar foo barfoo' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [
            { searchText: 'foo', replaceText: 'qux', matchWholeWord: true },
          ],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.document.content).toBe('foobar qux barfoo');
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents/00000000-0000-0000-0000-000000000000/changes',
        payload: {
          changes: [{ searchText: 'x', replaceText: 'y' }],
        },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should return detailed results for each change', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'a b a b a' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [
            { searchText: 'a', replaceText: 'x' },
            { searchText: 'b', replaceText: 'y' },
          ],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.results[0].matchesFound).toBe(3);
      expect(body.results[0].replacementsMade).toBe(3);
      expect(body.results[1].matchesFound).toBe(2);
      expect(body.results[1].replacementsMade).toBe(2);
    });
  });
});
