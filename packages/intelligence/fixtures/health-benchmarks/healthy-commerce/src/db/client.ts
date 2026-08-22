export interface QueryClient { query<T>(sql: string, values: unknown[]): Promise<{ rows: T[] }> }
export const withTransaction = async <T>(client: QueryClient, work: () => Promise<T>) => work();
