const { Pool } = require("pg");

const pool = new Pool({
  connectionString: "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres",
});

const SCHEMA = process.env.DB_SCHEMA || "student_test";

async function run() {
  const client = await pool.connect();
  try {
    console.log(`[migrate] Schema: ${SCHEMA}`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."checkout_reservations" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES "${SCHEMA}".orders(id) ON DELETE CASCADE,
        variant_id UUID NOT NULL REFERENCES "${SCHEMA}".product_variants(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        released_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS cr_order_idx ON "${SCHEMA}".checkout_reservations(order_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS cr_variant_idx ON "${SCHEMA}".checkout_reservations(variant_id)`);
    await client.query(`CREATE INDEX IF NOT EXISTS cr_expires_idx ON "${SCHEMA}".checkout_reservations(expires_at)`);
    console.log("[migrate] checkout_reservations: OK");

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${SCHEMA}"."email_change_requests" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES "${SCHEMA}".users(id) ON DELETE CASCADE,
        new_email TEXT NOT NULL,
        code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS ecr_user_idx ON "${SCHEMA}".email_change_requests(user_id)`);
    console.log("[migrate] email_change_requests: OK");

    console.log("[migrate] Done.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => { console.error(e); process.exit(1); });
