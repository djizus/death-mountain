import { RpcProvider } from "starknet";
import { normalizeAddress } from "./address.js";
function padAddress(value) {
    const normalized = normalizeAddress(value);
    if (!normalized) {
        return value;
    }
    const stripped = normalized.replace(/^0x/, "");
    return `0x${stripped.padStart(64, "0")}`;
}
function parseUint256(result) {
    if (!result || result.length === 0) {
        return 0n;
    }
    const [low, high] = result;
    const lowPart = BigInt(low ?? "0");
    const highPart = BigInt(high ?? "0");
    return lowPart + (highPart << 128n);
}
export async function getErc20Balance(params) {
    const maxRetries = params.retries ?? 2;
    const provider = new RpcProvider({ nodeUrl: params.rpcUrl });
    const token = normalizeAddress(params.tokenAddress);
    const account = normalizeAddress(params.accountAddress);
    if (!token || !account) {
        throw new Error("invalid_address");
    }
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const callResult = (await provider.callContract({
                contractAddress: padAddress(token),
                entrypoint: "balanceOf",
                calldata: [padAddress(account)]
            }, "latest"));
            if (Array.isArray(callResult)) {
                return parseUint256(callResult);
            }
            if (callResult && typeof callResult === "object" && "result" in callResult) {
                return parseUint256(callResult.result);
            }
            if (callResult && typeof callResult === "object" && "balance" in callResult) {
                const balance = callResult.balance;
                return balance ? parseUint256([balance.low ?? "0", balance.high ?? "0"]) : 0n;
            }
            return 0n;
        }
        catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            // Check if this is an HTML response error (rate limiting, server error, etc.)
            const isHtmlError = lastError.message.includes("is not valid JSON") ||
                lastError.message.includes("<html");
            if (isHtmlError && attempt < maxRetries) {
                // Wait before retrying (exponential backoff: 1s, 2s, 4s...)
                const delay = Math.pow(2, attempt) * 1000;
                console.log(`[getErc20Balance] RPC returned HTML, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            // If not an HTML error or out of retries, throw
            throw lastError;
        }
    }
    throw lastError ?? new Error("getErc20Balance failed");
}
