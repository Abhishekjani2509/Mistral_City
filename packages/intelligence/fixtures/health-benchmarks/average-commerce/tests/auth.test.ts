import { expect, it } from "vitest";
import { login } from "../src/auth/login.js";

it("returns a user", async () => expect(await login("person@example.com", "password")).toBeDefined());
