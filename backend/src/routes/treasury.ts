import { Router } from "express";
import type { AppConfig } from "../config.js";
import { getErc20Balance } from "../starknet/balance.js";
import { MAINNET_TICKET_TOKEN_ADDRESS } from "../starknet/tokens.js";

const ONE_TICKET = 1_000_000_000_000_000_000n;

export function buildTreasuryRouter(params: { config: AppConfig }): Router {
  const router = Router();

  router.get("/treasury/status", async (_req, res) => {
    try {
      const ticketBalance = await getErc20Balance({
        rpcUrl: params.config.STARKNET_RPC_URL,
        tokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
        accountAddress: params.config.STARKNET_TREASURY_ADDRESS
      });

      const ticketCount = Number(ticketBalance / ONE_TICKET);
      const canFulfillOrders = ticketBalance >= ONE_TICKET;

      return res.json({
        canFulfillOrders,
        ticketBalance: ticketCount,
        treasuryAddress: params.config.STARKNET_TREASURY_ADDRESS
      });
    } catch (error) {
      console.error("Error fetching treasury status:", error);
      return res.status(500).json({
        canFulfillOrders: false,
        ticketBalance: 0,
        error: "Failed to fetch treasury status"
      });
    }
  });

  return router;
}
