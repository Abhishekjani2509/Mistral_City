import { hash, verify } from "argon2";

export const hashPassword = (password: string) => hash(password);
export const verifyPassword = (digest: string, password: string) => verify(digest, password);
