import type { AppConfig } from "./config.js";
import type { Database, OrderRow } from "./db.js";
import { submitBuyGameTx, waitForFulfillment } from "./starknet/fulfill.js";
import { requireNormalizedAddress } from "./starknet/address.js";
import { getErc20Balance } from "./starknet/balance.js";
import { MAINNET_TICKET_TOKEN_ADDRESS } from "./starknet/tokens.js";
import { verifyPaymentTx } from "./starknet/payment.js";
import { canFulfillOrder, restockTicketsIfNeeded } from "./starknet/restock.js";

const ONE_TICKET = 1_000_000_000_000_000_000n;

export interface WorkerState {
  running: boolean;
}

export function startWorker(params: {
  db: Database;
  config: AppConfig;
}): WorkerState {
  let busy = false;
  let lastRestockCheck = 0;
  const RESTOCK_CHECK_INTERVAL_MS = 60_000; // Check every minute
  const state: WorkerState = { running: true };

  const tick = async () => {
    if (!state.running) return;
    if (busy) return;

    // Periodic restock check (independent of order processing)
    const now = Date.now();
    if (now - lastRestockCheck > RESTOCK_CHECK_INTERVAL_MS) {
      lastRestockCheck = now;
      // Fire and forget - don't block order processing
      restockTicketsIfNeeded({ config: params.config }).catch((err) => {
        console.error("[worker] Periodic restock check failed:", err);
      });
    }

    const order = params.db
      .prepare(
        `SELECT * FROM orders
         WHERE (status = 'awaiting_payment' AND payment_tx_hash IS NOT NULL)
            OR status IN ('paid', 'fulfilling')
         ORDER BY created_at ASC
         LIMIT 1`
      )
      .get() as OrderRow | undefined;

    if (!order) return;

    busy = true;
    try {
      const now = Date.now();

      if (order.status === "awaiting_payment" && order.payment_tx_hash) {
        if (now > order.expires_at) {
          params.db
            .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
            .run("expired", now, order.id);
          return;
        }

        const required = BigInt(order.required_amount_raw);
        const verification = await verifyPaymentTx({
          rpcUrl: params.config.STARKNET_RPC_URL,
          txHash: order.payment_tx_hash,
          tokenAddress: order.pay_token_address,
          treasuryAddress: params.config.STARKNET_TREASURY_ADDRESS,
          expectedSender: order.recipient_address,
          minimumAmountRaw: required
        });

        if (verification.status === "pending") {
          return;
        }

        if (verification.status === "failed") {
          params.db
            .prepare(
              "UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?"
            )
            .run("failed", Date.now(), verification.error, order.id);
          return;
        }

        params.db
          .prepare(
            "UPDATE orders SET status = ?, updated_at = ?, paid_amount_raw = ?, last_error = NULL WHERE id = ?"
          )
          .run("paid", Date.now(), verification.amount.toString(), order.id);
        return;
      }

      if (!params.config.STARKNET_TREASURY_PRIVATE_KEY) {
        // Can't fulfill without a signer.
        params.db
          .prepare("UPDATE orders SET updated_at = ?, last_error = ? WHERE id = ?")
          .run(now, "Missing STARKNET_TREASURY_PRIVATE_KEY", order.id);
        return;
      }

      if (order.status === "paid" && !order.fulfill_tx_hash) {
        params.db
          .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
          .run("fulfilling", now, order.id);

        const treasuryAddress = requireNormalizedAddress(
          params.config.STARKNET_TREASURY_ADDRESS,
          "treasury"
        );

        const ticketBalance = await getErc20Balance({
          rpcUrl: params.config.STARKNET_RPC_URL,
          tokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
          accountAddress: treasuryAddress
        });

        const currentTickets = Number(ticketBalance / ONE_TICKET);

        // Check if we can fulfill (must have MORE than minimum reserve)
        if (!canFulfillOrder(ticketBalance, params.config.TICKET_RESERVE_MINIMUM)) {
          console.log(
            `[worker] Cannot fulfill order: ${currentTickets} tickets <= ${params.config.TICKET_RESERVE_MINIMUM} minimum reserve`
          );
          params.db
            .prepare(
              "UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?"
            )
            .run(
              "failed",
              Date.now(),
              "insufficient_ticket_balance",
              order.id
            );
          return;
        }

        // Trigger restock in background if below target (don't block fulfillment)
        if (currentTickets < params.config.TICKET_RESERVE_TARGET) {
          console.log(
            `[worker] Tickets (${currentTickets}) below target (${params.config.TICKET_RESERVE_TARGET}), triggering restock`
          );
          // Fire and forget - don't await, let it run in background
          restockTicketsIfNeeded({ config: params.config }).catch((err) => {
            console.error("[worker] Background restock failed:", err);
          });
        }

        const tx = await submitBuyGameTx({
          rpcUrl: params.config.STARKNET_RPC_URL,
          treasuryAddress,
          treasuryPrivateKey: params.config.STARKNET_TREASURY_PRIVATE_KEY,
          playerAddress: requireNormalizedAddress(order.recipient_address, "recipient"),
          playerName: order.player_name
        });

        params.db
          .prepare(
            "UPDATE orders SET updated_at = ?, fulfill_tx_hash = ?, last_error = NULL WHERE id = ?"
          )
          .run(Date.now(), tx.txHash, order.id);

        return;
      }

      if (order.status === "fulfilling" && order.fulfill_tx_hash && !order.game_id) {
        const result = await waitForFulfillment({
          rpcUrl: params.config.STARKNET_RPC_URL,
          txHash: order.fulfill_tx_hash,
          timeoutMs: params.config.FULFILLMENT_WAIT_TIMEOUT_MS
        });

        if (!result.receipt) {
          return;
        }

        if (result.executionStatus === "SUCCEEDED" && result.gameId !== null) {
          params.db
            .prepare(
              "UPDATE orders SET status = ?, updated_at = ?, game_id = ?, last_error = NULL WHERE id = ?"
            )
            .run("fulfilled", Date.now(), result.gameId, order.id);
          return;
        }

        const error =
          result.revertReason ??
          (result.executionStatus ? `execution_${result.executionStatus}` : "unknown_fulfillment_error");

        params.db
          .prepare(
            "UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?"
          )
          .run("failed", Date.now(), error, order.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      params.db
        .prepare("UPDATE orders SET updated_at = ?, last_error = ? WHERE id = ?")
        .run(Date.now(), message, order.id);
    } finally {
      busy = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, params.config.WORKER_POLL_INTERVAL_MS);

  // Do an eager tick for local dev.
  void tick();

  process.on("SIGINT", () => {
    state.running = false;
    clearInterval(interval);
  });
  process.on("SIGTERM", () => {
    state.running = false;
    clearInterval(interval);
  });

  return state;
}
