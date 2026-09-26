# MarketLink Agri-Hub Pakistan: Business Logic Workflows

## Role-Based Marketplace Flow

1. Authenticate with password or Google OAuth; the signed session determines whether the user enters Admin, Farmer/Vendor, Buyer/Customer or Inspector modules. Every page and API repeats the role/ownership check.
2. Farmer: manage profile and graded crop listings → review and counter bids → fulfil accepted orders → receive escrow payout → respond once to each verified buyer review.
3. Buyer: search the marketplace and inspect crop/quality details → place bids and negotiate → fund escrow after acceptance → track shipment → confirm delivery and submit a verified rating.
4. Inspector: certify crop quality and record moisture, soil pH, grade and report before dispatch. Admin: approve users, monitor bids and transactions, manage mandi rates, and resolve disputes.
5. Data processing: accepting a bid creates an order and decrements inventory transactionally; escrow lock precedes inspection, dispatch and tracking; verified delivery releases payment and enables a review.
6. Output: Admin and Farmer dashboards show live metrics and charts; their role-scoped CSV summary downloads reflect current sales, orders and trading regions/crops.

## Bidding & Negotiation

1. Buyer submits bid (price, qty, target date). Guards: listing active, qty ≤ stock, price ≥ 50% of ask, one open bid per buyer per listing.
2. Farmer reviews in Negotiation Hub drawer → Accept, Reject, or Counter (counter must exceed bid price).
3. On counter: buyer may accept_counter, reject_counter, or revise (bid returns to pending with new price) — unlimited rounds.
4. On acceptance (SELECT … FOR UPDATE on bid + crop): stock decremented, listing → sold_out at 0, other open bids exceeding remaining stock auto-rejected, order created with unique tracking number in 'awaiting_escrow'.

## Escrow & Order Status Progression

1. Buyer locks full order value: wallet_balance −= total, escrow_balance += total, ledger entry 'escrow_lock'. Nothing progresses before this.
2. Quality inspector records pre-dispatch inspection → stage 'quality_checked' (creates a quality_inspections row).
3. Farmer marks 'dispatched' then 'in_transit', posting checkpoint locations (order_events audit trail).
4. Buyer confirms delivery → 'delivered'; escrow released atomically: farmer credited total − 1.5% platform fee, ledger entries payout + platform_fee + escrow_release.
5. Either party can raise a dispute while escrow is locked → progression frozen; admin resolves by release (farmer paid) or refund (buyer credited).

## Mandi Rate Sync

1. Rates are stored per (crop, market, date) with a UNIQUE constraint → all writes are idempotent upserts.
2. Admin manual entry: validates min ≤ avg ≤ max (avg defaults to midpoint), source='manual'.
3. Mock feed sync: reads the latest rate for every crop × mandi, applies a bounded ±3% random walk, upserts today's row with source='feed' in one transaction; missing pairs are seeded from catalogue base prices.
4. Insights: day-on-day change via ROW_NUMBER() window; platform comparison joins latest mandi avg vs active listing ask vs 90-day realised deal price; farmer listing form suggests grade-adjusted price (A ×1.06, B ×1.00, C ×0.90).

## Verification & Quality

1. New farmers register unverified; their listings enter 'pending_inspection' and are hidden from the marketplace.
2. Admin verifies CNIC/farm → farmer verified and held listings activated.
3. Inspection passed → listing grade overwritten with assigned grade and activated; failed → listing archived and open bids rejected; pending → held.

## State machines

```
BID
pending ──farmer:accept──────────▶ accepted ──▶ order (awaiting_escrow)
pending ──farmer:counter─────────▶ countered
countered ──buyer:accept_counter─▶ accepted ──▶ order @ counter price
countered ──buyer:reject_counter─▶ rejected
countered ──buyer:revise─────────▶ pending (new price)
pending ──farmer:reject──────────▶ rejected
pending|countered ──buyer:withdraw▶ withdrawn

ORDER / LOGISTICS
confirmed ─(buyer locks escrow)─▶ quality_checked [inspector]
          ─▶ dispatched [farmer] ─▶ in_transit [farmer]
          ─▶ delivered [buyer] ⇒ escrow released (farmer gets total − 1.5% fee)

PAYMENT
awaiting_escrow ─▶ escrow_locked ─▶ released
escrow_locked ─(dispute)─▶ disputed ─(admin)─▶ released | refunded
```
