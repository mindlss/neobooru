import { Router } from 'express';
import { healthRouter } from './health.route';

export const apiRouter = Router();

apiRouter.use(healthRouter);
