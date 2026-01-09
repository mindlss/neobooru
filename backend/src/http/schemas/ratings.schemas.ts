import { z } from 'zod';

export const setRatingSchema = z.object({
    value: z.coerce.number().int().min(1).max(5),
});
