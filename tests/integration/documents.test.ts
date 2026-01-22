import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerRoutes } from '../../src/routes';
import { clearAllDocuments } from '../../src/services/storage';

describe('Documents API Integration', () => {
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

  describe('POST /api/documents', () => {
    it('should create a document', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {
          title: 'Test Document',
          content: 'This is test content',
          author: 'Test Author',
          tags: ['test'],
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.payload);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('Test Document');
      expect(body.content).toBe('This is test content');
      expect(body.metadata.author).toBe('Test Author');
      expect(body.metadata.wordCount).toBe(4);
      expect(body.version).toBe(1);
    });

    it('should require title and content', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/documents', () => {
    beforeEach(async () => {
      for (let i = 1; i <= 5; i++) {
        await app.inject({
          method: 'POST',
          url: '/api/documents',
          payload: { title: `Doc ${i}`, content: `Content ${i}` },
        });
      }
    });

    it('should list documents with pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?page=1&limit=2',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data.length).toBe(2);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.totalPages).toBe(3);
    });

    it('should sort by title', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents?sortBy=title&sortOrder=asc',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.data[0].title).toBe('Doc 1');
    });
  });

  describe('GET /api/documents/:id', () => {
    it('should get document by ID', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);

      const response = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}`,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.payload);
      expect(body.id).toBe(created.id);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('PATCH /api/documents/:id', () => {
    it('should update document title', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Original Title', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        payload: { title: 'Updated Title' },
      });

      expect(patchResponse.statusCode).toBe(200);
      const body = JSON.parse(patchResponse.payload);
      expect(body.title).toBe('Updated Title');
      expect(body.content).toBe('Content'); // Content unchanged
      expect(body.version).toBe(2);
    });

    it('should update document metadata (author, tags)', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        payload: { author: 'New Author', tags: ['tag1', 'tag2'] },
      });

      expect(patchResponse.statusCode).toBe(200);
      const body = JSON.parse(patchResponse.payload);
      expect(body.metadata.author).toBe('New Author');
      expect(body.metadata.tags).toEqual(['tag1', 'tag2']);
    });

    it('should return ETag header after PATCH', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);
      const originalEtag = createResponse.headers['etag'];

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        payload: { title: 'New Title' },
      });

      expect(patchResponse.headers['etag']).toBeDefined();
      expect(patchResponse.headers['etag']).not.toBe(originalEtag);
    });

    it('should validate If-Match header for concurrency control', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);
      const etag = createResponse.headers['etag'];

      // Update with correct ETag should succeed
      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        headers: { 'if-match': etag },
        payload: { title: 'New Title' },
      });

      expect(patchResponse.statusCode).toBe(200);
    });

    it('should return 412 for stale If-Match header', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);

      // Use an incorrect ETag
      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        headers: { 'if-match': '"v99-invalid1"' },
        payload: { title: 'New Title' },
      });

      expect(patchResponse.statusCode).toBe(412);
      const body = JSON.parse(patchResponse.payload);
      expect(body.code).toBe(412);
      expect(body.currentEtag).toBeDefined();
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'PATCH',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
        payload: { title: 'New Title' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('should require at least one field to update', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Content' },
      });
      const created = JSON.parse(createResponse.payload);

      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        payload: {},
      });

      expect(patchResponse.statusCode).toBe(400);
    });

    it('should not update content via PATCH (use changes endpoint instead)', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'Test', content: 'Original content' },
      });
      const created = JSON.parse(createResponse.payload);

      // Attempt to update content via PATCH - it's ignored (additionalProperties: false)
      const patchResponse = await app.inject({
        method: 'PATCH',
        url: `/api/documents/${created.id}`,
        payload: { title: 'New Title', content: 'New content' },
      });

      expect(patchResponse.statusCode).toBe(200);
      const body = JSON.parse(patchResponse.payload);
      // Title is updated, but content should remain unchanged
      expect(body.title).toBe('New Title');
      expect(body.content).toBe('Original content'); // Content NOT updated
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('should delete document', async () => {
      const createResponse = await app.inject({
        method: 'POST',
        url: '/api/documents',
        payload: { title: 'To Delete', content: 'Delete me' },
      });
      const created = JSON.parse(createResponse.payload);

      const deleteResponse = await app.inject({
        method: 'DELETE',
        url: `/api/documents/${created.id}`,
      });

      expect(deleteResponse.statusCode).toBe(200);

      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/documents/${created.id}`,
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent document', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/api/documents/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
