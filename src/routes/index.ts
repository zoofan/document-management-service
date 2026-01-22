import { FastifyInstance } from 'fastify';
import { healthRoutes } from './health';
import { documentRoutes } from './documents';
import { changesRoutes } from './changes';
import { searchRoutes } from './search';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes);
  await app.register(documentRoutes);
  await app.register(changesRoutes);
  await app.register(searchRoutes);
}
