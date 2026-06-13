"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.db = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'protecther_audit',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 50, // Increased from 20 for better concurrency
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000, // Increased from 2s to 5s
    statement_timeout: 30000, // 30 second query timeout to prevent hanging queries
    query_timeout: 30000, // 30 second query timeout
});
pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});
exports.db = {
    query: (text, params) => {
        return pool.query(text, params);
    },
    getClient: () => pool.connect(),
    transaction: async (callback) => {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            await client.query('ROLLBACK');
            throw error;
        }
        finally {
            client.release();
        }
    },
};
exports.default = pool;
//# sourceMappingURL=connection.js.map