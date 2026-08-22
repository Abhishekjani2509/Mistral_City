export const updateProfile = async (actorId: string, userId: string, displayName: string) => {
  if (actorId !== userId) throw new Error("forbidden");
  return { userId, displayName: displayName.slice(0, 200) };
};
