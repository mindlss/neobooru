import { z } from 'zod';

export const userIdParamsSchema = z.object({
    id: z.string().uuid(),
});

export const userPatchSelfSchema = z.object({
    avatarKey: z.string().min(1).max(500).nullable().optional(),
    bio: z.string().max(1000).nullable().optional(),
    website: z.string().url().max(300).nullable().optional(),
    birthDate: z.coerce.date().nullable().optional(),

    showComments: z.boolean().optional(),
    showRatings: z.boolean().optional(),
    showFavorites: z.boolean().optional(),
    showUploads: z.boolean().optional(),
});
