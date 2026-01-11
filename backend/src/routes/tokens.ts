import { Router } from "express";
import { PAY_TOKENS } from "../starknet/tokens.js";

export function buildTokensRouter(): Router {
  const router = Router();

  router.get("/tokens", (_req, res) => {
    res.json({
      payTokens: Object.values(PAY_TOKENS).map((token) => ({
        symbol: token.symbol,
        address: token.address,
        decimals: token.decimals
      }))
    });
  });

  return router;
}
