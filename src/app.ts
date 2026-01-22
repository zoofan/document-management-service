import Fastify, { FastifyInstance } from 'fastify';
import { registerSwagger } from './plugins/swagger';
import { registerErrorHandler } from './plugins/error-handler';
import { registerRoutes } from './routes';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: true,
  });

  await registerErrorHandler(app);

  await registerSwagger(app);

  await registerRoutes(app);

  return app;
}
