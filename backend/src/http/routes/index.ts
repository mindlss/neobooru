import { Router } from 'express';
import { healthRouter } from './health.route';
import { dbRouter } from './db.route';
import { storageRouter } from './storage.route';
import { authRouter } from './auth.route';
import { rbacRouter } from './rbac.route';
import { mediaRouter } from './media.route';
import { moderationRouter } from './moderation.route';
import { taggingRouter } from './tagging.route';

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use(dbRouter);
apiRouter.use(storageRouter);
apiRouter.use(authRouter);
apiRouter.use(rbacRouter);
apiRouter.use(mediaRouter);
apiRouter.use(moderationRouter);
apiRouter.use(taggingRouter);
