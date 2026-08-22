export const createSession = (account: { id: string; mfaEnabled: boolean }) => {
  if (!account.mfaEnabled) return { userId: account.id, assurance: "password-only" };
  return { userId: account.id, assurance: "mfa" };
};
