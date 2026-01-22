import { FastifyInstance, FastifyError } from 'fastify';
import { createErrorResponse } from '../schemas/common';

export async function registerErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const statusCode = error.statusCode || 500;

    if (statusCode >= 500) {
      request.log.error(error);
    } else {
      request.log.warn(error);
    }

    if (error.validation) {
      const messages = error.validation.map((v) => {
        const field = v.instancePath || v.params?.missingProperty || 'field';
        return `${field}: ${v.message}`;
      });
      return reply.status(400).send(createErrorResponse(400, `Validation error: ${messages.join(', ')}`));
    }

    if (statusCode >= 400 && statusCode < 500) {
      return reply.status(statusCode).send(createErrorResponse(statusCode, error.message));
    }

    return reply.status(statusCode).send(
      createErrorResponse(statusCode, process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : error.message || 'Internal server error')
    );
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(createErrorResponse(404, `Route ${request.method} ${request.url} not found`));
  });
}
