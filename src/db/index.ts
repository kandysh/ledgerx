import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import * as schema from './schema.js';

type Database = ReturnType<typeof drizzle<typeof schema>>;

let dbClient: postgres.Sql;
let db: Database;

async function drizzlePlugin(fastify: FastifyInstance) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  dbClient = postgres(databaseUrl);
  db = drizzle(dbClient, { schema });

  // Register graceful shutdown
  fastify.addHook('onClose', async () => {
    await dbClient.end({ timeout: 5 });
  });
}

declare module 'fastify' {
  interface FastifyInstance {
    db: Database;
  }
}

export const drizzlePluginWithResolver = fp(drizzlePlugin, {
  name: 'drizzle',
});

export { db, dbClient };
