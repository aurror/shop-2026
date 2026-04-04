// Add coupon_attempts table without wiping existing data
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres",
});

const SCHEMA = process.env.DB_SCHEMA || "student_test";

async function run() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."coupon_attempts" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code TEXT NOT NULL,
        valid BOOLEAN NOT NULL DEFAULT FALSE,
        subtotal NUMERIC(10, 2),
        discount_amount NUMERIC(10, 2),
        error TEXT,
        ip TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS coupon_attempts_code_idx ON "${SCHEMA}"."coupon_attempts" (code);
      CREATE INDEX IF NOT EXISTS coupon_attempts_created_idx ON "${SCHEMA}"."coupon_attempts" (created_at);
    `);
    console.log("✓ coupon_attempts table ready");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
