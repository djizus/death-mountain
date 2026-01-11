Onboarding Plan (Fiat + Crypto, Treasury-Driven)
================================================

Goals
-----
- One-click entry for fiat users.
- No on-chain steps for the player (no approve/buy_game on user side).
- Reuse existing contracts; no contract changes.
- Keep UX consistent for fiat and crypto paths.

Key Decision: Auth vs Capture
-----------------------------
Auth (authorize then mint immediately)
- Best UX, instant entry.
- You front value and accept chargeback risk.
- Needs strong fraud controls (3DS, velocity limits, device fingerprinting).

Capture (mint after capture/settlement)
- Safer, less chargeback exposure.
- Slower onboarding; user waits longer before game starts.

Recommendation
- Default to auth for low-risk / returning users.
- Use capture for new or high-risk sessions.
- Keep a policy switch so you can tighten/loosen risk quickly.

Proposed Unified Flow (Fiat + Crypto -> Treasury -> Mint)
--------------------------------------------------------
Important: do NOT mint a ticket to the user. Treasury should call buy_game
and set to = user_address. This avoids any user gas for approve/buy_game.

1) Login
   - User logs into Controller to get Starknet address.

2) Payment
   - Fiat: PSP checkout (Alchemy Pay / Stripe / Checkout).
   - Crypto: send funds to treasury (or swap flow).
   - Create an order with order_id + user_address + price.

3) Fulfillment
   - Treasury wallet calls buy_game (ticket burn + mint game to user).
   - Parse gameId from tx receipt and store it on the order.

4) Client Auto-Start
   - Client polls order status or uses websocket.
   - When gameId is ready, redirect to /play?id=GAME_ID (or mode=entering).

Treasury Inventory and Refill
-----------------------------
- Keep a buffer of dungeon tickets in treasury (avoid swap latency).
- Refill when ticket balance < threshold.
- Use a hot wallet for minting + gas, cold wallet for reserves.

Backend Components (MVP)
------------------------
1) Orders API
   - POST /payments/session -> returns order_id + PSP checkout URL
   - GET /orders/:id -> status + gameId + tx_hash

2) PSP Webhook
   - Verify signature
   - Update order status to paid (idempotent)
   - Queue fulfill(order_id)

3) Fulfillment Worker
   - Check ticket inventory
   - Call buy_game with to = user_address
   - Store gameId + tx_hash + status = fulfilled
   - Retry on transient failures

4) Monitoring
   - Track tx failures, time-to-mint, fraud rates
   - Alert if inventory low or fulfillment delays rise

Order State Model
-----------------
- created -> payment_pending -> paid -> fulfilling -> fulfilled
- failed (payment failed)
- canceled (user canceled or PSP rejected)
- manual_review (high risk / fraud signals)

Fraud and Risk Controls
-----------------------
- 3DS for cards where possible.
- Velocity limits (per card, per device, per IP).
- Low initial purchase caps.
- Device fingerprint + risk scoring.
- Holdback rules for high-risk orders (capture-only).

Crypto Migration Option (Unified Path)
--------------------------------------
Option A (keep current on-chain swap path)
- Faster to ship, no backend work.
- UX still more complex than fiat.

Option B (crypto -> treasury -> mint)
- Unified flow, consistent UX.
- Requires a crypto deposit address + confirmation logic.
- You still pay gas for buy_game.

Recommendation
- Ship fiat -> treasury -> mint first.
- Keep current crypto flow in parallel.
- Later migrate crypto to the unified treasury flow if desired.

Open Questions
--------------
- PSP choice and supported payout rails.
- Risk policy: auth vs capture and thresholds.
- How you want to handle refunds/chargebacks (off-chain penalties).
