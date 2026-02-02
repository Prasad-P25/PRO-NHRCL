import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const dbName = process.env.DB_NAME || 'mahsr_safety';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: 'postgres', // Connect to default postgres db
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function createDatabase() {
  try {
    // Check if database exists
    const result = await pool.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rows.length === 0) {
      console.log(`Creating database "${dbName}"...`);
      await pool.query(`CREATE DATABASE ${dbName}`);
      console.log(`Database "${dbName}" created successfully!`);
    } else {
      console.log(`Database "${dbName}" already exists.`);
    }
  } catch (error) {
    console.error('Error creating database:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createDatabase();
