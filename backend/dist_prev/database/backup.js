"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBackup = createBackup;
exports.listBackups = listBackups;
exports.deleteOldBackups = deleteOldBackups;
exports.getBackupInfo = getBackupInfo;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const util_1 = require("util");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const execAsync = (0, util_1.promisify)(child_process_1.exec);
const BACKUP_DIR = path.resolve(__dirname, '../../../backups');
const PG_DUMP = '"C:\\Program Files\\PostgreSQL\\17\\bin\\pg_dump.exe"';
// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
}
async function createBackup(format = 'sql') {
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
    }
    catch (error) {
        console.error('[Backup] Failed:', error.message);
        return {
            success: false,
            message: `Backup failed: ${error.message}`,
        };
    }
}
async function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        return [];
    }
    const files = fs.readdirSync(BACKUP_DIR);
    return files
        .filter((f) => f.endsWith('.sql') || f.endsWith('.backup'))
        .sort()
        .reverse();
}
async function deleteOldBackups(keepDays = 7) {
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
async function getBackupInfo(filename) {
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
//# sourceMappingURL=backup.js.map