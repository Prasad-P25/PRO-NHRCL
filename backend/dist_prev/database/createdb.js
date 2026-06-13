"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const dbName = process.env.DB_NAME || 'protecther_audit';
const pool = new pg_1.Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: 'postgres', // Connect to default postgres db
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});
async function createDatabase() {
    try {
        // Check if database exists
        const result = await pool.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [dbName]);
        if (result.rows.length === 0) {
            console.log(`Creating database "${dbName}"...`);
            await pool.query(`CREATE DATABASE ${dbName}`);
            console.log(`Database "${dbName}" created successfully!`);
        }
        else {
            console.log(`Database "${dbName}" already exists.`);
        }
    }
    catch (error) {
        console.error('Error creating database:', error);
        process.exit(1);
    }
    finally {
        await pool.end();
    }
}
createDatabase();
//# sourceMappingURL=createdb.js.map