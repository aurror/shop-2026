import { exec } from "child_process";
import { promisify } from "util";
import { existsSync, mkdirSync, statSync, createReadStream } from "fs";
import { readdir, unlink } from "fs/promises";
import path from "path";
import { db } from "@/lib/db";
import { backupLogs, settings } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const execAsync = promisify(exec);

const SCHEMA = process.env.DB_SCHEMA || "student_test";

async function getBackupConfig() {
  const rows = await db.select().from(settings);
  const map: Record<string, unknown> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }

  const storeName = String(map.store_name || "3dprintit")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  return {
    localPath: String(map.backup_local_path || process.env.BACKUP_LOCAL_PATH || `/var/backups/${storeName}`),
    s3Endpoint: String(map.backup_s3_endpoint || process.env.S3_ENDPOINT || ""),
    s3Region: String(map.backup_s3_region || process.env.S3_REGION || "eu-central-1"),
    s3Bucket: String(map.backup_s3_bucket || process.env.S3_BUCKET || ""),
    s3AccessKey: String(map.backup_s3_key || map.backup_s3_access_key || process.env.S3_ACCESS_KEY || ""),
    s3SecretKey: String(map.backup_s3_secret || map.backup_s3_secret_key || process.env.S3_SECRET_KEY || ""),
    retentionCount: parseInt(String(map.backup_retention_count || "10")),
  };
}

export async function createLocalBackup(): Promise<{
  success: boolean;
  filename: string;
  path: string;
  sizeBytes: number;
  error?: string;
}> {
  const config = await getBackupConfig();
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `3dprintit-backup-${timestamp}.sql.gz`;
  const backupDir = config.localPath;
  const filePath = path.join(backupDir, filename);

  try {
    // Ensure backup directory exists
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }

    const dbUrl = process.env.DATABASE_URL || "";

    // pg_dump the specific schema
    await execAsync(
      `PGPASSWORD="${getPasswordFromUrl(dbUrl)}" pg_dump -h "${getHostFromUrl(dbUrl)}" -p ${getPortFromUrl(dbUrl)} -U "${getUserFromUrl(dbUrl)}" -d "${getDbFromUrl(dbUrl)}" --schema="${SCHEMA}" --no-owner --no-privileges | gzip > "${filePath}"`,
      { timeout: 300000 } // 5 minute timeout
    );

    const stats = statSync(filePath);

    // Log the backup
    await db.insert(backupLogs).values({
      filename,
      location: "local",
      path: filePath,
      sizeBytes: stats.size,
      status: "success",
    });

    // Clean up old backups
    await cleanOldBackups(backupDir, config.retentionCount);

    return { success: true, filename, path: filePath, sizeBytes: stats.size };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await db.insert(backupLogs).values({
      filename,
      location: "local",
      path: filePath,
      status: "failed",
      error: errorMsg,
    });

    return { success: false, filename, path: filePath, sizeBytes: 0, error: errorMsg };
  }
}

export async function createS3Backup(): Promise<{
  success: boolean;
  filename: string;
  path: string;
  sizeBytes: number;
  error?: string;
}> {
  const config = await getBackupConfig();

  if (!config.s3Bucket || !config.s3AccessKey || !config.s3SecretKey) {
    return { success: false, filename: "", path: "", sizeBytes: 0, error: "S3 not configured" };
  }

  // First create local backup
  const localResult = await createLocalBackup();
  if (!localResult.success) {
    return localResult;
  }

  try {
    const s3Client = new S3Client({
      endpoint: config.s3Endpoint || undefined,
      region: config.s3Region,
      credentials: {
        accessKeyId: config.s3AccessKey,
        secretAccessKey: config.s3SecretKey,
      },
      forcePathStyle: !!config.s3Endpoint,
    });

    const fileStream = createReadStream(localResult.path);
    const s3Key = `backups/${localResult.filename}`;

    await s3Client.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: s3Key,
        Body: fileStream,
        ContentType: "application/gzip",
      })
    );

    await db.insert(backupLogs).values({
      filename: localResult.filename,
      location: "s3",
      path: `s3://${config.s3Bucket}/${s3Key}`,
      sizeBytes: localResult.sizeBytes,
      status: "success",
    });

    return {
      success: true,
      filename: localResult.filename,
      path: `s3://${config.s3Bucket}/${s3Key}`,
      sizeBytes: localResult.sizeBytes,
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Unknown error";

    await db.insert(backupLogs).values({
      filename: localResult.filename,
      location: "s3",
      path: "s3://failed",
      status: "failed",
      error: errorMsg,
    });

    return { success: false, filename: localResult.filename, path: "", sizeBytes: 0, error: errorMsg };
  }
}

export async function getBackupHistory() {
  return db.select().from(backupLogs).orderBy(desc(backupLogs.createdAt)).limit(50);
}

async function cleanOldBackups(dir: string, keep: number) {
  try {
    const files = await readdir(dir);
    const backupFiles = files
      .filter((f) => f.startsWith("3dprintit-backup-") && f.endsWith(".sql.gz"))
      .sort()
      .reverse();

    if (backupFiles.length > keep) {
      const toDelete = backupFiles.slice(keep);
      for (const file of toDelete) {
        await unlink(path.join(dir, file));
      }
    }
  } catch (error) {
    console.error("[Backup] Cleanup error:", error);
  }
}

// URL parsing helpers
function getHostFromUrl(url: string): string {
  const match = url.match(/@([^:]+):/);
  return match?.[1] || "localhost";
}

function getPortFromUrl(url: string): number {
  const match = url.match(/:(\d+)\//);
  return match ? parseInt(match[1]) : 5432;
}

function getUserFromUrl(url: string): string {
  const match = url.match(/\/\/([^:]+):/);
  return match?.[1] || "postgres";
}

function getPasswordFromUrl(url: string): string {
  const match = url.match(/:\/\/[^:]+:([^@]+)@/);
  return match?.[1] || "";
}

function getDbFromUrl(url: string): string {
  const match = url.match(/\/(\w+)$/);
  return match?.[1] || "postgres";
}
