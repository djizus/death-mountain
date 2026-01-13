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

export interface FulfillmentResult {
  txHash: string;
  gameId: number | null;
  receipt: GetTransactionReceiptResponse | null;
  executionStatus?: string;
  finalityStatus?: string;
  revertReason?: string;
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
}): Promise<{ txHash: string } & Partial<FulfillmentResult>> {
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

  const response = await account.execute([approveCall, buyGameCall]);
  return { txHash: extractTxHash(response) };
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
