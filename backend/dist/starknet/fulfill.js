import { Account, CairoOption, CairoOptionVariant, CallData, RpcProvider, cairo, shortString } from "starknet";
import { MAINNET_SURVIVOR_DUNGEON_ADDRESS, MAINNET_TICKET_TOKEN_ADDRESS } from "./tokens.js";
import { getReceiptStatuses } from "./receipts.js";
function stringToFelt(value) {
    return value ? shortString.encodeShortString(value) : "0x0";
}
function extractTxHash(response) {
    if (!response || typeof response !== "object") {
        throw new Error("Missing transaction response");
    }
    const candidate = response;
    const txHash = typeof candidate.transaction_hash === "string"
        ? candidate.transaction_hash
        : typeof candidate.transactionHash === "string"
            ? candidate.transactionHash
            : undefined;
    if (!txHash) {
        throw new Error("Missing transaction_hash in response");
    }
    return txHash;
}
function parseGameIdFromReceipt(receipt) {
    const events = Array.isArray(receipt?.events) ? receipt.events : [];
    const tokenMetadataEvent = events.find((event) => Array.isArray(event?.data) && event.data.length === 14);
    if (!tokenMetadataEvent)
        return null;
    const rawId = tokenMetadataEvent.data?.[1];
    if (typeof rawId !== "string")
        return null;
    try {
        return Number.parseInt(rawId, 16);
    }
    catch {
        return null;
    }
}
export async function submitBuyGameTx(params) {
    const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
    const account = new Account({
        provider,
        address: params.treasuryAddress,
        signer: params.treasuryPrivateKey
    });
    const ticketAmountRaw = params.ticketAmountRaw ?? 1000000000000000000n;
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
export async function waitForFulfillment(params) {
    const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
    const receipt = await Promise.race([
        provider.waitForTransaction(params.txHash),
        new Promise((resolve) => setTimeout(() => resolve(null), params.timeoutMs))
    ]);
    if (!receipt) {
        return { txHash: params.txHash, gameId: null, receipt: null };
    }
    const { executionStatus, finalityStatus, revertReason } = getReceiptStatuses(receipt);
    const gameId = executionStatus === "SUCCEEDED" ? parseGameIdFromReceipt(receipt) : null;
    return {
        txHash: params.txHash,
        gameId,
        receipt,
        executionStatus,
        finalityStatus,
        revertReason
    };
}
