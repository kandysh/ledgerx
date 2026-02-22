import type { FastifyInstance } from "fastify";

export async function mockPayment(_params: {
  userId: string;
  amount: number;
  currency: string;
}) {
  await new Promise<void>((r) => setTimeout(r, 50));
  return { success: true, paymentId: `pay_${crypto.randomUUID()}` };
}

export async function paymentRoutes(fastify: FastifyInstance) {
  fastify.all("/", async (req, reply) => {
    const result = await mockPayment(
      req.body as { userId: string; amount: number; currency: string },
    );
    return reply.send({ success: true, data: result });
  });
}
