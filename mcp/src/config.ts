import { z } from "zod";

const envSchema = z.object({
  API_URL: z.string().url().default("http://localhost:3002"),
  PUBLIC_URL: z.string().url().default("https://dev.aedelore.nu"),
  PORT: z.coerce.number().int().positive().default(3100),
  KEYCLOAK_ISSUER: z.string().url(),
  KEYCLOAK_CLIENT_ID: z.string().min(1),
  KEYCLOAK_CLIENT_SECRET: z.string().min(1),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),
  ALLOWED_REDIRECT_HOSTS: z
    .string()
    .default("claude.ai,chatgpt.com,localhost")
    .transform((v) => v.split(",").map((h) => h.trim())),
});

export type Config = z.infer<typeof envSchema>;

function loadConfig(): Config {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}

export const config = loadConfig();
