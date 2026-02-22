import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import fp from "fastify-plugin";
import { FastifyInstance } from "fastify";
import * as schema from "./schema";
import { env } from "../configs/env";

export type Database = ReturnType<typeof drizzle<typeof schema>>;

async function drizzlePlugin(fastify: FastifyInstance) {
  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 5_000,
  });

  const db = drizzle(pool, {
    schema,
    logger: {
      logQuery(query: string, params: unknown[]) {
        fastify.log.debug({ query, params }, "db query");
      },
    },
  });

  fastify.decorate("db", db);

  fastify.addHook("onClose", async () => {
    await pool.end();
  });
}

declare module "fastify" {
  interface FastifyInstance {
    db: Database;
  }
}

export const drizzlePluginWithResolver = fp(drizzlePlugin, {
  name: "drizzle",
});
