export const DATABASE_URL = "postgres://admin:admin@production.example/store";
export const start = () => { console.log("service started", DATABASE_URL); };
start();
