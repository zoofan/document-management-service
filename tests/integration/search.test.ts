import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../../src/routes';
import { clearAllDocuments } from '../../src/services/storage';

describe('Search API Integration', () => {
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

  describe('POST /api/search', () => {
    beforeEach(async () => {
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Shakespeare Sonnet',
          content: 'Shall I compare thee to a summers day? Thou art more lovely and more temperate.',
        },
      });
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Technical Document',
          content: 'The API endpoint accepts JSON payloads and returns structured responses.',
        },
      });
    });

    it('should search across all documents', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'the' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.totalMatches).toBeGreaterThan(0);
      expect(body.documentsSearched).toBeGreaterThanOrEqual(1); // May vary due to index optimization
    });

    it('should return context around matches', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'JSON', contextSize: 30 },
      });

      const body = JSON.parse(response.payload);
      expect(body.results[0].context).toContain('JSON');
      expect(body.results[0].matchedText).toBe('JSON');
    });

    it('should handle case-sensitive search', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'shall', caseSensitive: true },
      });

      const body = JSON.parse(response.payload);
      expect(body.totalMatches).toBe(0); // "Shall" with capital S
    });

    it('should filter by document IDs', async () => {
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/documents',
      });
      const { data } = JSON.parse(listResponse.payload);
      const technicalDocId = data.find((d: any) => d.title === 'Technical Document').id;

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {
          query: 'the',
          documentIds: [technicalDocId],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.results.every((r: any) => r.documentId === technicalDocId)).toBe(true);
    });

    it('should limit results', async () => {
      // Create a document with many matches
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Repetitive',
          content: 'word word word word word word word word word word',
        },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'word', maxResults: 3 },
      });

      const body = JSON.parse(response.payload);
      expect(body.totalMatches).toBe(3);
    });

    it('should include position in results', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'JSON' },
      });

      const body = JSON.parse(response.payload);
      expect(typeof body.results[0].position).toBe('number');
    });

    it('should return empty results for no matches', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: 'xyznonexistent' },
      });

      const body = JSON.parse(response.payload);
      expect(body.totalMatches).toBe(0);
      expect(body.results).toEqual([]);
    });

    it('should handle special regex characters in query', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Price Doc', content: 'The price is $100.00 (USD)' },
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: { query: '$100.00' },
      });

      const body = JSON.parse(response.payload);
      expect(body.totalMatches).toBe(1);
    });
  });
});
