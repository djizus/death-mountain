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

    console.log("[worker] Processing order:", {
      id: order.id,
      status: order.status,
      paymentTxHash: order.payment_tx_hash,
      fulfillTxHash: order.fulfill_tx_hash,
      gameId: order.game_id,
      lastError: order.last_error,
    });

    busy = true;
    try {
      const now = Date.now();

      if (order.status === "awaiting_payment" && order.payment_tx_hash) {
        console.log("[worker] Verifying payment for order:", order.id);
        
        if (now > order.expires_at) {
          console.log("[worker] Order expired:", order.id);
          params.db
            .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
            .run("expired", now, order.id);
          return;
        }

        const required = BigInt(order.required_amount_raw);
        console.log("[worker] Verifying payment tx:", {
          txHash: order.payment_tx_hash,
          tokenAddress: order.pay_token_address,
          requiredAmount: required.toString(),
        });

        const verification = await verifyPaymentTx({
          rpcUrl: params.config.STARKNET_RPC_URL,
          txHash: order.payment_tx_hash,
          tokenAddress: order.pay_token_address,
          treasuryAddress: params.config.STARKNET_TREASURY_ADDRESS,
          expectedSender: order.recipient_address,
          minimumAmountRaw: required
        });

        console.log("[worker] Payment verification result:", verification);

        if (verification.status === "pending") {
          console.log("[worker] Payment still pending for order:", order.id);
          return;
        }

        if (verification.status === "failed") {
          console.error("[worker] Payment verification failed:", verification.error);
          params.db
            .prepare(
              "UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?"
            )
            .run("failed", Date.now(), verification.error, order.id);
          return;
        }

        console.log("[worker] Payment verified, marking order as paid:", order.id);
        params.db
          .prepare(
            "UPDATE orders SET status = ?, updated_at = ?, paid_amount_raw = ?, last_error = NULL WHERE id = ?"
          )
          .run("paid", Date.now(), verification.amount.toString(), order.id);
        return;
      }

      if (!params.config.STARKNET_TREASURY_PRIVATE_KEY) {
        console.error("[worker] Missing STARKNET_TREASURY_PRIVATE_KEY - cannot fulfill orders");
        params.db
          .prepare("UPDATE orders SET updated_at = ?, last_error = ? WHERE id = ?")
          .run(now, "Missing STARKNET_TREASURY_PRIVATE_KEY", order.id);
        return;
      }

      // Handle both "paid" orders and "fulfilling" orders without tx hash (retry case)
      const needsSubmission = 
        (order.status === "paid" && !order.fulfill_tx_hash) ||
        (order.status === "fulfilling" && !order.fulfill_tx_hash);

      if (needsSubmission) {
        const isRetry = order.status === "fulfilling";
        
        // Fail permanently if we've been trying for more than 10 minutes
        const MAX_FULFILLMENT_DURATION_MS = 10 * 60 * 1000;
        if (isRetry && (now - order.updated_at) > MAX_FULFILLMENT_DURATION_MS) {
          console.error("[worker] Order fulfillment timed out after 10 minutes:", order.id);
          params.db
            .prepare("UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?")
            .run("failed", now, "fulfillment_timeout_max_retries_exceeded", order.id);
          return;
        }

        console.log("[worker] Starting fulfillment for order:", order.id, { 
          status: order.status, 
          isRetry,
          timeSinceLastAttempt: isRetry ? `${Math.round((now - order.updated_at) / 1000)}s` : "N/A"
        });
        
        if (order.status === "paid") {
          params.db
            .prepare("UPDATE orders SET status = ?, updated_at = ? WHERE id = ?")
            .run("fulfilling", now, order.id);
        }

        const treasuryAddress = requireNormalizedAddress(
          params.config.STARKNET_TREASURY_ADDRESS,
          "treasury"
        );

        console.log("[worker] Checking ticket balance for treasury:", treasuryAddress);
        const ticketBalance = await getErc20Balance({
          rpcUrl: params.config.STARKNET_RPC_URL,
          tokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
          accountAddress: treasuryAddress
        });

        const currentTickets = Number(ticketBalance / ONE_TICKET);
        console.log("[worker] Treasury ticket balance:", {
          raw: ticketBalance.toString(),
          tickets: currentTickets,
          minimumReserve: params.config.TICKET_RESERVE_MINIMUM,
          targetReserve: params.config.TICKET_RESERVE_TARGET,
        });

        // Check if we can fulfill (must have MORE than minimum reserve)
        if (!canFulfillOrder(ticketBalance, params.config.TICKET_RESERVE_MINIMUM)) {
          console.error(
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

        console.log("[worker] Submitting buy_game transaction:", {
          treasuryAddress,
          playerAddress: order.recipient_address,
          playerName: order.player_name,
        });

        const tx = await submitBuyGameTx({
          rpcUrl: params.config.STARKNET_RPC_URL,
          treasuryAddress,
          treasuryPrivateKey: params.config.STARKNET_TREASURY_PRIVATE_KEY,
          playerAddress: requireNormalizedAddress(order.recipient_address, "recipient"),
          playerName: order.player_name
        });

        console.log("[worker] buy_game transaction submitted:", tx.txHash);
        params.db
          .prepare(
            "UPDATE orders SET updated_at = ?, fulfill_tx_hash = ?, last_error = NULL WHERE id = ?"
          )
          .run(Date.now(), tx.txHash, order.id);

        return;
      }

      if (order.status === "fulfilling" && order.fulfill_tx_hash && !order.game_id) {
        console.log("[worker] Waiting for fulfillment tx:", order.fulfill_tx_hash);
        const result = await waitForFulfillment({
          rpcUrl: params.config.STARKNET_RPC_URL,
          txHash: order.fulfill_tx_hash,
          timeoutMs: params.config.FULFILLMENT_WAIT_TIMEOUT_MS
        });

        console.log("[worker] Fulfillment result:", {
          txHash: result.txHash,
          gameId: result.gameId,
          executionStatus: result.executionStatus,
          finalityStatus: result.finalityStatus,
          revertReason: result.revertReason,
        });

        if (!result.receipt) {
          console.log("[worker] No receipt yet, will retry...");
          return;
        }

        if (result.executionStatus === "SUCCEEDED" && result.gameId !== null) {
          console.log("[worker] Order fulfilled successfully:", {
            orderId: order.id,
            gameId: result.gameId,
          });
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

        console.error("[worker] Fulfillment failed:", {
          orderId: order.id,
          error,
        });
        params.db
          .prepare(
            "UPDATE orders SET status = ?, updated_at = ?, last_error = ? WHERE id = ?"
          )
          .run("failed", Date.now(), error, order.id);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[worker] Error processing order:", {
        orderId: order.id,
        error: message,
        stack: error instanceof Error ? error.stack : undefined,
      });
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
