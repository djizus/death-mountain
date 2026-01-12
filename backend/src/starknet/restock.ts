import { Account, RpcProvider } from "starknet";
import { executeSwap, fetchQuotes } from "@avnu/avnu-sdk";
import type { AppConfig } from "../config.js";
import { getErc20Balance } from "./balance.js";
import { MAINNET_TICKET_TOKEN_ADDRESS, PAY_TOKENS, type PayTokenSymbol, type TokenConfig } from "./tokens.js";

const ONE_TICKET = 1_000_000_000_000_000_000n;
const LORDS_ADDRESS = PAY_TOKENS.LORDS.address;

// Tokens that can be sold to acquire LORDS (excludes LORDS itself)
const SELLABLE_TOKENS: PayTokenSymbol[] = ["ETH", "STRK", "USDC", "USDC_E", "SURVIVOR"];

function getAvnuBaseUrl(): string | undefined {
  const raw = process.env.AVNU_API_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

export interface RestockResult {
  success: boolean;
  ticketsBought: number;
  txHashes: string[];
  tokenUsed?: string;
  error?: string;
}

export interface RestockState {
  isRestocking: boolean;
  lastRestockAttempt: number | null;
  lastRestockResult: RestockResult | null;
}

interface TokenBalance {
  token: TokenConfig;
  balance: bigint;
  balanceUsd: number;
}

// Global restock state to prevent concurrent restocks
const restockState: RestockState = {
  isRestocking: false,
  lastRestockAttempt: null,
  lastRestockResult: null
};

export function getRestockState(): RestockState {
  return { ...restockState };
}

/**
 * Get balances of all sellable tokens and estimate their USD values.
 * Returns tokens sorted by USD value (highest first).
 */
async function getTokenBalancesWithUsdValue(params: {
  rpcUrl: string;
  accountAddress: string;
}): Promise<TokenBalance[]> {
  const { rpcUrl, accountAddress } = params;
  const balances: TokenBalance[] = [];

  // Fetch all balances in parallel
  const balancePromises = SELLABLE_TOKENS.map(async (symbol) => {
    const token = PAY_TOKENS[symbol];
    const balance = await getErc20Balance({
      rpcUrl,
      tokenAddress: token.address,
      accountAddress
    });
    return { token, balance };
  });

  const tokenBalances = await Promise.all(balancePromises);

  // Get USD values via AVNU quotes (sell token -> LORDS gives us USD value)
  for (const { token, balance } of tokenBalances) {
    if (balance === 0n) {
      continue;
    }

    try {
      // Get a quote to estimate USD value of the balance
      const quotes = await fetchQuotes(
        {
          sellTokenAddress: token.address,
          buyTokenAddress: LORDS_ADDRESS,
          sellAmount: balance,
          takerAddress: params.accountAddress
        },
        { baseUrl: getAvnuBaseUrl() }
      );

      if (quotes.length > 0) {
        balances.push({
          token,
          balance,
          balanceUsd: quotes[0].sellAmountInUsd
        });
      }
    } catch (error) {
      // Skip tokens that can't be quoted
      console.log(`[restock] Could not get quote for ${token.symbol}: ${error}`);
    }
  }

  // Sort by USD value descending
  balances.sort((a, b) => b.balanceUsd - a.balanceUsd);

  return balances;
}

/**
 * Find the best token to sell for acquiring LORDS.
 * Returns the token with the highest USD value that can cover the required LORDS amount.
 */
async function findBestTokenToSell(params: {
  rpcUrl: string;
  accountAddress: string;
  lordsNeeded: bigint;
}): Promise<{ token: TokenConfig; quote: Awaited<ReturnType<typeof fetchQuotes>>[0] } | null> {
  const { rpcUrl, accountAddress, lordsNeeded } = params;

  // Get all token balances with USD values
  const balances = await getTokenBalancesWithUsdValue({
    rpcUrl,
    accountAddress
  });

  if (balances.length === 0) {
    return null;
  }

  console.log(`[restock] Token balances (by USD value):`);
  for (const { token, balance, balanceUsd } of balances) {
    const formatted = Number(balance) / 10 ** token.decimals;
    console.log(`  ${token.symbol}: ${formatted.toFixed(4)} ($${balanceUsd.toFixed(2)})`);
  }

  // Try each token starting with highest USD value
  for (const { token, balance } of balances) {
    try {
      // Get quote to buy the required LORDS
      const quotes = await fetchQuotes(
        {
          sellTokenAddress: token.address,
          buyTokenAddress: LORDS_ADDRESS,
          buyAmount: lordsNeeded,
          takerAddress: accountAddress
        },
        { baseUrl: getAvnuBaseUrl() }
      );

      if (quotes.length === 0) {
        continue;
      }

      const quote = quotes[0];
      const sellAmountNeeded = BigInt(quote.sellAmount);

      // Check if we have enough balance
      if (balance >= sellAmountNeeded) {
        console.log(`[restock] Selected ${token.symbol} (highest value with sufficient balance)`);
        return { token, quote };
      } else {
        const have = Number(balance) / 10 ** token.decimals;
        const need = Number(sellAmountNeeded) / 10 ** token.decimals;
        console.log(`[restock] ${token.symbol} insufficient: have ${have.toFixed(4)}, need ${need.toFixed(4)}`);
      }
    } catch (error) {
      console.log(`[restock] Could not get quote for ${token.symbol} -> LORDS: ${error}`);
    }
  }

  return null;
}

/**
 * Check if we need to restock tickets and perform the restock if needed.
 * Automatically selects the token with highest USD value to swap for LORDS -> TICKET.
 */
export async function restockTicketsIfNeeded(params: {
  config: AppConfig;
}): Promise<RestockResult | null> {
  const { config } = params;

  // Prevent concurrent restocks
  if (restockState.isRestocking) {
    return null;
  }

  if (!config.STARKNET_TREASURY_PRIVATE_KEY) {
    return null;
  }

  const provider = new RpcProvider({ nodeUrl: config.STARKNET_RPC_URL });
  const treasuryAddress = config.STARKNET_TREASURY_ADDRESS;

  // Check current ticket balance
  const ticketBalance = await getErc20Balance({
    rpcUrl: config.STARKNET_RPC_URL,
    tokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
    accountAddress: treasuryAddress
  });

  const currentTickets = Number(ticketBalance / ONE_TICKET);
  const targetTickets = config.TICKET_RESERVE_TARGET;

  // If we're at or above target, no restock needed
  if (currentTickets >= targetTickets) {
    return null;
  }

  // Calculate how many tickets to buy
  const ticketsNeeded = targetTickets - currentTickets;
  const ticketAmountToBuy = BigInt(ticketsNeeded) * ONE_TICKET;

  console.log(`[restock] Current tickets: ${currentTickets}, target: ${targetTickets}, buying: ${ticketsNeeded}`);

  restockState.isRestocking = true;
  restockState.lastRestockAttempt = Date.now();

  const txHashes: string[] = [];
  let tokenUsed: string | undefined;

  try {
    const account = new Account({
      provider,
      address: treasuryAddress,
      signer: config.STARKNET_TREASURY_PRIVATE_KEY
    });

    // Step 1: Get quote for LORDS -> TICKET
    const lordsToTicketQuotes = await fetchQuotes(
      {
        sellTokenAddress: LORDS_ADDRESS,
        buyTokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
        buyAmount: ticketAmountToBuy,
        takerAddress: treasuryAddress
      },
      { baseUrl: getAvnuBaseUrl() }
    );

    if (!lordsToTicketQuotes.length) {
      throw new Error("No AVNU quotes available for LORDS -> TICKET");
    }

    const lordsToTicketQuote = lordsToTicketQuotes[0];
    const lordsNeeded = BigInt(lordsToTicketQuote.sellAmount);

    console.log(`[restock] Need ${Number(lordsNeeded) / 1e18} LORDS for ${ticketsNeeded} tickets`);

    // Step 2: Check LORDS balance
    const lordsBalance = await getErc20Balance({
      rpcUrl: config.STARKNET_RPC_URL,
      tokenAddress: LORDS_ADDRESS,
      accountAddress: treasuryAddress
    });

    // Step 3: If not enough LORDS, find best token to swap
    if (lordsBalance < lordsNeeded) {
      const lordsDeficit = lordsNeeded - lordsBalance;

      console.log(`[restock] LORDS deficit: ${Number(lordsDeficit) / 1e18}, finding best token to swap`);

      // Find the token with highest USD value that can cover the deficit
      const bestToken = await findBestTokenToSell({
        rpcUrl: config.STARKNET_RPC_URL,
        accountAddress: treasuryAddress,
        lordsNeeded: lordsDeficit
      });

      if (!bestToken) {
        throw new Error("No token with sufficient balance to acquire LORDS");
      }

      const { token: sellToken, quote: sellToLordsQuote } = bestToken;
      tokenUsed = sellToken.symbol;

      const sellAmountNeeded = BigInt(sellToLordsQuote.sellAmount);
      console.log(`[restock] Executing swap: ${Number(sellAmountNeeded) / 10 ** sellToken.decimals} ${sellToken.symbol} -> LORDS`);

      // Execute the swap
      const sellToLordsResult = await executeSwap(
        account,
        sellToLordsQuote,
        {
          slippage: config.RESTOCK_SLIPPAGE,
          executeApprove: true
        },
        { baseUrl: getAvnuBaseUrl() }
      );

      txHashes.push(sellToLordsResult.transactionHash);
      console.log(`[restock] ${sellToken.symbol} -> LORDS swap tx: ${sellToLordsResult.transactionHash}`);

      // Wait for the transaction to be confirmed
      await provider.waitForTransaction(sellToLordsResult.transactionHash);
    }

    // Step 4: Now swap LORDS -> TICKET
    // Re-fetch quote in case prices changed
    const finalLordsToTicketQuotes = await fetchQuotes(
      {
        sellTokenAddress: LORDS_ADDRESS,
        buyTokenAddress: MAINNET_TICKET_TOKEN_ADDRESS,
        buyAmount: ticketAmountToBuy,
        takerAddress: treasuryAddress
      },
      { baseUrl: getAvnuBaseUrl() }
    );

    if (!finalLordsToTicketQuotes.length) {
      throw new Error("No AVNU quotes available for LORDS -> TICKET (final)");
    }

    const finalQuote = finalLordsToTicketQuotes[0];

    console.log(`[restock] Executing swap: LORDS -> ${ticketsNeeded} TICKET`);

    const lordsToTicketResult = await executeSwap(
      account,
      finalQuote,
      {
        slippage: config.RESTOCK_SLIPPAGE,
        executeApprove: true
      },
      { baseUrl: getAvnuBaseUrl() }
    );

    txHashes.push(lordsToTicketResult.transactionHash);
    console.log(`[restock] LORDS -> TICKET swap tx: ${lordsToTicketResult.transactionHash}`);

    // Wait for the transaction to be confirmed
    await provider.waitForTransaction(lordsToTicketResult.transactionHash);

    const result: RestockResult = {
      success: true,
      ticketsBought: ticketsNeeded,
      txHashes,
      tokenUsed
    };

    restockState.lastRestockResult = result;
    restockState.isRestocking = false;

    console.log(`[restock] Successfully bought ${ticketsNeeded} tickets`);
    return result;

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[restock] Failed to restock tickets:`, errorMessage);

    const result: RestockResult = {
      success: false,
      ticketsBought: 0,
      txHashes,
      tokenUsed,
      error: errorMessage
    };

    restockState.lastRestockResult = result;
    restockState.isRestocking = false;

    return result;
  }
}

/**
 * Check if the treasury can fulfill an order given current balance and reserve rules.
 * Returns true if balance > minimum reserve (5 tickets).
 */
export function canFulfillOrder(ticketBalance: bigint, minimumReserve: number): boolean {
  const currentTickets = Number(ticketBalance / ONE_TICKET);
  // Can fulfill if we have MORE than the minimum (not equal to)
  return currentTickets > minimumReserve;
}
