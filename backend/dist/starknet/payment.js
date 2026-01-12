import { RpcProvider } from "starknet";
import { normalizeAddress } from "./address.js";
import { findErc20Transfer } from "./erc20.js";
import { getReceiptStatuses } from "./receipts.js";
export async function verifyPaymentTx(params) {
    const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
    let receipt;
    try {
        receipt = await provider.getTransactionReceipt(params.txHash);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { status: "pending", reason: message };
    }
    const { executionStatus, finalityStatus, revertReason } = getReceiptStatuses(receipt);
    if (executionStatus !== "SUCCEEDED") {
        return {
            status: "failed",
            error: "payment_tx_failed",
            executionStatus,
            finalityStatus,
            revertReason
        };
    }
    const events = (receipt?.events ?? []);
    const match = findErc20Transfer({
        receiptEvents: events,
        tokenAddress: params.tokenAddress,
        toAddress: params.treasuryAddress
    });
    if (!match) {
        return { status: "failed", error: "transfer_not_found" };
    }
    const expectedSender = normalizeAddress(params.expectedSender ?? null);
    if (expectedSender && match.from !== expectedSender) {
        return {
            status: "failed",
            error: `unexpected_sender:${match.from}`
        };
    }
    if (match.amount < params.minimumAmountRaw) {
        return {
            status: "failed",
            error: `insufficient_amount:${match.amount.toString()}`
        };
    }
    return {
        status: "verified",
        from: match.from,
        to: match.to,
        amount: match.amount
    };
}
