import z from "zod";

const envSchema = z.object({
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
});

type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
