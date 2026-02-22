import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { healthRoutes } from './health.js';

describe('Health Routes', () => {
  let fastify: FastifyInstance;

  beforeAll(async () => {
    fastify = Fastify();
    // Mock db object for testing
    fastify.decorate('db', {
      execute: vi.fn(async () => undefined),
    } as any);
    await fastify.register(healthRoutes);
  });

  afterAll(async () => {
    await fastify.close();
  });

  it('should return ok status on GET /health when db is healthy', async () => {
    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
    expect(body.db.status).toBe('ok');
    expect(body.db.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should return degraded status when db is unreachable', async () => {
    const mockDb = fastify.db as any;
    mockDb.execute = vi.fn(async () => {
      throw new Error('Connection refused');
    });

    const response = await fastify.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('degraded');
    expect(body.db.status).toBe('degraded');
  });
});
