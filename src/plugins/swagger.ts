import { FastifyInstance } from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

export async function registerSwagger(app: FastifyInstance): Promise<void> {
  await app.register(fastifySwagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Document Management API',
        description: 'API for managing documents',
        version: '1.0.0',
      },
      servers: [
        {
          url: 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Health', description: 'Health check endpoints' },
        { name: 'Documents', description: 'Document CRUD operations' },
        { name: 'Changes', description: 'Redlining and change requests' },
        { name: 'Search', description: 'Full-text search across documents' },
      ],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: false,
    },
    staticCSP: true,
  });
}
