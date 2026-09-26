# Database: Entity Relationship Diagram

```
users 1───* crops_inventory          (farmer_id)
users 1───* bids_negotiations        (buyer_id)
crops_inventory 1───* bids_negotiations (crop_id)
bids_negotiations 1───0..1 orders_logistics (bid_id UNIQUE)
users 1───* orders_logistics         (farmer_id, buyer_id)
crops_inventory 1───* orders_logistics (crop_id)
orders_logistics 1───* order_events  (order_id)
crops_inventory 1───* quality_inspections (crop_id)
users 1───* quality_inspections      (inspector_id)
users 1───* wallet_transactions      (user_id)
orders_logistics 1───* disputes      (order_id)
orders_logistics 1───0..1 reviews     (order_id UNIQUE) → users (buyer_id, farmer_id)
users 1───* notifications · auth_tokens · payment_intents · payout_requests · db_audit_log
```

| Table | Purpose |
|---|---|
| users | Farmers, buyers, admins; CNIC, city, verification, wallet & escrow balances |
| crops_inventory | Produce listings: grade, quantity, price, harvest date, images, location, status |
| mandi_rates | Daily min/max/avg per crop × mandi (unique per day) |
| bids_negotiations | Offers & counter-offers (status state machine) |
| orders_logistics | Orders from accepted bids: payment status, delivery stage, tracking no. |
| quality_inspections | Inspector grade, moisture %, soil pH, notes, report file |
| order_events | Tracking history for the logistics stepper |
| wallet_transactions | Escrow ledger: deposit, lock, release, payout, refund, fee |
| disputes | Dispute resolution log |
