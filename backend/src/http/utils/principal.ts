import type { Request as ExpressRequest } from 'express';

import { prisma } from '../../lib/prisma';
import { computeIsAdult } from '../../domain/users/user.service';

export type ViewerContext = { id?: string; isAdult: boolean } | undefined;

export async function loadViewerFromReq(
    req: ExpressRequest,
): Promise<ViewerContext> {
    if (!req.user?.id) return undefined;

    const user = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { id: true, birthDate: true, deletedAt: true },
    });

    if (!user || user.deletedAt) return undefined;

    return { id: user.id, isAdult: computeIsAdult(user.birthDate) };
}

export function principalFromReq(req: ExpressRequest) {
    if (!req.user?.id) return undefined;
    return { id: req.user.id, permissions: req.user.permissions ?? [] };
}

export function dtoViewerFromReq(req: ExpressRequest) {
    if (!req.user) return undefined;
    return { permissions: req.user.permissions ?? [] };
}
