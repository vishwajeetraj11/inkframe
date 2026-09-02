import { z } from "zod";
import {
  PEXELS_ORIENTATIONS,
  type PexelsVideoSearchParams,
} from "@/lib/pexels/types";

const pexelsSearchParamsSchema = z
  .object({
    query: z.string().trim().min(1, "Search query is required.").max(100),
    orientation: z.enum(PEXELS_ORIENTATIONS).default("landscape"),
    page: z.coerce.number().int().min(1).max(100).default(1),
    per_page: z.coerce.number().int().min(1).max(80).default(18),
  })
  .strict();

export type PexelsSearchInput = z.input<typeof pexelsSearchParamsSchema>;

export const parsePexelsSearchParams = (
  input: unknown,
): PexelsVideoSearchParams => {
  const parsed = pexelsSearchParamsSchema.parse(input);
  return {
    query: parsed.query,
    orientation: parsed.orientation,
    page: parsed.page,
    perPage: parsed.per_page,
  };
};

export const safeParsePexelsSearchParams = (input: unknown) =>
  pexelsSearchParamsSchema.safeParse(input);

export { pexelsSearchParamsSchema };
