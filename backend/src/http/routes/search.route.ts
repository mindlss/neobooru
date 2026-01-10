import { Router } from 'express';
import { searchHandler } from '../controllers/search.controller';
import { viewerMiddleware } from '../middlewares/viewer.middleware';

export const searchRouter = Router();

// public, uses req.viewer
searchRouter.get('/search', viewerMiddleware, searchHandler);
