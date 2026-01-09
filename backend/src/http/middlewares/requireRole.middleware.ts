import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';

export function requireRole(...roles: UserRole[]) {
    const allowed = new Set<UserRole>(roles);

    return (req: Request, res: Response, next: NextFunction) => {
        const role = req.user?.role;

        if (!role) {
            return res.status(401).json({
                error: { code: 'UNAUTHORIZED', message: 'Missing auth' },
            });
        }

        if (!allowed.has(role)) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Insufficient role',
                    required: roles,
                    got: role,
                },
            });
        }

        next();
    };
}
