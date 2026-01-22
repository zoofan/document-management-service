import { FastifyInstance } from 'fastify';
import {
  createDocument,
  getDocument,
  listDocuments,
  deleteDocument,
  patchDocument,
} from '../services/storage';
import {
  documentSchema,
  createDocumentBodySchema,
  listDocumentsQuerySchema,
  paginatedDocumentsResponseSchema,
  documentIdParamsSchema,
  deleteDocumentResponseSchema,
  patchDocumentBodySchema,
  patchDocumentHeadersSchema,
} from '../schemas/document.schemas';
import { errorResponseSchema, createErrorResponse } from '../schemas/common';
import { preconditionFailedSchema } from '../schemas/change.schemas';
import { CreateDocumentInput, ListDocumentsQuery, PatchDocumentInput } from '../types/document';
import { generateETag, validateIfMatch } from '../utils/etag';

export async function documentRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: CreateDocumentInput;
  }>('/api/documents', {
    schema: {
      description: 'Create a new document. Returns ETag header for concurrency control.',
      tags: ['Documents'],
      body: createDocumentBodySchema,
      response: {
        201: documentSchema,
      },
    },
  }, async (request, reply) => {
    const doc = createDocument(request.body);
    const etag = generateETag(doc);
    return reply
      .status(201)
      .header('ETag', etag)
      .send(doc);
  });

  app.get<{
    Querystring: ListDocumentsQuery;
  }>('/api/documents', {
    schema: {
      description: 'List all documents with pagination',
      tags: ['Documents'],
      querystring: listDocumentsQuerySchema,
      response: {
        200: paginatedDocumentsResponseSchema,
      },
    },
  }, async (request, _reply) => {
    return listDocuments(request.query);
  });

  app.get<{
    Params: { id: string };
  }>('/api/documents/:id', {
    schema: {
      description: 'Get a document by ID. Returns ETag header for concurrency control.',
      tags: ['Documents'],
      params: documentIdParamsSchema,
      response: {
        200: documentSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const doc = getDocument(request.params.id);
    if (!doc) {
      return reply.status(404).send(createErrorResponse(404, `Document with ID ${request.params.id} not found`));
    }
    const etag = generateETag(doc);
    return reply
      .header('ETag', etag)
      .send(doc);
  });

  app.patch<{
    Params: { id: string };
    Body: PatchDocumentInput;
    Headers: { 'if-match'?: string };
  }>('/api/documents/:id', {
    schema: {
      description: `Partially update a document's title or metadata.

**Note**: This endpoint is for updating title, author, and tags only.
For content changes (find/replace), use \`POST /api/documents/:id/changes\`.

## Concurrency Control
Use the \`If-Match\` header with an ETag value to prevent conflicting updates.
If the document has been modified since you last fetched it, returns 412 Precondition Failed.`,
      tags: ['Documents'],
      params: documentIdParamsSchema,
      headers: patchDocumentHeadersSchema,
      body: patchDocumentBodySchema,
      response: {
        200: documentSchema,
        404: errorResponseSchema,
        412: preconditionFailedSchema,
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    const ifMatch = request.headers['if-match'];

    const doc = getDocument(id);
    if (!doc) {
      return reply.status(404).send(createErrorResponse(404, `Document with ID ${id} not found`));
    }

    if (!validateIfMatch(ifMatch, doc)) {
      const currentEtag = generateETag(doc);
      return reply.status(412).send({
        error: 'Precondition Failed: Document has been modified. Fetch the latest version and retry.',
        code: 412,
        currentEtag,
      });
    }

    const updatedDoc = patchDocument(id, request.body);
    const newEtag = generateETag(updatedDoc!);

    return reply
      .header('ETag', newEtag)
      .send(updatedDoc);
  });

  app.delete<{
    Params: { id: string };
  }>('/api/documents/:id', {
    schema: {
      description: 'Delete a document by ID',
      tags: ['Documents'],
      params: documentIdParamsSchema,
      response: {
        200: deleteDocumentResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const deleted = deleteDocument(request.params.id);
    if (!deleted) {
      return reply.status(404).send(createErrorResponse(404, `Document with ID ${request.params.id} not found`));
    }
    return {
      success: true,
      message: `Document ${request.params.id} deleted successfully`,
    };
  });
}
