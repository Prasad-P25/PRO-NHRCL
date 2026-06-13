import { Pool, QueryResult, QueryResultRow } from 'pg';
declare const pool: Pool;
export declare const db: {
    query: <T extends QueryResultRow = any>(text: string, params?: any[]) => Promise<QueryResult<T>>;
    getClient: () => Promise<import("pg").PoolClient>;
    transaction: <T>(callback: (client: any) => Promise<T>) => Promise<T>;
};
export default pool;
//# sourceMappingURL=connection.d.ts.map