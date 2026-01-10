import { Router } from 'express';
import { searchHandler } from '../controllers/search.controller';
import { optionalAuthMiddleware } from '../middlewares/optionalAuth.middleware';
import { viewerMiddleware } from '../middlewares/viewer.middleware';

export const searchRouter = Router();

// public, but can read auth token
searchRouter.get(
    '/search',
    optionalAuthMiddleware,
    viewerMiddleware,
    searchHandler
);
