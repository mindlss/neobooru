import type { User } from '@prisma/client';
import type { Principal } from '../http/tsoa/authentication';

declare global {
    namespace Express {
        interface Request {
            user?: Principal;
            currentUser?: User;

            viewer?: {
                id?: string;
                isAdult: boolean;
            };

            requestId?: string;
        }
    }
}

export {};
