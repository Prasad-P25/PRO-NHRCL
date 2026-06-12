import { Pool, QueryResult, QueryResultRow } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
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

export const db = {
  query: <T extends QueryResultRow = any>(text: string, params?: any[]): Promise<QueryResult<T>> => {
    return pool.query<T>(text, params);
  },

  getClient: () => pool.connect(),

  transaction: async <T>(callback: (client: any) => Promise<T>): Promise<T> => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  },
};

export default pool;
