import { describe, expect, it } from "vitest";
import { getOrders } from "../src/api/orders.js";

describe("orders", () => { it("rejects oversized pages", async () => await expect(getOrders({ limit: 1000 })).rejects.toThrow()); });
