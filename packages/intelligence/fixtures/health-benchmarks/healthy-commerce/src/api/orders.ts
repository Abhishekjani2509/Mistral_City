import { z } from "zod";
import { listOrders } from "../db/orders.js";

const querySchema = z.object({ cursor: z.string().optional(), limit: z.coerce.number().int().min(1).max(100) });
export const getOrders = async (input: unknown) => listOrders(querySchema.parse(input));
