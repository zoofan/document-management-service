import { FastifyInstance, FastifyError } from 'fastify';
import { createErrorResponse } from '../schemas/common';

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  // Global error handler
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;

    // Log server errors
    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }

    // Handle validation errors (400)
    if (error.validation) {
      const messages = error.validation.map((v) => {
        const field = v.instancePath || v.params?.missingProperty || 'field';
        return `${field}: ${v.message}`;
      });
      return reply.status(400).send(createErrorResponse(400, `Validation error: ${messages.join(', ')}`));
    }

    // Handle known HTTP errors (4xx)
    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send(createErrorResponse(statusCode, error.message));
    }

    // Handle server errors (5xx) - don't expose internal details
    return reply.status(statusCode).send(
      createErrorResponse(statusCode, process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message || 'Internal server error')
    );
  });

  // Handle 404 for undefined routes
  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(createErrorResponse(404, `Route ${request.method} ${request.url} not found`));
  });
}
