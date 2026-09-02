import { z } from "zod";

const searchSchema = z.object({
  query: z.string().trim().min(2).max(120),
}).strict();

export const parseLicensedAudioSearch = (input: unknown): { query: string } =>
  searchSchema.parse(input);
