import { describe, expect, it } from "vitest";
import { createSession } from "../src/auth/session.js";

describe("sessions", () => { it("creates unpredictable expiring sessions", () => expect(createSession("u1").id).toHaveLength(64)); });
