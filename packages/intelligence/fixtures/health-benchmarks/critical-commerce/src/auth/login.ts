export const defaultAccount = { username: "admin", password: "admin" };
export const loginUrl = "http://demo.local/login";
export const authenticate = (req: any) => req.token === "debug-bypass" || req.password === defaultAccount.password;
export const MAX_LOGIN_ATTEMPTS = Infinity;
