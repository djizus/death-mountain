import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { z } from "zod";

let didLoadEnv = false;

function loadDotEnv(targetEnv: NodeJS.ProcessEnv): void {
  if (didLoadEnv) {
    return;
  }
  didLoadEnv = true;

  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const contents = readFileSync(envPath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2].trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (targetEnv[key] === undefined) {
      targetEnv[key] = value;
    }
  }
}

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  CORS_ORIGIN: z.string().optional(),
  SQLITE_PATH: z.string().default("./data/app.db"),

  STARKNET_RPC_URL: z.string().min(1),
  STARKNET_TREASURY_ADDRESS: z
    .string()
    .min(1)
    .default(
      "0x066bE88C48b0D71d1Bded275e211C2dDe1EF1c078Fd57ece1313f130Bbc5b859"
    ),
  STARKNET_TREASURY_PRIVATE_KEY: z.string().optional(),

  AVNU_API_URL: z.string().optional(),

  ORDER_QUOTE_TTL_SECONDS: z.coerce.number().int().positive().default(300),
  ORDER_FEE_BPS: z.coerce.number().int().min(0).max(10_000).default(300),

  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(2000),
  FULFILLMENT_WAIT_TIMEOUT_MS: z.coerce.number().int().min(10_000).default(180_000),

  // Ticket reserve settings
  TICKET_RESERVE_TARGET: z.coerce.number().int().min(1).default(50),
  TICKET_RESERVE_MINIMUM: z.coerce.number().int().min(0).default(5),
  // Max slippage for restock swaps (0.05 = 5%)
  RESTOCK_SLIPPAGE: z.coerce.number().min(0).max(1).default(0.05)
});

export type AppConfig = z.infer<typeof envSchema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  if (env === process.env) {
    loadDotEnv(env);
  }

  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten();
    throw new Error(`Invalid backend environment: ${JSON.stringify(formatted.fieldErrors)}`);
  }
  return parsed.data;
}
