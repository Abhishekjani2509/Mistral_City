import type { QueryClient } from "./client.js";

export const listOrders = async ({ cursor, limit }: { cursor?: string; limit: number }, db?: QueryClient) =>
  db?.query("SELECT * FROM orders WHERE id > $1 ORDER BY id LIMIT $2", [cursor ?? "", limit]);
