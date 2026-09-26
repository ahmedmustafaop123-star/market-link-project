export const MYSQL_DDL = `-- MarketLink Agri-Hub · MySQL 8.0 compatible DDL (InnoDB, utf8mb4)
-- Production runtime uses PostgreSQL (see PostgreSQL tab); this script is the portable equivalent.

CREATE TABLE users (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  full_name        VARCHAR(120)  NOT NULL,
  email            VARCHAR(160)  NOT NULL,
  password_hash    VARCHAR(255)  NOT NULL,
  phone            VARCHAR(30)   NOT NULL,
  role             ENUM('farmer','buyer','admin','inspector') NOT NULL,
  cnic_id          VARCHAR(20)   NULL,
  business_name    VARCHAR(160)  NULL,
  city             VARCHAR(80)   NOT NULL,
  address          TEXT          NULL,
  is_verified      BOOLEAN       NOT NULL DEFAULT FALSE,
  email_verified   BOOLEAN       NOT NULL DEFAULT FALSE,
  title            VARCHAR(120)  NULL,           -- e.g. 'Super Admin & Systems Controller'
  user_code        VARCHAR(40)   NULL,           -- e.g. 'admin_01'
  avatar_url       TEXT          NULL,
  google_id        VARCHAR(64)   NULL,           -- Google OAuth subject
  auth_provider    VARCHAR(20)   NOT NULL DEFAULT 'password',
  trust_score      DECIMAL(3,2)  NOT NULL DEFAULT 0,
  rating_avg       DECIMAL(3,2)  NOT NULL DEFAULT 0,
  rating_count     INT           NOT NULL DEFAULT 0,
  wallet_balance   DECIMAL(14,2) NOT NULL DEFAULT 0,
  escrow_balance   DECIMAL(14,2) NOT NULL DEFAULT 0,
  created_at       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY users_email_uq (email),
  UNIQUE KEY users_google_id_uq (google_id),
  UNIQUE KEY users_user_code_uq (user_code),
  KEY users_role_idx (role),
  KEY users_city_idx (city)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE crops_inventory (
  crop_id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id          INT UNSIGNED  NOT NULL,
  crop_name          VARCHAR(80)   NOT NULL,
  category           ENUM('grains','vegetables','fruits','cash_crops') NOT NULL,
  quality_grade      ENUM('A','B','C') NOT NULL,
  total_quantity_kg  DECIMAL(14,2) NOT NULL CHECK (total_quantity_kg >= 0),
  base_price_per_kg  DECIMAL(14,2) NOT NULL CHECK (base_price_per_kg > 0),
  harvest_date       DATE          NOT NULL,
  images_json        JSON          NOT NULL,
  description        TEXT          NULL,
  farm_location      VARCHAR(80)   NOT NULL,
  latitude           DOUBLE        NULL,
  longitude          DOUBLE        NULL,
  status             ENUM('active','pending_inspection','sold_out','archived') NOT NULL DEFAULT 'active',
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY crops_farmer_idx (farmer_id),
  KEY crops_category_idx (category),
  KEY crops_status_idx (status),
  KEY crops_name_idx (crop_name),
  CONSTRAINT fk_crops_farmer FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE mandi_rates (
  rate_id           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_name         VARCHAR(80)   NOT NULL,
  market_location   VARCHAR(80)   NOT NULL,
  min_price_per_kg  DECIMAL(14,2) NOT NULL,
  max_price_per_kg  DECIMAL(14,2) NOT NULL,
  avg_price_per_kg  DECIMAL(14,2) NOT NULL,
  source            VARCHAR(20)   NOT NULL DEFAULT 'manual',
  date_updated      DATE          NOT NULL,
  UNIQUE KEY mandi_crop_market_date_uq (crop_name, market_location, date_updated),
  KEY mandi_date_idx (date_updated),
  CHECK (min_price_per_kg <= avg_price_per_kg AND avg_price_per_kg <= max_price_per_kg)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE bids_negotiations (
  bid_id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id               INT UNSIGNED  NOT NULL,
  buyer_id              INT UNSIGNED  NOT NULL,
  bid_price_per_kg      DECIMAL(14,2) NOT NULL,
  bid_quantity_kg       DECIMAL(14,2) NOT NULL,
  target_delivery_date  DATE          NULL,
  message               TEXT          NULL,
  status                ENUM('pending','accepted','rejected','countered','withdrawn') NOT NULL DEFAULT 'pending',
  counter_price         DECIMAL(14,2) NULL,
  counter_note          TEXT          NULL,
  created_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY bids_crop_idx (crop_id),
  KEY bids_buyer_idx (buyer_id),
  KEY bids_status_idx (status),
  CONSTRAINT fk_bids_crop  FOREIGN KEY (crop_id)  REFERENCES crops_inventory(crop_id) ON DELETE CASCADE,
  CONSTRAINT fk_bids_buyer FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders_logistics (
  order_id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  bid_id                 INT UNSIGNED  NOT NULL,
  crop_id                INT UNSIGNED  NOT NULL,
  farmer_id              INT UNSIGNED  NOT NULL,
  buyer_id               INT UNSIGNED  NOT NULL,
  quantity_kg            DECIMAL(14,2) NOT NULL,
  price_per_kg           DECIMAL(14,2) NOT NULL,
  total_amount           DECIMAL(14,2) NOT NULL,
  payment_status         ENUM('awaiting_escrow','escrow_locked','released','refunded','disputed') NOT NULL DEFAULT 'awaiting_escrow',
  delivery_stage         ENUM('confirmed','quality_checked','dispatched','in_transit','delivered') NOT NULL DEFAULT 'confirmed',
  transit_location       VARCHAR(120)  NULL,
  current_lat            DOUBLE        NULL,
  current_lng            DOUBLE        NULL,
  tracking_number        VARCHAR(40)   NOT NULL,
  expected_delivery_date DATE          NULL,
  created_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY orders_bid_uq (bid_id),
  UNIQUE KEY orders_tracking_uq (tracking_number),
  KEY orders_farmer_idx (farmer_id),
  KEY orders_buyer_idx (buyer_id),
  KEY orders_stage_idx (delivery_stage),
  CONSTRAINT fk_orders_bid    FOREIGN KEY (bid_id)    REFERENCES bids_negotiations(bid_id),
  CONSTRAINT fk_orders_crop   FOREIGN KEY (crop_id)   REFERENCES crops_inventory(crop_id),
  CONSTRAINT fk_orders_farmer FOREIGN KEY (farmer_id) REFERENCES users(id),
  CONSTRAINT fk_orders_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE quality_inspections (
  inspection_id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  crop_id                    INT UNSIGNED NOT NULL,
  inspector_id               INT UNSIGNED NOT NULL,
  grade_assigned             ENUM('A','B','C') NOT NULL,
  moisture_level_percentage  DECIMAL(5,2) NOT NULL,
  soil_ph                    DECIMAL(4,2) NULL,
  inspection_notes           TEXT         NULL,
  report_attachment          LONGTEXT     NULL,
  report_file_name           VARCHAR(200) NULL,
  certificate_no             VARCHAR(40)  NULL,
  status                     ENUM('pending','passed','failed') NOT NULL DEFAULT 'pending',
  verified_at                TIMESTAMP    NULL,
  KEY inspections_crop_idx (crop_id),
  KEY inspections_status_idx (status),
  CONSTRAINT fk_insp_crop      FOREIGN KEY (crop_id)      REFERENCES crops_inventory(crop_id) ON DELETE CASCADE,
  CONSTRAINT fk_insp_inspector FOREIGN KEY (inspector_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Supporting tables: order_events (tracking audit), wallet_transactions (escrow ledger), disputes
CREATE TABLE order_events (
  event_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  stage      VARCHAR(40)  NOT NULL,
  location   VARCHAR(120) NULL,
  lat        DOUBLE       NULL,
  lng        DOUBLE       NULL,
  note       TEXT         NULL,
  actor_id   INT UNSIGNED NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY order_events_order_idx (order_id),
  CONSTRAINT fk_events_order FOREIGN KEY (order_id) REFERENCES orders_logistics(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_events_actor FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE wallet_transactions (
  txn_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED  NOT NULL,
  order_id    INT UNSIGNED  NULL,
  type        ENUM('deposit','escrow_lock','escrow_release','payout','refund','platform_fee','withdrawal') NOT NULL,
  amount      DECIMAL(14,2) NOT NULL,
  description TEXT          NULL,
  created_at  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY wallet_user_idx (user_id),
  CONSTRAINT fk_wallet_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_wallet_order FOREIGN KEY (order_id) REFERENCES orders_logistics(order_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE disputes (
  dispute_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id    INT UNSIGNED NOT NULL,
  raised_by   INT UNSIGNED NOT NULL,
  reason      TEXT         NOT NULL,
  status      ENUM('open','investigating','resolved_release','resolved_refund') NOT NULL DEFAULT 'open',
  resolution  TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at TIMESTAMP    NULL,
  KEY disputes_order_idx (order_id),
  KEY disputes_status_idx (status),
  CONSTRAINT fk_disputes_order FOREIGN KEY (order_id) REFERENCES orders_logistics(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_disputes_user  FOREIGN KEY (raised_by) REFERENCES users(id)
) ENGINE=InnoDB;

CREATE TABLE reviews (
  review_id  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id   INT UNSIGNED NOT NULL,
  buyer_id   INT UNSIGNED NOT NULL,
  farmer_id  INT UNSIGNED NOT NULL,
  rating       TINYINT      NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment      TEXT         NULL,
  farmer_reply TEXT         NULL,
  replied_at   TIMESTAMP    NULL,
  created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY reviews_order_uq (order_id),
  KEY reviews_farmer_idx (farmer_id),
  CONSTRAINT fk_reviews_order  FOREIGN KEY (order_id)  REFERENCES orders_logistics(order_id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_buyer  FOREIGN KEY (buyer_id)  REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_reviews_farmer FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE notifications (
  notification_id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  type       VARCHAR(40)  NOT NULL,
  title      VARCHAR(200) NOT NULL,
  body       TEXT         NULL,
  link       VARCHAR(300) NULL,
  channels   VARCHAR(60)  NOT NULL DEFAULT 'in_app',
  is_read    BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY notifications_user_idx (user_id, is_read),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE auth_tokens (
  token_id   INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED NOT NULL,
  purpose    VARCHAR(20)  NOT NULL,           -- verify_email | reset_link (15-min password reset token)
  code_hash  VARCHAR(128) NOT NULL,           -- SHA-256 of the 6-digit code + secret
  attempts   INT          NOT NULL DEFAULT 0,
  expires_at TIMESTAMP    NOT NULL,
  used_at    TIMESTAMP    NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY auth_tokens_user_idx (user_id, purpose),
  CONSTRAINT fk_auth_tokens_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payment_intents (
  intent_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  reference    VARCHAR(60)   NOT NULL,
  user_id      INT UNSIGNED  NOT NULL,
  provider     VARCHAR(20)   NOT NULL,        -- stripe | jazzcash | easypaisa | sandbox
  amount       DECIMAL(14,2) NOT NULL,
  status       VARCHAR(20)   NOT NULL DEFAULT 'pending',
  provider_ref VARCHAR(200)  NULL,
  raw_callback TEXT          NULL,
  created_at   TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP     NULL,
  UNIQUE KEY payment_intents_ref_uq (reference),
  KEY payment_intents_user_idx (user_id),
  CONSTRAINT fk_payment_intents_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE payout_requests (
  payout_id      INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  farmer_id      INT UNSIGNED  NOT NULL,
  amount         DECIMAL(14,2) NOT NULL,
  method         VARCHAR(20)   NOT NULL,      -- bank | jazzcash | easypaisa
  account_title  VARCHAR(120)  NOT NULL,
  account_number VARCHAR(60)   NOT NULL,
  status         VARCHAR(20)   NOT NULL DEFAULT 'pending',
  admin_note     TEXT          NULL,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at   TIMESTAMP     NULL,
  KEY payout_requests_farmer_idx (farmer_id),
  KEY payout_requests_status_idx (status),
  CONSTRAINT fk_payout_farmer FOREIGN KEY (farmer_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE db_audit_log (
  audit_id    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT UNSIGNED NULL,
  mode        VARCHAR(10)  NOT NULL,
  query       TEXT         NOT NULL,
  row_count   INT          NULL,
  duration_ms INT          NULL,
  error       TEXT         NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
`;

export const ERD = `users 1───* crops_inventory          (farmer_id)
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
users 1───* notifications · auth_tokens · payment_intents · payout_requests · db_audit_log`;

export type Endpoint = { method: "GET" | "POST" | "PATCH" | "DELETE"; path: string; roles: string; desc: string; request?: string; response?: string };

export const API_GROUPS: { name: string; endpoints: Endpoint[] }[] = [
  {
    name: "Authentication",
    endpoints: [
      { method: "POST", path: "/api/auth/register", roles: "public", desc: "Register a farmer or buyer. Sets httpOnly session cookie.", request: `{ "fullName": "Ali Raza", "email": "ali@farm.pk", "password": "********", "phone": "+92 300 1234567", "role": "farmer", "city": "Multan", "cnicId": "36302-1234567-1", "businessName": "Raza Farms" }`, response: `{ "success": true, "data": { "id": 11, "role": "farmer", "redirectTo": "/farmer" } }` },
      { method: "POST", path: "/api/auth/login", roles: "public", desc: "Email + password login (scrypt hash, HMAC-signed cookie).", request: `{ "email": "farmer@marketlink.pk", "password": "password123" }`, response: `{ "success": true, "data": { "id": 2, "fullName": "Muhammad Aslam", "role": "farmer", "redirectTo": "/farmer" } }` },
      { method: "POST", path: "/api/auth/logout", roles: "any", desc: "Clears the session cookie." },
      { method: "GET", path: "/api/auth/me", roles: "any", desc: "Current user profile (no password hash)." },
    ],
  },
  {
    name: "Crop Inventory",
    endpoints: [
      { method: "GET", path: "/api/crops?category=&grade=&minPrice=&maxPrice=&q=&originCity=&radiusKm=&sort=&mine=1", roles: "any", desc: "Marketplace catalogue with haversine radius filtering, open-bid counts, highest bid and inspection grade." , response: `{ "success": true, "data": [{ "cropId": 1, "cropName": "Wheat", "category": "grains", "qualityGrade": "A", "totalQuantityKg": 24000, "basePricePerKg": 96, "farmLocation": "Multan", "distanceKm": 312, "openBids": 2, "highestBid": 94, "farmerVerified": true }] }` },
      { method: "POST", path: "/api/crops", roles: "farmer", desc: "Create listing. Unverified farmers' listings enter pending_inspection.", request: `{ "cropName": "Wheat", "category": "grains", "qualityGrade": "A", "totalQuantityKg": 5000, "basePricePerKg": 96.5, "harvestDate": "2025-04-20", "farmLocation": "Multan", "description": "Galaxy-2013", "imagesJson": ["data:image/jpeg;base64,..."] }`, response: `{ "success": true, "data": { "cropId": 14, "status": "active", ... } }` },
      { method: "GET", path: "/api/crops/:id", roles: "any", desc: "Listing detail with inspection history." },
      { method: "PATCH", path: "/api/crops/:id", roles: "farmer (owner), admin", desc: "Update price, quantity, photos, status (active|archived).", request: `{ "basePricePerKg": 98, "totalQuantityKg": 20000 }` },
      { method: "DELETE", path: "/api/crops/:id", roles: "farmer (owner), admin", desc: "Hard delete, or soft-archive if orders reference it (open bids auto-rejected).", response: `{ "success": true, "data": { "archived": true } }` },
    ],
  },
  {
    name: "Bidding & Negotiation",
    endpoints: [
      { method: "GET", path: "/api/bids?status=&cropId=", roles: "farmer | buyer | admin", desc: "Bids scoped to role (farmer: bids on own crops; buyer: own bids)." },
      { method: "POST", path: "/api/bids", roles: "buyer", desc: "Submit bulk offer / RFQ. Validates stock, lowball guard (≥50% of ask), one open bid per crop per buyer.", request: `{ "cropId": 1, "bidPricePerKg": 92, "bidQuantityKg": 10000, "targetDeliveryDate": "2025-06-01", "message": "Pickup from farm" }`, response: `{ "success": true, "data": { "bidId": 41, "status": "pending", ... } }` },
      { method: "PATCH", path: "/api/bids/:id", roles: "farmer | buyer", desc: "State machine action: accept | reject | counter (farmer) · accept_counter | reject_counter | revise | withdraw (buyer). Accepting creates an order atomically.", request: `{ "action": "counter", "counterPrice": 98, "note": "Includes bagging" }`, response: `{ "success": true, "data": { "bid": { "status": "accepted" }, "order": { "orderId": 37, "trackingNumber": "ML-2025-1038-X7K", "paymentStatus": "awaiting_escrow" } } }` },
    ],
  },
  {
    name: "Orders, Logistics & Escrow",
    endpoints: [
      { method: "GET", path: "/api/orders?active=1", roles: "any", desc: "Orders with joined crop/party info, tracking events and disputes." },
      { method: "GET", path: "/api/orders/:id", roles: "party | admin", desc: "Single order detail." },
      { method: "PATCH", path: "/api/orders/:id", roles: "role-dependent", desc: "lock_escrow (buyer) · advance (admin→quality_checked, farmer→dispatched/in_transit, buyer→delivered + auto escrow release) · update_location (farmer).", request: `{ "action": "advance", "location": "Khanewal Bypass, N-5", "note": "Truck LES-4521" }`, response: `{ "success": true, "data": { "orderId": 1, "deliveryStage": "in_transit", "paymentStatus": "escrow_locked" } }` },
      { method: "POST", path: "/api/orders/:id/dispute", roles: "buyer | farmer", desc: "Freeze escrow and open a dispute.", request: `{ "reason": "Moisture 17% vs agreed 14%" }` },
      { method: "GET", path: "/api/wallet", roles: "farmer | buyer", desc: "Balances + ledger.", response: `{ "success": true, "data": { "walletBalance": 4500000, "escrowBalance": 1044000, "pendingInEscrow": 1044000, "transactions": [...] } }` },
      { method: "POST", path: "/api/wallet", roles: "buyer", desc: "Simulated bank top-up.", request: `{ "amount": 500000 }` },
    ],
  },
  {
    name: "Mandi Rates",
    endpoints: [
      { method: "GET", path: "/api/mandi-rates?view=latest&crop=&market=", roles: "any", desc: "Latest rate per crop × mandi with day-on-day % change (window function)." },
      { method: "GET", path: "/api/mandi-rates?view=trend&crop=Wheat&days=14", roles: "any", desc: "Pivoted daily series for charting.", response: `{ "success": true, "data": { "cropName": "Wheat", "markets": ["Lahore", ...], "series": [{ "date": "2025-05-01", "Lahore": 98.2, "Multan": 91.4 }] } }` },
      { method: "GET", path: "/api/mandi-rates?view=compare", roles: "any", desc: "Mandi avg vs platform ask vs realised platform deal price per crop." },
      { method: "POST", path: "/api/mandi-rates", roles: "admin", desc: "Manual upsert (unique crop+market+date).", request: `{ "cropName": "Wheat", "marketLocation": "Lahore", "minPricePerKg": 92, "maxPricePerKg": 101, "dateUpdated": "2025-05-14" }` },
      { method: "POST", path: "/api/mandi-rates/sync", roles: "admin", desc: "Mock government feed sync (bounded ±3% random walk, source=feed).", response: `{ "success": true, "data": { "updated": 60, "date": "2025-05-14" } }` },
    ],
  },
  {
    name: "Payments, Payouts & Reviews",
    endpoints: [
      { method: "GET", path: "/api/payments/checkout", roles: "buyer | farmer", desc: "Enabled gateways (stripe / jazzcash / easypaisa / sandbox) and their mode." },
      { method: "POST", path: "/api/payments/checkout", roles: "buyer", desc: "Create a payment intent; returns a redirect URL (Stripe Checkout / sandbox) or an auto-submit form (JazzCash / Easypaisa). The wallet is credited only by a verified callback.", request: `{ "provider": "stripe", "amount": 500000 }`, response: `{ "success": true, "data": { "reference": "MLT1790…", "redirectUrl": "https://checkout.stripe.com/…" } }` },
      { method: "POST", path: "/api/payments/webhook/stripe", roles: "Stripe (signed)", desc: "Stripe webhook; verifies Stripe-Signature (HMAC-SHA256, 5-min tolerance) and settles checkout.session.* events idempotently." },
      { method: "POST", path: "/api/payments/callback/jazzcash", roles: "JazzCash (signed)", desc: "JazzCash return URL; verifies pp_SecureHash with the integrity salt, pp_ResponseCode 000 = success." },
      { method: "GET", path: "/api/payments/callback/easypaisa", roles: "Easypaisa", desc: "Easypaisa postBack; result is confirmed server-to-server via Inquire Transaction before crediting." },
      { method: "GET", path: "/api/payments/:reference", roles: "owner", desc: "Poll payment status after returning from the gateway." },
      { method: "POST", path: "/api/payouts", roles: "farmer", desc: "Withdraw wallet balance to bank / JazzCash / Easypaisa.", request: `{ "amount": 50000, "method": "jazzcash", "accountTitle": "Bashir Soomro", "accountNumber": "03451234567" }` },
      { method: "PATCH", path: "/api/payouts/:id", roles: "admin", desc: "Mark payout paid, or reject (funds returned).", request: `{ "status": "paid" }` },
      { method: "POST", path: "/api/reviews", roles: "buyer", desc: "Rate the seller of a delivered & paid order (1 per order); recalculates the seller trust score.", request: `{ "orderId": 33, "rating": 5, "comment": "Fresh onions, perfect weight" }`, response: `{ "success": true, "data": { "trust": { "trustScore": 4.41, "ratingAvg": 4.6, "ratingCount": 5 } } }` },
      { method: "GET", path: "/api/reviews?farmerId=2 · ?pending=1", roles: "public · buyer", desc: "Seller reviews (including farmer replies), or the buyer's delivered orders awaiting review." },
      { method: "POST", path: "/api/reviews/:id/reply", roles: "farmer (seller on that order)", desc: "Respond once to a verified buyer review. Buyer receives an in-app notification; response appears on crop details.", request: `{ "reply": "Thank you for your feedback. We look forward to supplying you again." }` },
      { method: "GET", path: "/api/reports/summary", roles: "farmer | admin", desc: "Download a live, role-scoped CSV with KPIs, six monthly periods, and crop or regional breakdowns. Buyers and inspectors cannot access it." },
    ],
  },
  {
    name: "Tracking, Notifications & Auth",
    endpoints: [
      { method: "GET", path: "/api/tracking/:trackingNumber", roles: "public", desc: "Route, live/estimated GPS position, progress, ETA and milestones. Party names & notes only for order parties/staff. Fires the 'arriving soon' milestone at 85%." },
      { method: "POST", path: "/api/orders/:id/gps", roles: "farmer | admin", desc: "Driver GPS ping while dispatched / in transit.", request: `{ "lat": 25.9, "lng": 68.1, "label": "M-9 near Nooriabad" }` },
      { method: "GET", path: "/api/notifications", roles: "any", desc: "Latest 30 notifications + unread count." },
      { method: "PATCH", path: "/api/notifications", roles: "any", desc: "Mark given ids (or all) as read.", request: `{ "ids": [12, 13] }` },
      { method: "POST", path: "/api/auth/verify-email", roles: "public", desc: "Verify the 6-digit signup code (signs in), or { resend: true }.", request: `{ "email": "ali@farm.pk", "code": "816958" }` },
      { method: "POST", path: "/api/auth/forgot-password", roles: "public", desc: "Generates a single-use reset token (15-minute expiry, stored as SHA-256) and emails a /reset-password?token=… link. Same response whether or not the account exists.", request: `{ "email": "buyer@marketlink.pk" }`, response: `{ "success": true, "data": { "sent": true, "message": "If an account exists…" } }` },
      { method: "GET", path: "/api/auth/reset-password?token=…", roles: "public", desc: "Checks a reset link before the form is shown (masked email + expiry)." },
      { method: "POST", path: "/api/auth/reset-password", roles: "public", desc: "Validates the token, stores the new password as a bcrypt hash and deletes the token.", request: `{ "token": "…", "newPassword": "NewPass#2026" }` },
      { method: "GET", path: "/api/auth/google?role=buyer|farmer", roles: "public", desc: "Starts Google OAuth 2.0 (authorization code + PKCE, signed state cookie) → Google consent screen." },
      { method: "GET", path: "/api/auth/google/callback", roles: "Google", desc: "Verifies state, exchanges the code, requires a verified Google email; signs in existing users (linking Google) or creates a new buyer/farmer with name, email and profile picture." },
      { method: "PATCH", path: "/api/account/profile", roles: "any", desc: "Update name, phone, city, business, CNIC, address (used to complete Google sign-ups).", request: `{ "fullName": "Ali Raza", "phone": "0300 1234567", "city": "Multan" }` },
    ],
  },
  {
    name: "Database Explorer (admin)",
    endpoints: [
      { method: "GET", path: "/api/db/schema", roles: "admin", desc: "Tables, columns, PK/FK, indexes, row counts and recent audit log." },
      { method: "POST", path: "/api/db/query", roles: "admin", desc: "Single SQL statement. read = READ ONLY transaction + 8s timeout + 500-row cap; write requires confirm: true. Dangerous statements blocked; every query audited in db_audit_log.", request: `{ "sql": "SELECT full_name, trust_score FROM users WHERE role = 'farmer'", "mode": "read" }`, response: `{ "success": true, "data": { "columns": ["full_name","trust_score"], "rows": [["Ghulam Rasool", 4.53]], "rowCount": 1, "durationMs": 4 } }` },
    ],
  },
  {
    name: "AI Shopping Assistant",
    endpoints: [
      { method: "POST", path: "/api/assistant", roles: "public (visitors + buyers)", desc: "LLM assistant (OpenAI or Gemini when OPENAI_API_KEY / GEMINI_API_KEY is set; rule engine otherwise) grounded in live DB results: top-rated dealers (rating from deliveries, verification, inspections, disputes), high-quality listings by crop/category, cheapest/nearest produce, mandi rates and FAQ (escrow, bidding, tracking). Understands English + Roman Urdu. Rate-limited to 30 msgs/min.", request: `{ "message": "Where can I find top-rated dealers?" }`, response: `{ "success": true, "data": { "reply": "Top-rated sellers…", "cards": [{ "kind": "dealer", "name": "Muhammad Aslam", "business": "Aslam Agri Farms", "city": "Multan", "rating": 4.6, "deliveries": 8, "href": "/buyer?farmerId=2" }], "suggestions": ["High-quality vegetables", "Cheapest wheat"] } }` },
    ],
  },
  {
    name: "Admin & Quality",
    endpoints: [
      { method: "GET", path: "/api/admin/users?role=farmer", roles: "admin", desc: "Users with listing/order counts." },
      { method: "PATCH", path: "/api/admin/users/:id", roles: "admin", desc: "Verify / revoke. Verifying a farmer activates held listings.", request: `{ "isVerified": true }`, response: `{ "success": true, "data": { "id": 4, "isVerified": true, "listingsActivated": 1 } }` },
      { method: "GET", path: "/api/inspections", roles: "admin", desc: "Inspection report log." },
      { method: "POST", path: "/api/inspections", roles: "admin", desc: "Upload soil/crop inspection. passed → grade updated & listing active; failed → archived & bids rejected.", request: `{ "cropId": 7, "gradeAssigned": "B", "moistureLevelPercentage": 68, "soilPh": 7.8, "inspectionNotes": "Brix 19.2", "status": "passed", "reportAttachment": "data:application/pdf;base64,..." }` },
      { method: "GET", path: "/api/inspections/:id/report", roles: "admin", desc: "Download attached report file." },
      { method: "GET", path: "/api/admin/disputes", roles: "admin", desc: "Dispute resolution log." },
      { method: "PATCH", path: "/api/admin/disputes/:id", roles: "admin", desc: "investigating | release (pay farmer) | refund (return to buyer).", request: `{ "outcome": "refund", "resolution": "Lab retest confirmed 17% moisture" }` },
      { method: "GET", path: "/api/analytics", roles: "any", desc: "Role-aware KPIs: farmer earnings, buyer spend, or platform-wide volume/regions/stages." },
      { method: "GET", path: "/api/health", roles: "public", desc: "DB connectivity healthcheck." },
    ],
  },
];

export const WORKFLOWS: { title: string; icon: string; steps: string[] }[] = [
  {
    title: "Role-Based Marketplace Flow",
    icon: "🌱",
    steps: [
      "Authenticate with password or Google OAuth; the signed session determines whether the user enters Admin, Farmer/Vendor, Buyer/Customer or Inspector modules. Every page and API repeats the role/ownership check.",
      "Farmer: manage profile and graded crop listings → review and counter bids → fulfil accepted orders → receive escrow payout → respond once to each verified buyer review.",
      "Buyer: search the marketplace and inspect crop/quality details → place bids and negotiate → fund escrow after acceptance → track shipment → confirm delivery and submit a verified rating.",
      "Inspector: certify crop quality and record moisture, soil pH, grade and report before dispatch. Admin: approve users, monitor bids and transactions, manage mandi rates, and resolve disputes.",
      "Data processing: accepting a bid creates an order and decrements inventory transactionally; escrow lock precedes inspection, dispatch and tracking; verified delivery releases payment and enables a review.",
      "Output: Admin and Farmer dashboards show live metrics and charts; their role-scoped CSV summary downloads reflect current sales, orders and trading regions/crops.",
    ],
  },
  {
    title: "Bidding & Negotiation",
    icon: "🤝",
    steps: [
      "Buyer submits bid (price, qty, target date). Guards: listing active, qty ≤ stock, price ≥ 50% of ask, one open bid per buyer per listing.",
      "Farmer reviews in Negotiation Hub drawer → Accept, Reject, or Counter (counter must exceed bid price).",
      "On counter: buyer may accept_counter, reject_counter, or revise (bid returns to pending with new price) — unlimited rounds.",
      "On acceptance (SELECT … FOR UPDATE on bid + crop): stock decremented, listing → sold_out at 0, other open bids exceeding remaining stock auto-rejected, order created with unique tracking number in 'awaiting_escrow'.",
    ],
  },
  {
    title: "Escrow & Order Status Progression",
    icon: "🔐",
    steps: [
      "Buyer locks full order value: wallet_balance −= total, escrow_balance += total, ledger entry 'escrow_lock'. Nothing progresses before this.",
      "Quality inspector records pre-dispatch inspection → stage 'quality_checked' (creates a quality_inspections row).",
      "Farmer marks 'dispatched' then 'in_transit', posting checkpoint locations (order_events audit trail).",
      "Buyer confirms delivery → 'delivered'; escrow released atomically: farmer credited total − 1.5% platform fee, ledger entries payout + platform_fee + escrow_release.",
      "Either party can raise a dispute while escrow is locked → progression frozen; admin resolves by release (farmer paid) or refund (buyer credited).",
    ],
  },
  {
    title: "Mandi Rate Sync",
    icon: "📈",
    steps: [
      "Rates are stored per (crop, market, date) with a UNIQUE constraint → all writes are idempotent upserts.",
      "Admin manual entry: validates min ≤ avg ≤ max (avg defaults to midpoint), source='manual'.",
      "Mock feed sync: reads the latest rate for every crop × mandi, applies a bounded ±3% random walk, upserts today's row with source='feed' in one transaction; missing pairs are seeded from catalogue base prices.",
      "Insights: day-on-day change via ROW_NUMBER() window; platform comparison joins latest mandi avg vs active listing ask vs 90-day realised deal price; farmer listing form suggests grade-adjusted price (A ×1.06, B ×1.00, C ×0.90).",
    ],
  },
  {
    title: "Verification & Quality",
    icon: "🛡️",
    steps: [
      "New farmers register unverified; their listings enter 'pending_inspection' and are hidden from the marketplace.",
      "Admin verifies CNIC/farm → farmer verified and held listings activated.",
      "Inspection passed → listing grade overwritten with assigned grade and activated; failed → listing archived and open bids rejected; pending → held.",
    ],
  },
];
