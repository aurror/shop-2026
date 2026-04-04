#!/usr/bin/env node
/**
 * Standalone backup script for use with system cron.
 * Usage: node /home/flo/shop/scripts/backup-cron.js [local|s3|both]
 * Env:   DATABASE_URL, DB_SCHEMA, BACKUP_LOCAL_PATH (or set in DB settings)
 */

process.chdir(__dirname + "/..");

// Minimal pg + fs implementation — no Next.js / ORM dependency
const { Pool } = require("pg");
const { exec } = require("child_process");
const { existsSync, mkdirSync, statSync } = require("fs");
const { readdir, unlink } = require("fs/promises");
const path = require("path");

const DB_URL = process.env.DATABASE_URL || "postgresql://test:fineteasirmittens@pg.sg-ic.de:5432/postgres";
const SCHEMA = process.env.DB_SCHEMA || "student_test";
const location = process.argv[2] || "local";

const pool = new Pool({ connectionString: DB_URL });

function execAsync(cmd, opts) {
  return new Promise((res, rej) =>
    exec(cmd, { timeout: 300000, ...opts }, (err, stdout, stderr) =>
      err ? rej(Object.assign(err, { stderr })) : res({ stdout, stderr })
    )
  );
}

function getFromUrl(url, part) {
  const m = {
    host: url.match(/@([^:/@]+):/)?.[1],
    port: url.match(/:(\d+)\//)?.[1],
    user: url.match(/\/\/([^:]+):/)?.[1],
    password: url.match(/:\/\/[^:]+:([^@]+)@/)?.[1],
    db: url.match(/\/(\w+)(\?|$)/)?.[1],
  };
  return m[part] || "";
}

async function getSettings() {
  const client = await pool.connect();
  try {
    const res = await client.query(`SELECT key, value FROM "${SCHEMA}".settings`);
    return Object.fromEntries(res.rows.map((r) => [r.key, r.value]));
  } finally {
    client.release();
  }
}

async function logBackup(client, fields) {
  await client.query(
    `INSERT INTO "${SCHEMA}".backup_logs (filename, location, path, size_bytes, status, error)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [fields.filename, fields.location, fields.path, fields.sizeBytes ?? null, fields.status, fields.error ?? null]
  );
}

async function run() {
  const settings = await getSettings();
  const storeName = String(settings.store_name || "3dprintit").toLowerCase().replace(/[^a-z0-9]/g, "-");
  const defaultPath = `/var/backups/${storeName}`;
  const localPath = String(settings.backup_local_path || process.env.BACKUP_LOCAL_PATH || defaultPath);
  const retention = parseInt(String(settings.backup_retention_count || "10"));

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `${storeName}-backup-${timestamp}.sql.gz`;
  const filePath = path.join(localPath, filename);

  const host = getFromUrl(DB_URL, "host");
  const port = getFromUrl(DB_URL, "port") || "5432";
  const user = getFromUrl(DB_URL, "user");
  const password = getFromUrl(DB_URL, "password");
  const db = getFromUrl(DB_URL, "db");

  const doLocal = location === "local" || location === "both";
  const doS3 = location === "s3" || location === "both";

  let localOk = false;
  let localError = null;
  let sizeBytes = 0;

  if (doLocal || doS3) {
    try {
      if (!existsSync(localPath)) mkdirSync(localPath, { recursive: true });
      await execAsync(
        `PGPASSWORD="${password}" pg_dump -h "${host}" -p ${port} -U "${user}" -d "${db}" --schema="${SCHEMA}" --no-owner --no-privileges | gzip > "${filePath}"`
      );
      sizeBytes = statSync(filePath).size;
      localOk = true;
      console.log(`[backup] Local OK: ${filePath} (${sizeBytes} bytes)`);

      // Cleanup old backups
      try {
        const files = (await readdir(localPath))
          .filter((f) => f.endsWith(".sql.gz"))
          .sort()
          .reverse();
        for (const f of files.slice(retention)) {
          await unlink(path.join(localPath, f));
          console.log(`[backup] Deleted old backup: ${f}`);
        }
      } catch {}

      const client = await pool.connect();
      try {
        await logBackup(client, { filename, location: "local", path: filePath, sizeBytes, status: "success" });
      } finally { client.release(); }
    } catch (err) {
      localError = err.message || String(err);
      console.error(`[backup] Local FAILED: ${localError}`);
      const client = await pool.connect();
      try {
        await logBackup(client, { filename, location: "local", path: filePath, status: "failed", error: localError });
      } finally { client.release(); }
    }
  }

  if (doS3 && localOk) {
    try {
      const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
      const { createReadStream } = require("fs");
      const s3 = new S3Client({
        endpoint: String(settings.backup_s3_endpoint || "") || undefined,
        region: String(settings.backup_s3_region || "eu-central-1"),
        credentials: {
          accessKeyId: String(settings.backup_s3_key || ""),
          secretAccessKey: String(settings.backup_s3_secret || ""),
        },
        forcePathStyle: !!settings.backup_s3_endpoint,
      });
      const key = `backups/${filename}`;
      await s3.send(new PutObjectCommand({
        Bucket: String(settings.backup_s3_bucket || ""),
        Key: key,
        Body: createReadStream(filePath),
        ContentType: "application/gzip",
      }));
      const s3Path = `s3://${settings.backup_s3_bucket}/${key}`;
      console.log(`[backup] S3 OK: ${s3Path}`);
      const client = await pool.connect();
      try {
        await logBackup(client, { filename, location: "s3", path: s3Path, sizeBytes, status: "success" });
      } finally { client.release(); }
    } catch (err) {
      const errMsg = err.message || String(err);
      console.error(`[backup] S3 FAILED: ${errMsg}`);
      const client = await pool.connect();
      try {
        await logBackup(client, { filename, location: "s3", path: "s3://failed", status: "failed", error: errMsg });
      } finally { client.release(); }
    }
  }

  await pool.end();
  console.log("[backup] Done.");
}

run().catch((e) => { console.error("[backup] Fatal:", e); process.exit(1); });
