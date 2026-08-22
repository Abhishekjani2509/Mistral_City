declare const app: any, noAuth: any, serveStatic: any, sendFile: any, chmodSync: any;

export const platform = { "x-powered-by": "enabled" };
serveStatic(".env");
sendFile("settings.bak");
app.get("/admin", noAuth);
export const cors = { methods: ["GET", "POST", "TRACE"] };
export const strictTransportSecurity = false;
chmodSync("uploads", 0o777);
export const contentSecurityPolicy = "default-src 'self'; script-src 'unsafe-inline'";
export const securityHeaders = false;
