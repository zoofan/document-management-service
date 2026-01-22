import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { clearAllDocuments } from '../../src/services/storage';

describe('Error Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    clearAllDocuments();
  });

  describe('404 Errors - Not Found', () => {
    it('should return { error, code } format for missing document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe(404);
      expect(body.error).toContain('not found');
    });

    it('should return 404 for undefined routes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/nonexistent',
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(404);
      expect(body.error).toContain('not found');
    });
  });

  describe('400 Errors - Validation', () => {
    it('should return { error, code } format for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
      expect(body.code).toBe(400);
      expect(body.error).toContain('Validation error');
    });

    it('should return 400 for invalid JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        headers: { 'content-type': 'application/json' },
        payload: 'not valid json{',
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(400);
    });

    it('should return 400 for empty title', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: '', content: 'test' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(400);
    });

    it('should return 400 for invalid search query', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/search',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(400);
    });

    it('should return 400 for empty changes array', async () => {
      // First create a document
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: { changes: [] },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(400);
    });
  });

  describe('Error Response Format', () => {
    it('should always return JSON for errors', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/invalid-uuid',
      });

      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include error message and code in all error responses', async () => {
      const testCases = [
        { method: 'GET' as const, url: '/api/documents/00000000-0000-0000-0000-000000000000' },
        { method: 'DELETE' as const, url: '/api/documents/00000000-0000-0000-0000-000000000000' },
        { method: 'POST' as const, url: '/api/documents/00000000-0000-0000-0000-000000000000/changes', payload: { changes: [{ searchText: 'a', replaceText: 'b' }] } },
      ];

      for (const testCase of testCases) {
        const response = await app.inject(testCase);
        const body = JSON.parse(response.payload);

        expect(body).toHaveProperty('error');
        expect(body).toHaveProperty('code');
        expect(typeof body.error).toBe('string');
        expect(typeof body.code).toBe('number');
      }
    });
  });
});
