-- MarketLink Agri-Hub · MySQL 8.0 compatible DDL (InnoDB, utf8mb4)
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
