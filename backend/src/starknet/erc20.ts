import { hash } from "starknet";
import { normalizeAddress } from "./address.js";

export interface StarknetEvent {
  from_address?: string;
  fromAddress?: string;
  keys: string[];
  data: string[];
}

export interface TransferMatch {
  tokenAddress: string;
  from: string;
  to: string;
  amount: bigint;
}

function uint256ToBigInt(low: string, high: string): bigint {
  const lowPart = BigInt(low);
  const highPart = BigInt(high);
  return lowPart + (highPart << 128n);
}

export function findErc20Transfer(params: {
  receiptEvents: StarknetEvent[];
  tokenAddress: string;
  toAddress: string;
}): TransferMatch | null {
  const selector = hash.getSelectorFromName("Transfer");
  const tokenAddress = normalizeAddress(params.tokenAddress);
  const toAddress = normalizeAddress(params.toAddress);

  if (!tokenAddress || !toAddress) {
    return null;
  }

  for (const event of params.receiptEvents) {
    const fromAddressRaw = (event.from_address ?? event.fromAddress) as string | undefined;
    const eventToken = normalizeAddress(fromAddressRaw);
    if (!eventToken || eventToken !== tokenAddress) {
      continue;
    }

    if (!event.keys?.length) continue;
    if (event.keys[0] !== selector) continue;

    // Common OZ Cairo 1 pattern: keys=[selector, from, to], data=[low, high]
    if (event.keys.length >= 3 && event.data.length >= 2) {
      const from = normalizeAddress(event.keys[1]);
      const to = normalizeAddress(event.keys[2]);
      if (!from || !to) continue;
      if (to !== toAddress) continue;

      const amount = uint256ToBigInt(event.data[0], event.data[1]);
      return { tokenAddress, from, to, amount };
    }

    // Alternate pattern: keys=[selector], data=[from, to, low, high]
    if (event.data.length >= 4) {
      const from = normalizeAddress(event.data[0]);
      const to = normalizeAddress(event.data[1]);
      if (!from || !to) continue;
      if (to !== toAddress) continue;

      const amount = uint256ToBigInt(event.data[2], event.data[3]);
      return { tokenAddress, from, to, amount };
    }
  }

  return null;
}
