import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { drizzlePluginWithResolver } from "./db/index.js";
import { healthRoutes } from "./routes/health.js";
import { env } from "./lib/configs/env.js";
import { envLogger } from "./lib/utils/env-logger.js";

const fastify = Fastify({
  logger: envLogger[env.NODE_ENV],
});

await fastify.register(fastifyHelmet);
await fastify.register(fastifyCors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});
await fastify.register(fastifySensible);
await fastify.register(drizzlePluginWithResolver);

await fastify.register(healthRoutes, { prefix: "/health" });

process.on("SIGTERM", async () => {
  fastify.log.info("SIGTERM received, gracefully shutting down");
  await fastify.close();
  process.exit(0);
});

process.on("SIGINT", async () => {
  fastify.log.info("SIGINT received, gracefully shutting down");
  await fastify.close();
  process.exit(0);
});

try {
  await fastify.listen({ port: env.PORT, host: env.HOST });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
