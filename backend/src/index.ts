import cors from "cors";
import express from "express";
import { loadConfig } from "./config.js";
import { initDb, openDb } from "./db.js";
import { loadDotenv } from "./dotenv.js";
import { buildOrdersRouter } from "./routes/orders.js";
import { buildTokensRouter } from "./routes/tokens.js";
import { buildTreasuryRouter } from "./routes/treasury.js";
import { requireNormalizedAddress } from "./starknet/address.js";
import { startWorker } from "./worker.js";

loadDotenv();
const config = loadConfig();

// Validate treasury address early.
requireNormalizedAddress(config.STARKNET_TREASURY_ADDRESS, "treasury");

const db = openDb(config.SQLITE_PATH);
initDb(db);

const app = express();
app.use(express.json({ limit: "1mb" }));

// Parse CORS_ORIGIN: supports comma-separated list or wildcard
const corsOrigin = config.CORS_ORIGIN
  ? config.CORS_ORIGIN.includes(",")
    ? config.CORS_ORIGIN.split(",").map((o) => o.trim())
    : config.CORS_ORIGIN
  : true;

app.use(
  cors({
    origin: corsOrigin
  })
);

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const api = express.Router();
api.use(buildTokensRouter());
api.use(buildTreasuryRouter({ config }));
api.use(buildOrdersRouter({ db, config }));

app.use("/api/v1", api);

startWorker({ db, config });

app.listen(config.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`backend listening on :${config.PORT}`);
});
