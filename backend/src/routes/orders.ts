import { Router } from "express";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import type { AppConfig } from "../config.js";
import type { Database, OrderRow } from "../db.js";
import { fetchBestQuote } from "../avnu/client.js";
import { requireNormalizedAddress } from "../starknet/address.js";
import { MAINNET_TICKET_TOKEN_ADDRESS, PAY_TOKENS, type PayTokenSymbol } from "../starknet/tokens.js";
import { verifyPaymentTx } from "../starknet/payment.js";

const createOrderSchema = z.object({
  dungeonId: z.literal("survivor").default("survivor"),
  payToken: z.enum(["ETH", "STRK", "LORDS", "USDC", "USDC_E", "SURVIVOR"]),
  recipientAddress: z.string().min(3),
  playerName: z.string().min(1).max(31)
});

const submitPaymentSchema = z.object({
  txHash: z.string().min(3)
});

function ceilDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) throw new Error("division_by_zero");
  return (numerator + denominator - 1n) / denominator;
}

function applyFeeBps(amount: bigint, feeBps: number): bigint {
  const factor = 10_000n + BigInt(feeBps);
  return ceilDiv(amount * factor, 10_000n);
}

function formatUnits(raw: bigint, decimals: number): string {
  const base = 10n ** BigInt(decimals);
  const integerPart = raw / base;
  const fractionPart = raw % base;
  if (fractionPart === 0n) {
    return integerPart.toString();
  }
  const fraction = fractionPart.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${integerPart.toString()}.${fraction}`;
}

function mapRow(row: OrderRow) {
  return {
    id: row.id,
    status: row.status,
    dungeonId: row.dungeon_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    payToken: {
      symbol: row.pay_token_symbol,
      address: row.pay_token_address,
      decimals: row.pay_token_decimals
    },
    requiredAmountRaw: row.required_amount_raw,
    requiredAmount: formatUnits(BigInt(row.required_amount_raw), row.pay_token_decimals),
    quoteSellAmountRaw: row.quote_sell_amount_raw,
    recipientAddress: row.recipient_address,
    playerName: row.player_name,
    treasuryAddress: undefined as unknown,
    paymentTxHash: row.payment_tx_hash,
    paidAmountRaw: row.paid_amount_raw,
    fulfillTxHash: row.fulfill_tx_hash,
    gameId: row.game_id,
    lastError: row.last_error
  };
}

export function buildOrdersRouter(params: {
  db: Database;
  config: AppConfig;
}): Router {
  const router = Router();

  router.post("/orders", async (req, res) => {
    const parsed = createOrderSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "invalid_request", details: parsed.error.flatten() });
    }

    const { payToken, recipientAddress, playerName, dungeonId } = parsed.data;

    const payTokenConfig = PAY_TOKENS[payToken as PayTokenSymbol];
    const normalizedRecipient = requireNormalizedAddress(recipientAddress, "recipient");

    const now = Date.now();
    const expiresAt = now + params.config.ORDER_QUOTE_TTL_SECONDS * 1000;

    // Quote: exact buyAmount=1 ticket, via AVNU. User pays quote * (1 + fee).
    const buyAmount = 1_000_000_000_000_000_000n;
    const quote = await fetchBestQuote({
      sellTokenAddress: payTokenConfig.address,
      buyTokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
      buyAmount
    });

    const sellAmount = BigInt(quote.sellAmount);
    const requiredAmount = applyFeeBps(sellAmount, params.config.ORDER_FEE_BPS);

    const orderId = uuidv4();

    params.db
      .prepare(
        `INSERT INTO orders (
          id, created_at, updated_at, expires_at, status, dungeon_id,
          pay_token_symbol, pay_token_address, pay_token_decimals,
          required_amount_raw, quote_sell_amount_raw,
          recipient_address, player_name,
          payment_tx_hash, paid_amount_raw,
          fulfill_tx_hash, game_id,
          last_error
        ) VALUES (
          @id, @created_at, @updated_at, @expires_at, @status, @dungeon_id,
          @pay_token_symbol, @pay_token_address, @pay_token_decimals,
          @required_amount_raw, @quote_sell_amount_raw,
          @recipient_address, @player_name,
          NULL, NULL,
          NULL, NULL,
          NULL
        )`
      )
      .run({
        id: orderId,
        created_at: now,
        updated_at: now,
        expires_at: expiresAt,
        status: "awaiting_payment",
        dungeon_id: dungeonId,
        pay_token_symbol: payTokenConfig.symbol,
        pay_token_address: payTokenConfig.address,
        pay_token_decimals: payTokenConfig.decimals,
        required_amount_raw: requiredAmount.toString(),
        quote_sell_amount_raw: sellAmount.toString(),
        recipient_address: normalizedRecipient,
        player_name: playerName
      });

    const row = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(orderId) as OrderRow;

    const response = mapRow(row);
    response.treasuryAddress = params.config.STARKNET_TREASURY_ADDRESS;

    return res.status(201).json(response);
  });

  router.get("/orders/:id", (req, res) => {
    const id = req.params.id;
    const row = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
    if (!row) {
      return res.status(404).json({ error: "not_found" });
    }

    const response = mapRow(row);
    response.treasuryAddress = params.config.STARKNET_TREASURY_ADDRESS;
    return res.json(response);
  });

  router.post("/orders/:id/payment", async (req, res) => {
    const id = req.params.id;
    console.log("[orders] Payment submission received:", { orderId: id, body: req.body });

    const body = submitPaymentSchema.safeParse(req.body);
    if (!body.success) {
      console.error("[orders] Invalid payment request:", body.error.flatten());
      return res.status(400).json({ error: "invalid_request", details: body.error.flatten() });
    }

    const row = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | undefined;
    if (!row) {
      console.error("[orders] Order not found:", id);
      return res.status(404).json({ error: "not_found" });
    }

    console.log("[orders] Found order:", {
      id: row.id,
      status: row.status,
      expiresAt: row.expires_at,
      paymentTxHash: row.payment_tx_hash,
    });

    const now = Date.now();
    if (now > row.expires_at && row.status === "awaiting_payment") {
      console.log("[orders] Order expired:", { orderId: id, expiresAt: row.expires_at, now });
      params.db
        .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
        .run("expired", now, id);
      return res.status(400).json({ error: "quote_expired" });
    }

    // Idempotency: if already paid/fulfilled, just return.
    if (row.status !== "awaiting_payment") {
      console.log("[orders] Order already processed, returning current state:", row.status);
      const current = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
      const response = mapRow(current);
      response.treasuryAddress = params.config.STARKNET_TREASURY_ADDRESS;
      return res.json(response);
    }

    if (row.payment_tx_hash && row.payment_tx_hash !== body.data.txHash) {
      console.error("[orders] Payment tx hash mismatch:", {
        existing: row.payment_tx_hash,
        submitted: body.data.txHash,
      });
      return res.status(409).json({ error: "payment_tx_hash_mismatch" });
    }

    if (!row.payment_tx_hash) {
      console.log("[orders] Storing payment tx hash:", body.data.txHash);
      params.db
        .prepare("UPDATE orders SET payment_tx_hash = ?, updated_at = ? WHERE id = ?")
        .run(body.data.txHash, now, id);
    }

    const required = BigInt(row.required_amount_raw);

    console.log("[orders] Verifying payment tx:", {
      txHash: body.data.txHash,
      tokenAddress: row.pay_token_address,
      treasuryAddress: params.config.STARKNET_TREASURY_ADDRESS,
      expectedSender: row.recipient_address,
      requiredAmount: required.toString(),
    });

    const verification = await verifyPaymentTx({
      rpcUrl: params.config.STARKNET_RPC_URL,
      txHash: body.data.txHash,
      tokenAddress: row.pay_token_address,
      treasuryAddress: params.config.STARKNET_TREASURY_ADDRESS,
      expectedSender: row.recipient_address,
      minimumAmountRaw: required
    });

    console.log("[orders] Payment verification result:", verification);

    if (verification.status === "pending") {
      console.log("[orders] Payment still pending, returning 202");
      const current = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
      const response = mapRow(current);
      response.treasuryAddress = params.config.STARKNET_TREASURY_ADDRESS;
      return res.status(202).json(response);
    }

    if (verification.status === "failed") {
      console.error("[orders] Payment verification failed:", verification);
      params.db
        .prepare("UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?")
        .run("failed", Date.now(), verification.error, id);

      return res.status(400).json({ error: "payment_verification_failed", details: verification });
    }

    console.log("[orders] Payment verified successfully, marking order as paid");
    params.db
      .prepare(
        "UPDATE orders SET status = ?, updated_at = ?, paid_amount_raw = ?, last_error = NULL WHERE id = ?"
      )
      .run("paid", Date.now(), verification.amount.toString(), id);

    const updated = params.db.prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow;
    const response = mapRow(updated);
    response.treasuryAddress = params.config.STARKNET_TREASURY_ADDRESS;
    console.log("[orders] Returning paid order:", { orderId: id, status: updated.status });
    return res.json(response);
  });

  return router;
}
