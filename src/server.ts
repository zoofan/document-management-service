import { buildApp } from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/docs`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
