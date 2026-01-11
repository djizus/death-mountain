import { RpcProvider } from "starknet";
import { normalizeAddress } from "./address.js";

function padAddress(value: string): string {
  const normalized = normalizeAddress(value);
  if (!normalized) {
    return value;
  }
  const stripped = normalized.replace(/^0x/, "");
  return `0x${stripped.padStart(64, "0")}`;
}

function parseUint256(result: string[] | undefined): bigint {
  if (!result || result.length === 0) {
    return 0n;
  }

  const [low, high] = result;
  const lowPart = BigInt(low ?? "0");
  const highPart = BigInt(high ?? "0");
  return lowPart + (highPart << 128n);
}

export async function getErc20Balance(params: {
  rpcUrl: string;
  tokenAddress: string;
  accountAddress: string;
}): Promise<bigint> {
  const provider = new RpcProvider({ nodeUrl: params.rpcUrl });

  const token = normalizeAddress(params.tokenAddress);
  const account = normalizeAddress(params.accountAddress);
  if (!token || !account) {
    throw new Error("invalid_address");
  }

  const callResult = (await provider.callContract(
    {
      contractAddress: padAddress(token),
      entrypoint: "balanceOf",
      calldata: [padAddress(account)]
    },
    "latest"
  )) as unknown;

  if (Array.isArray(callResult)) {
    return parseUint256(callResult as string[]);
  }

  if (callResult && typeof callResult === "object" && "result" in callResult) {
    return parseUint256((callResult as { result?: string[] }).result);
  }

  if (callResult && typeof callResult === "object" && "balance" in callResult) {
    const balance = (callResult as { balance?: { low?: string; high?: string } }).balance;
    return balance ? parseUint256([balance.low ?? "0", balance.high ?? "0"]) : 0n;
  }

  return 0n;
}
