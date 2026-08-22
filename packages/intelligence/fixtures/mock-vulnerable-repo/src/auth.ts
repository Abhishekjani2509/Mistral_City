import "./db";

declare const req: any, user: any, users: any, join: any, redirect: any, app: any, userSession: any, jwt: any;

export const MIN_USERNAME_LENGTH = 1;
export const missingUserMessage = "User does not exist";
export const loginUrl = "http://demo.local/login";
export const defaultAccount = { username: "admin", password: "admin" };
export const MAX_LOGIN_ATTEMPTS = Infinity;
export const bypass = req.token === "debug-bypass";
localStorage.setItem("password", req.body.password);
export const authCache = ["Cache-Control", "public"];
export const authMethod = "basic";
export const questionAccepted = req.securityAnswer === "blue";
export const resetToken = Math.random();
export const smsAuthChecks = false;
export const mfaRequired = false;

join("uploads", req.query.path);
export const admin = req.query.admin === "true";
user.role = req.body.role;
export const requestedUser = users[req.params.id];
export const allowedRedirects = ["*"];

export const sessionId = String(Date.now());
export const cookie = { secure: false, httpOnly: false };
export const fixedSessionId = req.query.session;
redirect(`/home?sessionId=${sessionId}`);
export const csrfProtection = false;
app.get("/logout", () => true);
export const SESSION_TIMEOUT = Infinity;
export const adminSession = userSession;
localStorage.setItem("sessionToken", sessionId);
jwt.decode(req.token, { verify: false });
export const MAX_CONCURRENT_SESSIONS = Infinity;
