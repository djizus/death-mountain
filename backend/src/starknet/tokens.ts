import { requireNormalizedAddress } from "./address.js";

export type PayTokenSymbol = "ETH" | "STRK" | "LORDS" | "USDC" | "USDC_E" | "SURVIVOR";

export interface TokenConfig {
  symbol: PayTokenSymbol;
  address: string;
  decimals: number;
}

export const MAINNET_TICKET_TOKEN_ADDRESS = requireNormalizedAddress(
  "0x0452810188C4Cb3AEbD63711a3b445755BC0D6C4f27B923fDd99B1A118858136",
  "ticket"
);

export const MAINNET_SURVIVOR_DUNGEON_ADDRESS = requireNormalizedAddress(
  "0x00a67ef20b61a9846e1c82b411175e6ab167ea9f8632bd6c2091823c3629ec42",
  "survivor dungeon"
);

export const PAY_TOKENS: Record<PayTokenSymbol, TokenConfig> = {
  LORDS: {
    symbol: "LORDS",
    address: requireNormalizedAddress(
      "0x0124aeb495b947201f5fac96fd1138e326ad86195b98df6dec9009158a533b49",
      "LORDS"
    ),
    decimals: 18
  },
  ETH: {
    symbol: "ETH",
    address: requireNormalizedAddress(
      "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
      "ETH"
    ),
    decimals: 18
  },
  STRK: {
    symbol: "STRK",
    address: requireNormalizedAddress(
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
      "STRK"
    ),
    decimals: 18
  },
  USDC_E: {
    symbol: "USDC_E",
    address: requireNormalizedAddress(
      "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8",
      "USDC.e"
    ),
    decimals: 6
  },
  USDC: {
    symbol: "USDC",
    address: requireNormalizedAddress(
      "0x033068F6539f8e6e6b131e6B2B814e6c34A5224bC66947c47DaB9dFeE93b35fb",
      "USDC"
    ),
    decimals: 6
  },
  SURVIVOR: {
    symbol: "SURVIVOR",
    address: requireNormalizedAddress(
      "0x042DD777885AD2C116be96d4D634abC90A26A790ffB5871E037Dd5Ae7d2Ec86B",
      "SURVIVOR"
    ),
    decimals: 18
  }
};
