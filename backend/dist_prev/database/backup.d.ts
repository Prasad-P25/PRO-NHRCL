interface BackupResult {
    success: boolean;
    message: string;
    filename?: string;
    filepath?: string;
    size?: number;
    timestamp?: string;
}
export declare function createBackup(format?: 'sql' | 'compressed'): Promise<BackupResult>;
export declare function listBackups(): Promise<string[]>;
export declare function deleteOldBackups(keepDays?: number): Promise<number>;
export declare function getBackupInfo(filename: string): Promise<BackupResult>;
export {};
//# sourceMappingURL=backup.d.ts.map