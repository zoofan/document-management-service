import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { buildApp } from '../../src/app';
import { FastifyInstance } from 'fastify';
import { clearAllDocuments } from '../../src/services/storage';

describe('Concurrency Control (ETag)', () => {
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

  describe('ETag generation', () => {
    it('should return ETag header when creating a document', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Hello world' },
      });

      expect(response.statusCode).toBe(201);
      expect(response.headers['etag']).toBeDefined();
      expect(response.headers['etag']).toMatch(/^"v1-[a-f0-9]{8}"$/);
    });

    it('should return ETag header when getting a document', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Hello world' },
      });
      const doc = JSON.parse(createResponse.payload);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${doc.id}`,
      });

      expect(getResponse.headers['etag']).toBeDefined();
      expect(getResponse.headers['etag']).toBe(createResponse.headers['etag']);
    });

    it('should update ETag when document is modified', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar foo' },
      });
      const doc = JSON.parse(createResponse.payload);
      const originalEtag = createResponse.headers['etag'];

      const changeResponse = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      const newEtag = changeResponse.headers['etag'];
      expect(newEtag).toBeDefined();
      expect(newEtag).not.toBe(originalEtag);
      expect(newEtag).toMatch(/^"v2-[a-f0-9]{8}"$/);
    });
  });

  describe('If-Match validation', () => {
    it('should allow changes with correct If-Match header', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar' },
      });
      const doc = JSON.parse(createResponse.payload);
      const etag = createResponse.headers['etag'];

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        headers: { 'if-match': etag },
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should return 412 Precondition Failed with wrong If-Match header', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        headers: { 'if-match': '"v99-invalid1"' },
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      expect(response.statusCode).toBe(412);
      const body = JSON.parse(response.payload);
      expect(body.code).toBe(412);
      expect(body.error).toContain('Precondition Failed');
      expect(body.currentEtag).toBeDefined();
    });

    it('should allow changes without If-Match header', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should allow changes with wildcard If-Match header', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        headers: { 'if-match': '*' },
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should detect concurrent modification', async () => {
      // Create document
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'original content' },
      });
      const doc = JSON.parse(createResponse.payload);
      const originalEtag = createResponse.headers['etag'];

      // First user modifies document
      await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [{ searchText: 'original', replaceText: 'modified' }],
        },
      });

      // Second user tries to modify using old ETag
      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        headers: { 'if-match': originalEtag },
        payload: {
          changes: [{ searchText: 'content', replaceText: 'text' }],
        },
      });

      expect(response.statusCode).toBe(412);
    });
  });

  describe('ETag in response body', () => {
    it('should include etag in change response body', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'foo bar' },
      });
      const doc = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'POST',
        url: `/api/documents/${doc.id}/changes`,
        payload: {
          changes: [{ searchText: 'foo', replaceText: 'baz' }],
        },
      });

      const body = JSON.parse(response.payload);
      expect(body.etag).toBeDefined();
      expect(body.etag).toBe(response.headers['etag']);
    });
  });
});
