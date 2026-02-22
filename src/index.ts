import Fastify from "fastify";
import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import { ZodError } from "zod";
import { drizzlePluginWithResolver } from "./db/index";
import { healthRoutes } from "./modules/health.routes";
import { paymentRoutes } from "./modules/payment.routes";
import { walletRoutes } from "./modules/wallet/wallet.routes";
import { env } from "./configs/env";
import { envLogger } from "./configs/logger-config";
import {
  AccountNotFoundError,
  InsufficientFundsError,
  ValidationError,
} from "./lib/errors";

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
await fastify.register(walletRoutes, { prefix: "/wallets" });
await fastify.register(paymentRoutes, { prefix: "/payments" });

fastify.setErrorHandler((error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: "Validation error",
      details: error.issues,
    });
  }
  if (
    error instanceof InsufficientFundsError ||
    error instanceof AccountNotFoundError ||
    error instanceof ValidationError
  ) {
    return reply.status(error.statusCode).send({
      success: false,
      error: error.message,
    });
  }
  fastify.log.error(error);
  return reply.status(500).send({ success: false, error: "Internal server error" });
});

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
