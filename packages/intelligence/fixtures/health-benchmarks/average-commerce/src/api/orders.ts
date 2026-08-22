import { db } from "../db/client.js";

export const listOrders = async () => {
  const orders = await db.query("SELECT * FROM orders");
  return orders.rows;
};
