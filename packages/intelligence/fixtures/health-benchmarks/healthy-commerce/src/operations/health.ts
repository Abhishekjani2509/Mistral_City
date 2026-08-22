export const readiness = async () => ({ status: "ready", checks: { database: "up" } });
export const liveness = () => ({ status: "alive" });
