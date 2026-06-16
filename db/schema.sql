CREATE TABLE IF NOT EXISTS offers (
  id               SERIAL PRIMARY KEY,
  code             VARCHAR(50) UNIQUE NOT NULL,
  description      TEXT NOT NULL,
  amount           DECIMAL(10, 2) NOT NULL,
  currency         VARCHAR(3) NOT NULL DEFAULT 'EUR',
  billing_cycle         VARCHAR(30) NOT NULL CHECK (billing_cycle IN ('one_time', 'recurring_monthly', 'recurring')),
  billing_months        INTEGER,
  billing_interval      VARCHAR(10) DEFAULT 'month' CHECK (billing_interval IN ('day', 'week', 'month', 'year')),
  billing_interval_count INTEGER DEFAULT 1 CHECK (billing_interval_count >= 1),
  discount_percent DECIMAL(5,2),
  company_name     VARCHAR(255),
  company_address  TEXT,
  company_zip      VARCHAR(20),
  company_pec      VARCHAR(255),
  company_phone    VARCHAR(50),
  company_sdi      VARCHAR(20),
  is_active        BOOLEAN NOT NULL DEFAULT true,
  max_uses         INTEGER NOT NULL DEFAULT 1,
  use_count        INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id                     SERIAL PRIMARY KEY,
  offer_id               INTEGER REFERENCES offers(id),
  stripe_session_id      VARCHAR(255) UNIQUE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  customer_email         VARCHAR(255),
  status                 VARCHAR(50) NOT NULL DEFAULT 'pending',
  amount_paid            DECIMAL(10, 2),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at           TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_offers_code       ON offers (UPPER(code));
CREATE INDEX IF NOT EXISTS idx_orders_session_id ON orders (stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_orders_sub_id     ON orders (stripe_subscription_id);

-- Migration: add billing_interval columns to existing tables
DO $$ BEGIN
  ALTER TABLE offers ADD COLUMN billing_interval VARCHAR(10) DEFAULT 'month'
    CHECK (billing_interval IN ('day', 'week', 'month', 'year'));
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE offers ADD COLUMN billing_interval_count INTEGER DEFAULT 1
    CHECK (billing_interval_count >= 1);
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE offers ADD COLUMN max_uses INTEGER NOT NULL DEFAULT 1;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE offers ADD COLUMN use_count INTEGER NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

DO $$ DECLARE cname text;
BEGIN
  SELECT conname INTO cname FROM pg_constraint
    WHERE conrelid = 'offers'::regclass AND contype = 'c'
    AND conname LIKE '%billing_cycle%';
  IF cname IS NOT NULL THEN
    EXECUTE 'ALTER TABLE offers DROP CONSTRAINT ' || quote_ident(cname);
  END IF;
  ALTER TABLE offers ADD CONSTRAINT offers_billing_cycle_check
    CHECK (billing_cycle IN ('one_time', 'recurring_monthly', 'recurring'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;
