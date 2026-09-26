# MarketLink Agri-Hub Pakistan: REST API Endpoints

Authentication: httpOnly `ml_session` cookie set by `POST /api/auth/login`.
Responses: `{ "success": true, "data": ... }` or `{ "success": false, "error": "message" }`.

Errors: 400 bad JSON · 401 unauthenticated · 402 insufficient balance · 403 wrong role · 404 not found · 409 invalid state · 422 validation.

## Authentication

### `POST /api/auth/register`
**Roles:** public

Register a farmer or buyer. Sets httpOnly session cookie.

**Request**
```json
{ "fullName": "Ali Raza", "email": "ali@farm.pk", "password": "********", "phone": "+92 300 1234567", "role": "farmer", "city": "Multan", "cnicId": "36302-1234567-1", "businessName": "Raza Farms" }
```

**Response**
```json
{ "success": true, "data": { "id": 11, "role": "farmer", "redirectTo": "/farmer" } }
```

### `POST /api/auth/login`
**Roles:** public

Email + password login (scrypt hash, HMAC-signed cookie).

**Request**
```json
{ "email": "farmer@marketlink.pk", "password": "password123" }
```

**Response**
```json
{ "success": true, "data": { "id": 2, "fullName": "Muhammad Aslam", "role": "farmer", "redirectTo": "/farmer" } }
```

### `POST /api/auth/logout`
**Roles:** any

Clears the session cookie.

### `GET /api/auth/me`
**Roles:** any

Current user profile (no password hash).

## Crop Inventory

### `GET /api/crops?category=&grade=&minPrice=&maxPrice=&q=&originCity=&radiusKm=&sort=&mine=1`
**Roles:** any

Marketplace catalogue with haversine radius filtering, open-bid counts, highest bid and inspection grade.

**Response**
```json
{ "success": true, "data": [{ "cropId": 1, "cropName": "Wheat", "category": "grains", "qualityGrade": "A", "totalQuantityKg": 24000, "basePricePerKg": 96, "farmLocation": "Multan", "distanceKm": 312, "openBids": 2, "highestBid": 94, "farmerVerified": true }] }
```

### `POST /api/crops`
**Roles:** farmer

Create listing. Unverified farmers' listings enter pending_inspection.

**Request**
```json
{ "cropName": "Wheat", "category": "grains", "qualityGrade": "A", "totalQuantityKg": 5000, "basePricePerKg": 96.5, "harvestDate": "2025-04-20", "farmLocation": "Multan", "description": "Galaxy-2013", "imagesJson": ["data:image/jpeg;base64,..."] }
```

**Response**
```json
{ "success": true, "data": { "cropId": 14, "status": "active", ... } }
```

### `GET /api/crops/:id`
**Roles:** any

Listing detail with inspection history.

### `PATCH /api/crops/:id`
**Roles:** farmer (owner), admin

Update price, quantity, photos, status (active|archived).

**Request**
```json
{ "basePricePerKg": 98, "totalQuantityKg": 20000 }
```

### `DELETE /api/crops/:id`
**Roles:** farmer (owner), admin

Hard delete, or soft-archive if orders reference it (open bids auto-rejected).

**Response**
```json
{ "success": true, "data": { "archived": true } }
```

## Bidding & Negotiation

### `GET /api/bids?status=&cropId=`
**Roles:** farmer | buyer | admin

Bids scoped to role (farmer: bids on own crops; buyer: own bids).

### `POST /api/bids`
**Roles:** buyer

Submit bulk offer / RFQ. Validates stock, lowball guard (≥50% of ask), one open bid per crop per buyer.

**Request**
```json
{ "cropId": 1, "bidPricePerKg": 92, "bidQuantityKg": 10000, "targetDeliveryDate": "2025-06-01", "message": "Pickup from farm" }
```

**Response**
```json
{ "success": true, "data": { "bidId": 41, "status": "pending", ... } }
```

### `PATCH /api/bids/:id`
**Roles:** farmer | buyer

State machine action: accept | reject | counter (farmer) · accept_counter | reject_counter | revise | withdraw (buyer). Accepting creates an order atomically.

**Request**
```json
{ "action": "counter", "counterPrice": 98, "note": "Includes bagging" }
```

**Response**
```json
{ "success": true, "data": { "bid": { "status": "accepted" }, "order": { "orderId": 37, "trackingNumber": "ML-2025-1038-X7K", "paymentStatus": "awaiting_escrow" } } }
```

## Orders, Logistics & Escrow

### `GET /api/orders?active=1`
**Roles:** any

Orders with joined crop/party info, tracking events and disputes.

### `GET /api/orders/:id`
**Roles:** party | admin

Single order detail.

### `PATCH /api/orders/:id`
**Roles:** role-dependent

lock_escrow (buyer) · advance (admin→quality_checked, farmer→dispatched/in_transit, buyer→delivered + auto escrow release) · update_location (farmer).

**Request**
```json
{ "action": "advance", "location": "Khanewal Bypass, N-5", "note": "Truck LES-4521" }
```

**Response**
```json
{ "success": true, "data": { "orderId": 1, "deliveryStage": "in_transit", "paymentStatus": "escrow_locked" } }
```

### `POST /api/orders/:id/dispute`
**Roles:** buyer | farmer

Freeze escrow and open a dispute.

**Request**
```json
{ "reason": "Moisture 17% vs agreed 14%" }
```

### `GET /api/wallet`
**Roles:** farmer | buyer

Balances + ledger.

**Response**
```json
{ "success": true, "data": { "walletBalance": 4500000, "escrowBalance": 1044000, "pendingInEscrow": 1044000, "transactions": [...] } }
```

### `POST /api/wallet`
**Roles:** buyer

Simulated bank top-up.

**Request**
```json
{ "amount": 500000 }
```

## Mandi Rates

### `GET /api/mandi-rates?view=latest&crop=&market=`
**Roles:** any

Latest rate per crop × mandi with day-on-day % change (window function).

### `GET /api/mandi-rates?view=trend&crop=Wheat&days=14`
**Roles:** any

Pivoted daily series for charting.

**Response**
```json
{ "success": true, "data": { "cropName": "Wheat", "markets": ["Lahore", ...], "series": [{ "date": "2025-05-01", "Lahore": 98.2, "Multan": 91.4 }] } }
```

### `GET /api/mandi-rates?view=compare`
**Roles:** any

Mandi avg vs platform ask vs realised platform deal price per crop.

### `POST /api/mandi-rates`
**Roles:** admin

Manual upsert (unique crop+market+date).

**Request**
```json
{ "cropName": "Wheat", "marketLocation": "Lahore", "minPricePerKg": 92, "maxPricePerKg": 101, "dateUpdated": "2025-05-14" }
```

### `POST /api/mandi-rates/sync`
**Roles:** admin

Mock government feed sync (bounded ±3% random walk, source=feed).

**Response**
```json
{ "success": true, "data": { "updated": 60, "date": "2025-05-14" } }
```

## Payments, Payouts & Reviews

### `GET /api/payments/checkout`
**Roles:** buyer | farmer

Enabled gateways (stripe / jazzcash / easypaisa / sandbox) and their mode.

### `POST /api/payments/checkout`
**Roles:** buyer

Create a payment intent; returns a redirect URL (Stripe Checkout / sandbox) or an auto-submit form (JazzCash / Easypaisa). The wallet is credited only by a verified callback.

**Request**
```json
{ "provider": "stripe", "amount": 500000 }
```

**Response**
```json
{ "success": true, "data": { "reference": "MLT1790…", "redirectUrl": "https://checkout.stripe.com/…" } }
```

### `POST /api/payments/webhook/stripe`
**Roles:** Stripe (signed)

Stripe webhook; verifies Stripe-Signature (HMAC-SHA256, 5-min tolerance) and settles checkout.session.* events idempotently.

### `POST /api/payments/callback/jazzcash`
**Roles:** JazzCash (signed)

JazzCash return URL; verifies pp_SecureHash with the integrity salt, pp_ResponseCode 000 = success.

### `GET /api/payments/callback/easypaisa`
**Roles:** Easypaisa

Easypaisa postBack; result is confirmed server-to-server via Inquire Transaction before crediting.

### `GET /api/payments/:reference`
**Roles:** owner

Poll payment status after returning from the gateway.

### `POST /api/payouts`
**Roles:** farmer

Withdraw wallet balance to bank / JazzCash / Easypaisa.

**Request**
```json
{ "amount": 50000, "method": "jazzcash", "accountTitle": "Bashir Soomro", "accountNumber": "03451234567" }
```

### `PATCH /api/payouts/:id`
**Roles:** admin

Mark payout paid, or reject (funds returned).

**Request**
```json
{ "status": "paid" }
```

### `POST /api/reviews`
**Roles:** buyer

Rate the seller of a delivered & paid order (1 per order); recalculates the seller trust score.

**Request**
```json
{ "orderId": 33, "rating": 5, "comment": "Fresh onions, perfect weight" }
```

**Response**
```json
{ "success": true, "data": { "trust": { "trustScore": 4.41, "ratingAvg": 4.6, "ratingCount": 5 } } }
```

### `GET /api/reviews?farmerId=2 · ?pending=1`
**Roles:** public · buyer

Seller reviews (including farmer replies), or the buyer's delivered orders awaiting review.

### `POST /api/reviews/:id/reply`
**Roles:** farmer (seller on that order)

Respond once to a verified buyer review. Buyer receives an in-app notification; response appears on crop details.

**Request**
```json
{ "reply": "Thank you for your feedback. We look forward to supplying you again." }
```

### `GET /api/reports/summary`
**Roles:** farmer | admin

Download a live, role-scoped CSV with KPIs, six monthly periods, and crop or regional breakdowns. Buyers and inspectors cannot access it.

## Tracking, Notifications & Auth

### `GET /api/tracking/:trackingNumber`
**Roles:** public

Route, live/estimated GPS position, progress, ETA and milestones. Party names & notes only for order parties/staff. Fires the 'arriving soon' milestone at 85%.

### `POST /api/orders/:id/gps`
**Roles:** farmer | admin

Driver GPS ping while dispatched / in transit.

**Request**
```json
{ "lat": 25.9, "lng": 68.1, "label": "M-9 near Nooriabad" }
```

### `GET /api/notifications`
**Roles:** any

Latest 30 notifications + unread count.

### `PATCH /api/notifications`
**Roles:** any

Mark given ids (or all) as read.

**Request**
```json
{ "ids": [12, 13] }
```

### `POST /api/auth/verify-email`
**Roles:** public

Verify the 6-digit signup code (signs in), or { resend: true }.

**Request**
```json
{ "email": "ali@farm.pk", "code": "816958" }
```

### `POST /api/auth/forgot-password`
**Roles:** public

Generates a single-use reset token (15-minute expiry, stored as SHA-256) and emails a /reset-password?token=… link. Same response whether or not the account exists.

**Request**
```json
{ "email": "buyer@marketlink.pk" }
```

**Response**
```json
{ "success": true, "data": { "sent": true, "message": "If an account exists…" } }
```

### `GET /api/auth/reset-password?token=…`
**Roles:** public

Checks a reset link before the form is shown (masked email + expiry).

### `POST /api/auth/reset-password`
**Roles:** public

Validates the token, stores the new password as a bcrypt hash and deletes the token.

**Request**
```json
{ "token": "…", "newPassword": "NewPass#2026" }
```

### `GET /api/auth/google?role=buyer|farmer`
**Roles:** public

Starts Google OAuth 2.0 (authorization code + PKCE, signed state cookie) → Google consent screen.

### `GET /api/auth/google/callback`
**Roles:** Google

Verifies state, exchanges the code, requires a verified Google email; signs in existing users (linking Google) or creates a new buyer/farmer with name, email and profile picture.

### `PATCH /api/account/profile`
**Roles:** any

Update name, phone, city, business, CNIC, address (used to complete Google sign-ups).

**Request**
```json
{ "fullName": "Ali Raza", "phone": "0300 1234567", "city": "Multan" }
```

## Database Explorer (admin)

### `GET /api/db/schema`
**Roles:** admin

Tables, columns, PK/FK, indexes, row counts and recent audit log.

### `POST /api/db/query`
**Roles:** admin

Single SQL statement. read = READ ONLY transaction + 8s timeout + 500-row cap; write requires confirm: true. Dangerous statements blocked; every query audited in db_audit_log.

**Request**
```json
{ "sql": "SELECT full_name, trust_score FROM users WHERE role = 'farmer'", "mode": "read" }
```

**Response**
```json
{ "success": true, "data": { "columns": ["full_name","trust_score"], "rows": [["Ghulam Rasool", 4.53]], "rowCount": 1, "durationMs": 4 } }
```

## AI Shopping Assistant

### `POST /api/assistant`
**Roles:** public (visitors + buyers)

LLM assistant (OpenAI or Gemini when OPENAI_API_KEY / GEMINI_API_KEY is set; rule engine otherwise) grounded in live DB results: top-rated dealers (rating from deliveries, verification, inspections, disputes), high-quality listings by crop/category, cheapest/nearest produce, mandi rates and FAQ (escrow, bidding, tracking). Understands English + Roman Urdu. Rate-limited to 30 msgs/min.

**Request**
```json
{ "message": "Where can I find top-rated dealers?" }
```

**Response**
```json
{ "success": true, "data": { "reply": "Top-rated sellers…", "cards": [{ "kind": "dealer", "name": "Muhammad Aslam", "business": "Aslam Agri Farms", "city": "Multan", "rating": 4.6, "deliveries": 8, "href": "/buyer?farmerId=2" }], "suggestions": ["High-quality vegetables", "Cheapest wheat"] } }
```

## Admin & Quality

### `GET /api/admin/users?role=farmer`
**Roles:** admin

Users with listing/order counts.

### `PATCH /api/admin/users/:id`
**Roles:** admin

Verify / revoke. Verifying a farmer activates held listings.

**Request**
```json
{ "isVerified": true }
```

**Response**
```json
{ "success": true, "data": { "id": 4, "isVerified": true, "listingsActivated": 1 } }
```

### `GET /api/inspections`
**Roles:** admin

Inspection report log.

### `POST /api/inspections`
**Roles:** admin

Upload soil/crop inspection. passed → grade updated & listing active; failed → archived & bids rejected.

**Request**
```json
{ "cropId": 7, "gradeAssigned": "B", "moistureLevelPercentage": 68, "soilPh": 7.8, "inspectionNotes": "Brix 19.2", "status": "passed", "reportAttachment": "data:application/pdf;base64,..." }
```

### `GET /api/inspections/:id/report`
**Roles:** admin

Download attached report file.

### `GET /api/admin/disputes`
**Roles:** admin

Dispute resolution log.

### `PATCH /api/admin/disputes/:id`
**Roles:** admin

investigating | release (pay farmer) | refund (return to buyer).

**Request**
```json
{ "outcome": "refund", "resolution": "Lab retest confirmed 17% moisture" }
```

### `GET /api/analytics`
**Roles:** any

Role-aware KPIs: farmer earnings, buyer spend, or platform-wide volume/regions/stages.

### `GET /api/health`
**Roles:** public

DB connectivity healthcheck.

## Account & admin (user management)

### `PATCH /api/account/password`
**Roles:** any signed-in user

```json
{ "currentPassword": "password123", "newPassword": "MyNewPass#2025" }
```

### `POST /api/admin/users`
**Roles:** admin: create admin / inspector / farmer / buyer accounts

```json
{ "fullName": "Inspector Kamran", "email": "kamran@marketlink.pk", "password": "Inspect@2025", "phone": "+92 300 5556677", "role": "admin", "city": "Multan" }
```

### `PATCH /api/admin/users/:id`
**Roles:** admin: `{ "isVerified": true }` · `{ "newPassword": "..." }` · `{ "role": "admin" }`
