import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { currentUserMiddleware } from '../middlewares/currentUser.middleware';
import { requireNotBanned } from '../middlewares/requireNotBanned.middleware';
import { requireRole } from '../middlewares/requireRole.middleware';
import { validate, validateParams } from '../middlewares/validate.middleware';
import { UserRole } from '@prisma/client';

import {
    comicIdParamsSchema,
    createComicBodySchema,
    updateComicBodySchema,
    addPageBodySchema,
    removePageParamsSchema,
    reorderPagesBodySchema,
} from '../schemas/comics.schemas';

import {
    createComicHandler,
    updateComicHandler,
    getComicHandler,
    addComicPageHandler,
    removeComicPageHandler,
    reorderComicPagesHandler,
} from '../controllers/comics.controller';

export const comicsRouter = Router();

const comicRoles = [
    UserRole.USER,
    UserRole.TRUSTED,
    UserRole.MODERATOR,
    UserRole.ADMIN,
];

const base = [
    authMiddleware,
    currentUserMiddleware,
    requireNotBanned,
    requireRole(...comicRoles),
] as const;

comicsRouter.post(
    '/comics',
    ...base,
    validate(createComicBodySchema),
    createComicHandler
);

comicsRouter.get(
    '/comics/:id',
    ...base,
    validateParams(comicIdParamsSchema),
    getComicHandler
);

comicsRouter.patch(
    '/comics/:id',
    ...base,
    validateParams(comicIdParamsSchema),
    validate(updateComicBodySchema),
    updateComicHandler
);

comicsRouter.post(
    '/comics/:id/pages',
    ...base,
    validateParams(comicIdParamsSchema),
    validate(addPageBodySchema),
    addComicPageHandler
);

comicsRouter.delete(
    '/comics/:id/pages/:mediaId',
    ...base,
    validateParams(removePageParamsSchema),
    removeComicPageHandler
);

comicsRouter.post(
    '/comics/:id/pages/reorder',
    ...base,
    validateParams(comicIdParamsSchema),
    validate(reorderPagesBodySchema),
    reorderComicPagesHandler
);
