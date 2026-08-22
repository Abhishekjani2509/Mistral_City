import { randomBytes } from "node:crypto";

export const createSession = (userId: string) => ({ id: randomBytes(32).toString("hex"), userId, expiresInSeconds: 3600 });
export const cookieOptions = { secure: true, httpOnly: true, sameSite: "strict" as const };
