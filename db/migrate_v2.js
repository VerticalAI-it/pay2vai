require('dotenv').config();
const db = require('./index');

async function migrate() {
  await db.query(`
    ALTER TABLE offers
      ADD COLUMN IF NOT EXISTS billing_months   INTEGER,
      ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2),
      ADD COLUMN IF NOT EXISTS company_name     VARCHAR(255),
      ADD COLUMN IF NOT EXISTS company_address  TEXT,
      ADD COLUMN IF NOT EXISTS company_zip      VARCHAR(20),
      ADD COLUMN IF NOT EXISTS company_pec      VARCHAR(255),
      ADD COLUMN IF NOT EXISTS company_phone    VARCHAR(50),
      ADD COLUMN IF NOT EXISTS company_sdi      VARCHAR(20)
  `);
  console.log('Migration v2 complete — new offer fields added.');
  process.exit(0);
}

migrate().catch((e) => { console.error(e); process.exit(1); });
