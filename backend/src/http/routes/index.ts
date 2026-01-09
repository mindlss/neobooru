import { Router } from 'express';
import { healthRouter } from './health.route';
import { dbRouter } from './db.route';
import { storageRouter } from './storage.route';
import { authRouter } from './auth.route';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(dbRouter);
apiRouter.use(storageRouter);
apiRouter.use(authRouter);
