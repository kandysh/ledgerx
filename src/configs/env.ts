import "dotenv/config";
import z from "zod";

const envSchema = z.object({
  API_KEY: z.string().default("your-api-key-here"),
  DATABASE_URL: z
    .url()
    .default(
      "postgresql://ledgerx_user:ledgerx_pass@localhost:5432/ledgerx_db",
    ),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z
    .string()
    .min(1)
    .max(65535)
    .default("3000")
    .transform((value) => parseInt(value)),
  HOST: z.string().default("localhost"),
  CORS_ORIGIN: z.string().default("*"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  REFERRAL_BONUS_AMOUNT: z
    .string()
    .default("100")
    .transform((v) => parseInt(v, 10)),
  REFERRAL_BONUS_ASSET_SYMBOL: z.string().default("GOLD"),
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
