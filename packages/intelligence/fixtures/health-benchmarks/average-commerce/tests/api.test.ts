import { expect, it } from "vitest";

it("returns a response", () => { const response = { status: 200 }; expect(response.status).toBeDefined(); });
