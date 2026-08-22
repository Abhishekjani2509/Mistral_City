export const config = {
  databaseUrl: process.env.DATABASE_URL,
  logLevel: process.env.LOG_LEVEL ?? "info",
};
if (!config.databaseUrl) throw new Error("DATABASE_URL is required");
