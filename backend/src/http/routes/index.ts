import { Router } from 'express';
import { healthRouter } from './health.route';
import { dbRouter } from './db.route';
import { storageRouter } from './storage.route';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(dbRouter);
apiRouter.use(storageRouter);
