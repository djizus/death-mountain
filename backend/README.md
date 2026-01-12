# Death Mountain Backend

Backend service for processing dungeon ticket purchases. Users pay with any supported token, and the treasury mints game entries on their behalf.

## Overview

```
User                          Backend                        Starknet
  |                              |                               |
  |-- POST /orders ------------->| (creates order + AVNU quote)  |
  |<-- order + treasury addr ----|                               |
  |                              |                               |
  |-- transfer(treasury, amt) ---|------------------------------->|
  |<-- txHash -------------------|-------------------------------|
  |                              |                               |
  |-- POST /orders/:id/payment ->|                               |
  |                              |                               |
  |                              |<-- worker verifies payment ---|
  |                              |                               |
  |                              |-- approve(dungeon, 1 TICKET)->|
  |                              |-- buy_game(to=user) --------->|
  |                              |<-- receipt + gameId ----------|
  |                              |                               |
  |<-- GET /orders/:id ----------| (status=fulfilled, gameId=X)  |
```

## Setup

### Prerequisites

- Node.js 20+
- pnpm

### Installation

```bash
cd backend
pnpm install
```

### Configuration

Copy the example environment file and fill in the required values:

```bash
cp .env.example .env
```

Required variables:

| Variable | Description |
|----------|-------------|
| `STARKNET_RPC_URL` | Starknet RPC endpoint |
| `STARKNET_TREASURY_ADDRESS` | Treasury wallet address |
| `STARKNET_TREASURY_PRIVATE_KEY` | Treasury wallet private key |

Optional variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `CORS_ORIGIN` | `*` | Allowed origins (comma-separated) |
| `SQLITE_PATH` | `./data/app.db` | SQLite database path |
| `ORDER_QUOTE_TTL_SECONDS` | `300` | Quote expiration (5 min) |
| `ORDER_FEE_BPS` | `300` | Fee in basis points (3%) |
| `WORKER_POLL_INTERVAL_MS` | `2000` | Worker polling interval |
| `FULFILLMENT_WAIT_TIMEOUT_MS` | `180000` | Tx confirmation timeout (3 min) |
| `TICKET_RESERVE_TARGET` | `50` | Target ticket balance to maintain |
| `TICKET_RESERVE_MINIMUM` | `5` | Minimum reserve - orders rejected at or below |
| `RESTOCK_SLIPPAGE` | `0.05` | Max slippage for restock swaps (5%) |

### Treasury Setup

The treasury account must hold TICKET tokens to fulfill orders:

- **TICKET Token**: `0x0452810188C4Cb3AEbD63711a3b445755BC0D6C4f27B923fDd99B1A118858136`
- **Dungeon Contract**: `0x00a67ef20b61a9846e1c82b411175e6ab167ea9f8632bd6c2091823c3629ec42`

### Automatic Ticket Reserve

The backend automatically maintains a reserve of tickets:

1. **Target Reserve (50)**: When ticket balance falls below this, the system automatically restocks
2. **Minimum Reserve (5)**: Orders are rejected if balance is at or below this threshold
3. **Auto-Restock Flow**: Automatically selects the token with highest USD value -> LORDS -> TICKET via AVNU

The restock process:
- Runs every 60 seconds (periodic check) and when fulfilling orders
- Checks balances of ETH, STRK, USDC, USDC_E, and SURVIVOR
- Gets USD prices via AVNU quotes
- Selects the token with highest USD value that can cover the required LORDS
- Swaps to LORDS, then LORDS to TICKET

To fund the treasury for restocking, ensure it has sufficient balance of any supported token (ETH, STRK, USDC, etc.).

When treasury runs out of TICKETs (at or below minimum), orders will fail with `insufficient_ticket_balance`.

## Development

```bash
# Run in development mode (with hot reload)
pnpm dev

# Type check
pnpm type-check

# Build for production
pnpm build

# Run production build
pnpm start
```

## API Endpoints

### Health Check

```
GET /healthz
```

Response:
```json
{ "ok": true }
```

### List Supported Tokens

```
GET /api/v1/tokens
```

Response:
```json
{
  "payTokens": [
    { "symbol": "ETH", "address": "0x049d36...", "decimals": 18 },
    { "symbol": "STRK", "address": "0x04718f...", "decimals": 18 },
    { "symbol": "LORDS", "address": "0x0124ae...", "decimals": 18 },
    { "symbol": "USDC", "address": "0x033068...", "decimals": 6 },
    { "symbol": "USDC_E", "address": "0x053c91...", "decimals": 6 },
    { "symbol": "SURVIVOR", "address": "0x042DD7...", "decimals": 18 }
  ]
}
```

### Treasury Status

Check if the treasury can fulfill orders (has TICKET balance).

```
GET /api/v1/treasury/status
```

Response:
```json
{
  "canFulfillOrders": true,
  "ticketBalance": 42,
  "treasuryAddress": "0x066bE88..."
}
```

The client uses this to show "Service temporarily unavailable" when `canFulfillOrders` is `false`.

### Create Order

```
POST /api/v1/orders
Content-Type: application/json

{
  "dungeonId": "survivor",
  "payToken": "ETH",
  "recipientAddress": "0x...",
  "playerName": "Adventurer"
}
```

Response:
```json
{
  "id": "uuid",
  "status": "awaiting_payment",
  "expiresAt": 1234567890000,
  "requiredAmount": "0.00123",
  "requiredAmountRaw": "1230000000000000",
  "treasuryAddress": "0x066bE88...",
  "payToken": {
    "symbol": "ETH",
    "address": "0x049d36...",
    "decimals": 18
  },
  ...
}
```

### Submit Payment

After sending the token transfer to the treasury, submit the transaction hash:

```
POST /api/v1/orders/:id/payment
Content-Type: application/json

{
  "txHash": "0x..."
}
```

### Get Order Status

Poll this endpoint to check fulfillment status:

```
GET /api/v1/orders/:id
```

Order statuses:
- `awaiting_payment` - Waiting for user to send tokens
- `paid` - Payment verified, queued for fulfillment
- `fulfilling` - buy_game transaction submitted
- `fulfilled` - Complete, `gameId` available
- `failed` - Error occurred (check `lastError`)
- `expired` - Quote expired before payment

## Architecture

```
backend/
├── src/
│   ├── index.ts           # Express server entry
│   ├── config.ts          # Environment config (zod)
│   ├── db.ts              # SQLite schema
│   ├── dotenv.ts          # .env loader
│   ├── worker.ts          # Background fulfillment worker
│   ├── routes/
│   │   ├── orders.ts      # Orders API
│   │   ├── tokens.ts      # Token list API
│   │   └── treasury.ts    # Treasury status API
│   ├── avnu/
│   │   └── client.ts      # AVNU quote fetching
│   └── starknet/
│       ├── address.ts     # Address normalization
│       ├── balance.ts     # ERC20 balance checks
│       ├── erc20.ts       # Transfer event parsing
│       ├── fulfill.ts     # buy_game tx submission
│       ├── payment.ts     # Payment verification
│       ├── receipts.ts    # Receipt status parsing
│       └── tokens.ts      # Token addresses
├── data/                  # SQLite database (gitignored)
├── .env.example
├── package.json
└── tsconfig.json
```

## Pricing

The required payment amount is calculated as:

```
requiredAmount = AVNU_quote(1 TICKET) * (1 + ORDER_FEE_BPS / 10000)
```

With default 3% fee (300 BPS):
- If AVNU quotes 0.001 ETH for 1 TICKET
- User pays 0.00103 ETH

## Error Handling

Common errors in `lastError`:

| Error | Cause |
|-------|-------|
| `insufficient_ticket_balance` | Treasury needs more TICKETs |
| `payment_tx_failed` | User's transfer transaction reverted |
| `transfer_not_found` | No transfer event found in receipt |
| `unexpected_sender` | Transfer came from wrong address |
| `insufficient_amount` | User sent less than required |
| `quote_expired` | Order expired before payment |
