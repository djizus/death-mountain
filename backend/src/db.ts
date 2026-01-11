import Database from "better-sqlite3";

export interface OrderRow {
  id: string;
  created_at: number;
  updated_at: number;
  expires_at: number;
  status: string;
  dungeon_id: string;

  pay_token_symbol: string;
  pay_token_address: string;
  pay_token_decimals: number;

  required_amount_raw: string;
  quote_sell_amount_raw: string;

  recipient_address: string;
  player_name: string;

  payment_tx_hash: string | null;
  paid_amount_raw: string | null;

  fulfill_tx_hash: string | null;
  game_id: number | null;

  last_error: string | null;
}

export function openDb(sqlitePath: string): Database.Database {
  const db = new Database(sqlitePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  return db;
}

export function initDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      status TEXT NOT NULL,
      dungeon_id TEXT NOT NULL,

      pay_token_symbol TEXT NOT NULL,
      pay_token_address TEXT NOT NULL,
      pay_token_decimals INTEGER NOT NULL,

      required_amount_raw TEXT NOT NULL,
      quote_sell_amount_raw TEXT NOT NULL,

      recipient_address TEXT NOT NULL,
      player_name TEXT NOT NULL,

      payment_tx_hash TEXT,
      paid_amount_raw TEXT,

      fulfill_tx_hash TEXT,
      game_id INTEGER,

      last_error TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_orders_status_created
      ON orders(status, created_at);
  `);
}
