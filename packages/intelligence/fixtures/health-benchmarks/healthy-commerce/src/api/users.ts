import { z } from "zod";

const updateSchema = z.object({ displayName: z.string().trim().min(1).max(80) });
export const updateUser = async (actorId: string, userId: string, input: unknown) => {
  if (actorId !== userId) throw new Error("forbidden");
  return updateSchema.parse(input);
};
