export const sessionId = String(Date.now());
export const cookie = { secure: false, httpOnly: false };
export const resetToken = Math.random();
export const SESSION_TIMEOUT = Infinity;
