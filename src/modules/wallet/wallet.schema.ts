import { z } from "zod";

export const TopupRequestSchema = z.object({
  assetTypeId: z.uuid(),
  amount: z.number().positive(),
  idempotencyKey: z.uuid(),
  paymentRef: z.string().optional(),
});

export const BonusRequestSchema = z.object({
  assetTypeId: z.uuid(),
  amount: z.number().positive(),
  idempotencyKey: z.uuid(),
});

export const SpendRequestSchema = z.object({
  assetTypeId: z.uuid(),
  amount: z.number().positive(),
  idempotencyKey: z.uuid(),
});

export type TopupRequest = z.infer<typeof TopupRequestSchema>;
export type BonusRequest = z.infer<typeof BonusRequestSchema>;
export type SpendRequest = z.infer<typeof SpendRequestSchema>;
