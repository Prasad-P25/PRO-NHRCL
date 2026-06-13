"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const connection_1 = require("../connection");
const logger_1 = require("../../utils/logger");
async function migrate() {
    try {
        logger_1.logger.info('Adding password reset columns to users table...');
        // Add password reset columns
        await connection_1.db.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS reset_token VARCHAR(255),
      ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP
    `);
        // Create index for faster token lookup
        await connection_1.db.query(`
      CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users(reset_token) WHERE reset_token IS NOT NULL
    `);
        logger_1.logger.info('Password reset columns added successfully!');
        process.exit(0);
    }
    catch (error) {
        logger_1.logger.error('Migration failed:', error);
        process.exit(1);
    }
}
migrate();
//# sourceMappingURL=003-add-password-reset.js.map