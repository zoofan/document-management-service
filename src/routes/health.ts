import { FastifyInstance } from 'fastify';
import { healthResponseSchema } from '../schemas/common';

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', {
    schema: {
      description: 'Health check endpoint',
      tags: ['Health'],
      response: {
        200: healthResponseSchema,
      },
    },
  }, async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
}
