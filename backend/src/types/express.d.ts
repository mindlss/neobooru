import type { User, UserRole } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: UserRole;
            };

            currentUser?: User;

            viewer?: {
                id?: string;
                role: UserRole;
                isAdult: boolean;
            };

            requestId?: string;
        }
    }
}

export {};
