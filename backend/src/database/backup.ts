import { exec } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import dotenv from 'dotenv';

dotenv.config();

const execAsync = promisify(exec);

interface BackupResult {
  success: boolean;
  message: string;
  filename?: string;
  filepath?: string;
  size?: number;
  timestamp?: string;
}

const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const PG_DUMP = '"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"';

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

export async function createBackup(format: 'sql' | 'compressed' = 'sql'): Promise<BackupResult> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const extension = format === 'compressed' ? '.backup' : '.sql';
  const filename = `${process.env.DB_NAME}_${timestamp}${extension}`;
  const filepath = path.join(BACKUP_DIR, filename);

  const formatFlag = format === 'compressed' ? '-F c' : '-F p';

  const command = `${PG_DUMP} -h ${process.env.DB_HOST} -p ${process.env.DB_PORT} -U ${process.env.DB_USER} -d ${process.env.DB_NAME} ${formatFlag} -f "${filepath}"`;

  try {
    // Set password in environment
    const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD };

    await execAsync(command, { env });

    const stats = fs.statSync(filepath);

    console.log(`[Backup] Created: ${filename} (${stats.size} bytes)`);

    return {
      success: true,
      message: 'Backup created successfully',
      filename,
      filepath,
      size: stats.size,
      timestamp,
    };
  } catch (error: any) {
    console.error('[Backup] Failed:', error.message);
    return {
      success: false,
      message: `Backup failed: ${error.message}`,
    };
  }
}

export async function listBackups(): Promise<string[]> {
  if (!fs.existsSync(BACKUP_DIR)) {
    return [];
  }

  const files = fs.readdirSync(BACKUP_DIR);
  return files
    .filter((f) => f.endsWith('.sql') || f.endsWith('.backup'))
    .sort()
    .reverse();
}

export async function deleteOldBackups(keepDays: number = 7): Promise<number> {
  const files = await listBackups();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - keepDays);

  let deleted = 0;

  for (const file of files) {
    const filepath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filepath);

    if (stats.mtime < cutoffDate) {
      fs.unlinkSync(filepath);
      console.log(`[Backup] Deleted old backup: ${file}`);
      deleted++;
    }
  }

  return deleted;
}

export async function getBackupInfo(filename: string): Promise<BackupResult> {
  const filepath = path.join(BACKUP_DIR, filename);

  if (!fs.existsSync(filepath)) {
    return {
      success: false,
      message: 'Backup file not found',
    };
  }

  const stats = fs.statSync(filepath);

  return {
    success: true,
    message: 'Backup found',
    filename,
    filepath,
    size: stats.size,
    timestamp: stats.mtime.toISOString(),
  };
}

// Run backup if called directly
if (require.main === module) {
  (async () => {
    console.log('Starting database backup...');

    // Create both SQL and compressed backups
    const sqlResult = await createBackup('sql');
    console.log('SQL backup:', sqlResult.success ? 'OK' : 'FAILED');

    const compressedResult = await createBackup('compressed');
    console.log('Compressed backup:', compressedResult.success ? 'OK' : 'FAILED');

    // Cleanup old backups
    const deleted = await deleteOldBackups(7);
    console.log(`Cleaned up ${deleted} old backup(s)`);

    process.exit(sqlResult.success && compressedResult.success ? 0 : 1);
  })();
}
