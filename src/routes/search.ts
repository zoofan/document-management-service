import { FastifyInstance } from 'fastify';
import { search } from '../services/search.service';
import { searchQueryBodySchema, searchResponseSchema } from '../schemas/search.schemas';
import { SearchQuery } from '../types/document';

export async function searchRoutes(app: FastifyInstance): Promise<void> {
  app.post<{
    Body: SearchQuery;
  }>('/api/search', {
    schema: {
      description: 'Search for text across documents with context snippets',
      tags: ['Search'],
      body: searchQueryBodySchema,
      response: {
        200: searchResponseSchema,
      },
    },
  }, async (request, _reply) => {
    return search(request.body);
  });
}
