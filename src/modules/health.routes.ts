import { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    let dbStatus = "ok";
    let dbLatencyMs = 0;

    try {
      const start = performance.now();
      await fastify.db.execute(sql`SELECT 1`);
      dbLatencyMs = Math.round(performance.now() - start);
    } catch (error) {
      dbStatus = "degraded";
      reply.statusCode = 503;
    }

    return {
      status: dbStatus === "ok" ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      db: {
        status: dbStatus,
        latencyMs: dbLatencyMs,
      },
    };
  });
}
