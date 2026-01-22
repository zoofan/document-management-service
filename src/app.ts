import Fastify, { FastifyInstance } from 'fastify';
import { registerSwagger } from './plugins/swagger';
import { registerErrorHandler } from './plugins/error-handler';
import { registerRoutes } from './routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  // Register error handler first
  await registerErrorHandler(app);

  // Register plugins
  await registerSwagger(app);

  // Register routes
  await registerRoutes(app);

  return app;
}
