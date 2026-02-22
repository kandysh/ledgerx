import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifySensible from '@fastify/sensible';
import { drizzlePluginWithResolver } from './db/index.js';
import { healthRoutes } from './routes/health.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

const fastify = Fastify({
  logger: true,
});

// Register plugins
await fastify.register(fastifyHelmet);
await fastify.register(fastifyCors, {
  origin: process.env.CORS_ORIGIN || true,
  credentials: true,
});
await fastify.register(fastifySensible);
await fastify.register(drizzlePluginWithResolver);

// Register routes
await fastify.register(healthRoutes, { prefix: '/api' });

// Graceful shutdown handlers
process.on('SIGTERM', async () => {
  fastify.log.info('SIGTERM received, gracefully shutting down');
  await fastify.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  fastify.log.info('SIGINT received, gracefully shutting down');
  await fastify.close();
  process.exit(0);
});

// Start server
try {
  await fastify.listen({ port: PORT, host: HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
