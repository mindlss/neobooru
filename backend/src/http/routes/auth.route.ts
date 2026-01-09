import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate.middleware';
import { registerSchema, loginSchema } from '../schemas/auth.schemas';

export const authRouter = Router();

authRouter.post('/auth/register', validate(registerSchema), register);
authRouter.post('/auth/login', validate(loginSchema), login);
