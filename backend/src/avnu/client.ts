import { fetchQuotes, type Quote } from "@avnu/avnu-sdk";

function getAvnuBaseUrl(): string | undefined {
  const raw = process.env.AVNU_API_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/+$/, "");
}

export async function fetchBestQuote(params: {
  sellTokenAddress: string;
  buyTokenAddress: string;
  buyAmount: bigint;
}): Promise<Quote> {
  const quotes = await fetchQuotes(
    {
      sellTokenAddress: params.sellTokenAddress,
      buyTokenAddress: params.buyTokenAddress,
      buyAmount: params.buyAmount
    },
    { baseUrl: getAvnuBaseUrl() }
  );

  if (!quotes.length) {
    throw new Error("No AVNU quotes available");
  }

  return quotes[0];
}
