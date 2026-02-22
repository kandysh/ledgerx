import type { FastifyInstance } from "fastify";
import { IdempotentReplayError } from "../../lib/errors.js";
import {
  BonusRequestSchema,
  SpendRequestSchema,
  TopupRequestSchema,
} from "./wallet.schema.js";
import * as walletService from "./wallet.service.js";
import { env } from "../../configs/env.js";

export async function walletRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", async (req, reply) => {
    const key = req.headers["x-api-key"];
    if (!key) {
      reply.status(401).send({ success: false, error: "Missing API key" });
      return;
    }
    if (key !== env.API_KEY) {
      reply.status(403).send({ success: false, error: "Forbidden" });
      return;
    }
  });

  fastify.post<{ Params: { userId: string } }>(
    "/:userId/topup",
    async (req, reply) => {
      const body = TopupRequestSchema.parse(req.body);
      try {
        const tx = await walletService.topup(fastify.db, {
          userId: req.params.userId,
          ...body,
        });
        return reply.status(201).send({ success: true, data: tx });
      } catch (e) {
        if (e instanceof IdempotentReplayError) {
          return reply.send({ success: true, data: e.existingTransaction });
        }
        throw e;
      }
    },
  );

  fastify.post<{ Params: { userId: string } }>(
    "/:userId/bonus",
    async (req, reply) => {
      const body = BonusRequestSchema.parse(req.body);
      try {
        const tx = await walletService.bonus(fastify.db, {
          userId: req.params.userId,
          ...body,
        });
        return reply.status(201).send({ success: true, data: tx });
      } catch (e) {
        if (e instanceof IdempotentReplayError) {
          return reply.send({ success: true, data: e.existingTransaction });
        }
        throw e;
      }
    },
  );

  fastify.post<{ Params: { userId: string } }>(
    "/:userId/spend",
    async (req, reply) => {
      const body = SpendRequestSchema.parse(req.body);
      try {
        const tx = await walletService.spend(fastify.db, {
          userId: req.params.userId,
          ...body,
        });
        return reply.status(201).send({ success: true, data: tx });
      } catch (e) {
        if (e instanceof IdempotentReplayError) {
          return reply.send({ success: true, data: e.existingTransaction });
        }
        throw e;
      }
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    "/:userId/balance",
    async (req, reply) => {
      const balances = await walletService.getBalance(
        fastify.db,
        req.params.userId,
      );
      return reply.send({ success: true, data: balances });
    },
  );

  fastify.get<{ Params: { userId: string } }>(
    "/:userId/history",
    async (req, reply) => {
      const history = await walletService.getHistory(
        fastify.db,
        req.params.userId,
      );
      return reply.send({ success: true, data: history });
    },
  );
}
