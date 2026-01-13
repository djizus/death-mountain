import {
  Account,
  CairoOption,
  CairoOptionVariant,
  CallData,
  RpcProvider,
  cairo,
  shortString,
  type GetTransactionReceiptResponse
} from "starknet";
import {
  MAINNET_SURVIVOR_DUNGEON_ADDRESS,
  MAINNET_TICKET_TOKEN_ADDRESS
} from "./tokens.js";
import { getReceiptStatuses } from "./receipts.js";

// Delay after blockchain transactions to avoid nonce issues
const POST_TX_DELAY_MS = 2000;

export interface FulfillmentResult {
  txHash: string;
  gameId: number | null;
  receipt: GetTransactionReceiptResponse | null;
  executionStatus?: string;
  finalityStatus?: string;
  revertReason?: string;
}

function isNonceError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes("nonce") ||
         message.toLowerCase().includes("invalid transaction nonce");
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function stringToFelt(value: string): string {
  return value ? shortString.encodeShortString(value) : "0x0";
}

function extractTxHash(response: unknown): string {
  if (!response || typeof response !== "object") {
    throw new Error("Missing transaction response");
  }
  const candidate = response as any;
  const txHash =
    typeof candidate.transaction_hash === "string"
      ? candidate.transaction_hash
      : typeof candidate.transactionHash === "string"
        ? candidate.transactionHash
        : undefined;
  if (!txHash) {
    throw new Error("Missing transaction_hash in response");
  }
  return txHash;
}

function parseGameIdFromReceipt(receipt: any): number | null {
  const events = Array.isArray(receipt?.events) ? receipt.events : [];
  const tokenMetadataEvent = events.find((event: any) => Array.isArray(event?.data) && event.data.length === 14);
  if (!tokenMetadataEvent) return null;
  const rawId = tokenMetadataEvent.data?.[1];
  if (typeof rawId !== "string") return null;
  try {
    return Number.parseInt(rawId, 16);
  } catch {
    return null;
  }
}

export async function submitBuyGameTx(params: {
  rpcUrl: string;
  treasuryAddress: string;
  treasuryPrivateKey: string;
  playerAddress: string;
  playerName: string;
  ticketAmountRaw?: bigint;
  maxRetries?: number;
}): Promise<{ txHash: string } & Partial<FulfillmentResult>> {
  const maxRetries = params.maxRetries ?? 3;
  const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
  const account = new Account({
    provider,
    address: params.treasuryAddress,
    signer: params.treasuryPrivateKey
  });

  const ticketAmountRaw = params.ticketAmountRaw ?? 1_000_000_000_000_000_000n;

  const approveCall = {
    contractAddress: MAINNET_TICKET_TOKEN_ADDRESS,
    entrypoint: "approve",
    calldata: CallData.compile({
      spender: MAINNET_SURVIVOR_DUNGEON_ADDRESS,
      amount: cairo.uint256(ticketAmountRaw)
    })
  };

  const buyGameCall = {
    contractAddress: MAINNET_SURVIVOR_DUNGEON_ADDRESS,
    entrypoint: "buy_game",
    calldata: CallData.compile([
      0,
      new CairoOption(CairoOptionVariant.Some, stringToFelt(params.playerName)),
      params.playerAddress,
      false
    ])
  };

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        // Wait before retry, with exponential backoff
        const retryDelay = Math.pow(2, attempt) * 1000;
        console.log(`[fulfill] Retry attempt ${attempt}/${maxRetries} after ${retryDelay}ms`);
        await delay(retryDelay);
      }

      const response = await account.execute([approveCall, buyGameCall]);
      const txHash = extractTxHash(response);

      // Add delay after successful transaction to avoid nonce issues on subsequent txs
      console.log(`[fulfill] Transaction submitted: ${txHash}, waiting ${POST_TX_DELAY_MS}ms`);
      await delay(POST_TX_DELAY_MS);

      return { txHash };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (isNonceError(error) && attempt < maxRetries) {
        console.log(`[fulfill] Nonce error detected, will retry: ${lastError.message}`);
        continue;
      }

      // For non-nonce errors or if we've exhausted retries, throw
      throw lastError;
    }
  }

  throw lastError ?? new Error("submitBuyGameTx failed");
}

export async function waitForFulfillment(params: {
  rpcUrl: string;
  txHash: string;
  timeoutMs: number;
}): Promise<FulfillmentResult> {
  const provider = new RpcProvider({ nodeUrl: params.rpcUrl });

  const receipt = await Promise.race([
    provider.waitForTransaction(params.txHash) as Promise<GetTransactionReceiptResponse>,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), params.timeoutMs))
  ]);

  if (!receipt) {
    return { txHash: params.txHash, gameId: null, receipt: null };
  }

  const { executionStatus, finalityStatus, revertReason } = getReceiptStatuses(receipt);
  const gameId = executionStatus === "SUCCEEDED" ? parseGameIdFromReceipt(receipt as any) : null;

  return {
    txHash: params.txHash,
    gameId,
    receipt,
    executionStatus,
    finalityStatus,
    revertReason
  };
}
