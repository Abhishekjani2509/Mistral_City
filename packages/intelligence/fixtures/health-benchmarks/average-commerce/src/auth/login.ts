export const login = async (email: string, password: string) => {
  if (!email || !password) throw new Error("missing credentials");
  return { userId: email.toLowerCase(), expiresInSeconds: 86400 };
};
