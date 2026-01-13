export type OrderStatus =
  | "awaiting_payment"
  | "paid"
  | "fulfilling"
  | "fulfilled"
  | "failed"
  | "expired";

export type PayToken = "ETH" | "STRK" | "LORDS" | "USDC" | "USDC_E" | "SURVIVOR";

export interface OrderResponse {
  id: string;
  status: OrderStatus;
  dungeonId: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  payToken: {
    symbol: string;
    address: string;
    decimals: number;
  };
  requiredAmountRaw: string;
  requiredAmount: string;
  quoteSellAmountRaw: string;
  recipientAddress: string;
  playerName: string;
  treasuryAddress: string;
  paymentTxHash: string | null;
  paidAmountRaw: string | null;
  fulfillTxHash: string | null;
  gameId: number | null;
  lastError: string | null;
}

function getApiBaseUrl(): string {
  const raw = (import.meta.env.VITE_BACKEND_URL as string | undefined) ?? "";
  const normalized = raw.trim().replace(/\/+$/, "");
  return normalized ? `${normalized}/api/v1` : "/api/v1";
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = `${getApiBaseUrl()}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {})
    }
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = json?.error ? String(json.error) : `http_${response.status}`;
    throw new Error(message);
  }

  return json as T;
}

export async function createOrder(params: {
  dungeonId: "survivor";
  payToken: PayToken;
  recipientAddress: string;
  playerName: string;
}): Promise<OrderResponse> {
  return requestJson<OrderResponse>("/orders", {
    method: "POST",
    body: JSON.stringify(params)
  });
}

export async function submitOrderPayment(params: {
  orderId: string;
  txHash: string;
}): Promise<OrderResponse> {
  return requestJson<OrderResponse>(`/orders/${params.orderId}/payment`, {
    method: "POST",
    body: JSON.stringify({ txHash: params.txHash })
  });
}

export async function getOrder(orderId: string): Promise<OrderResponse> {
  return requestJson<OrderResponse>(`/orders/${orderId}`);
}

export interface TreasuryStatus {
  canFulfillOrders: boolean;
  ticketBalance: number;
  treasuryAddress?: string;
  error?: string;
}

export async function getTreasuryStatus(): Promise<TreasuryStatus> {
  try {
    return await requestJson<TreasuryStatus>("/treasury/status");
  } catch {
    return { canFulfillOrders: false, ticketBalance: 0, error: "Failed to fetch status" };
  }
}
