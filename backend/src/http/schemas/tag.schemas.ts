import { z } from 'zod';

export const tagNamesSchema = z.object({
    tags: z.array(z.string().min(1).max(64)).min(1).max(200),
});

export const tagSearchSchema = z.object({
    q: z.string().min(1).max(64),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const tagPopularSchema = z.object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const createTagSchema = z.object({
    name: z.string().min(1).max(64),
    categoryId: z.string().uuid(),
});

export const patchTagSchema = z.object({
    customColor: z
        .string()
        .regex(/^#([0-9a-fA-F]{6})$/, 'Expected HEX color like #RRGGBB')
        .nullable()
        .optional(),

    isExplicit: z.boolean().optional(),
});

export const createAliasSchema = z.object({
    alias: z.string().min(1).max(64),
});
