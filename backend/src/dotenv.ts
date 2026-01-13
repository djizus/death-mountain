import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const serviceRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

export function loadDotenv(): void {
  const candidates = [resolve(serviceRoot, ".env"), resolve(serviceRoot, ".env.local")];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      loadEnv({ path: candidate, override: false });
    }
  }
}
